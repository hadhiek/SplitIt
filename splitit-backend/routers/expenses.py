from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
import math
import uuid

from core.database import get_db
from core.security import get_current_user_id
from core.cache import invalidate_group_cache
from models.domain import Expense, ExpenseSplit, GroupMember, Group
from schemas.dto import ExpenseCreate, ExpenseOut

router = APIRouter(prefix="/api/expenses", tags=["expenses"])

@router.post("", response_model=ExpenseOut)
async def create_expense(
    expense_in: ExpenseCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    user_uuid = uuid.UUID(user_id)
    # The caller, payer, and every split recipient must belong to this group.
    caller_membership = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == expense_in.group_id,
            GroupMember.user_id == user_uuid,
        )
    )
    if not caller_membership.scalars().first():
        raise HTTPException(status_code=403, detail="Not a member of this group")

    if not math.isfinite(expense_in.amount) or expense_in.amount <= 0:
        raise HTTPException(status_code=400, detail="Expense amount must be a positive finite number")

    split_user_ids = [split.user_id for split in expense_in.splits]
    if len(split_user_ids) != len(set(split_user_ids)):
        raise HTTPException(status_code=400, detail="Each group member can have only one split")

    if any(
        not math.isfinite(split.amount_owed) or split.amount_owed < 0
        for split in expense_in.splits
    ):
        raise HTTPException(status_code=400, detail="Split amounts must be finite and non-negative")

    referenced_user_ids = set(split_user_ids)
    referenced_user_ids.add(expense_in.paid_by)
    membership_result = await db.execute(
        select(GroupMember.user_id).where(
            GroupMember.group_id == expense_in.group_id,
            GroupMember.user_id.in_(referenced_user_ids),
        )
    )
    group_member_ids = set(membership_result.scalars().all())
    invalid_user_ids = referenced_user_ids - group_member_ids
    if invalid_user_ids:
        raise HTTPException(
            status_code=400,
            detail="Payer and all split recipients must be members of this group",
        )

    if not expense_in.splits:
        raise HTTPException(status_code=400, detail="At least one expense split is required")

    # Verify the sum of splits equals the total amount.
    total_split = sum(split.amount_owed for split in expense_in.splits)
    if abs(total_split - expense_in.amount) > 0.01:
        raise HTTPException(status_code=400, detail="Splits do not equal total amount")

    # Create Expense
    new_expense = Expense(
        group_id=expense_in.group_id,
        paid_by=expense_in.paid_by,
        amount=expense_in.amount,
        description=expense_in.description,
        category=expense_in.category,
        receipt_url=expense_in.receipt_url,
        expense_date=expense_in.expense_date
    )
    db.add(new_expense)
    await db.flush() # To get new_expense.id

    # Create Splits
    for split_in in expense_in.splits:
        split = ExpenseSplit(
            expense_id=new_expense.id,
            user_id=split_in.user_id,
            amount_owed=split_in.amount_owed
        )
        db.add(split)
        
    await db.commit()
    
    # Invalidate cache for everyone in this group
    await invalidate_group_cache(expense_in.group_id, db)
    
    # Reload with splits and group info
    result = await db.execute(
        select(Expense)
        .options(selectinload(Expense.splits), selectinload(Expense.group))
        .where(Expense.id == new_expense.id)
    )
    expense = result.scalars().first()
    
    # Enrich for DTO
    if expense.group:
        expense.group_name = expense.group.name
        expense.group_emoji = expense.group.emoji
        
    return expense

@router.get("", response_model=List[ExpenseOut])
async def list_expenses(
    group_id: int = None,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    user_uuid = uuid.UUID(user_id)
    
    query = select(Expense).options(selectinload(Expense.splits), selectinload(Expense.group))
    
    if group_id:
        query = query.where(Expense.group_id == group_id)
    else:
        # Get expenses for all groups the user is a part of
        query = (
            query.join(GroupMember, GroupMember.group_id == Expense.group_id)
            .where(GroupMember.user_id == user_uuid)
        )
                     
    result = await db.execute(query.order_by(Expense.created_at.desc()))
    expenses = result.scalars().all()
    
    # Enrich DTO fields
    for e in expenses:
        if e.group:
            e.group_name = e.group.name
            e.group_emoji = e.group.emoji
            
    return expenses
