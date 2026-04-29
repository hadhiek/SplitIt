from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
import uuid

from core.database import get_db
from core.security import get_current_user_id
from core.cache import invalidate_group_cache
from models.domain import Loan, GroupMember, User, Notification
from schemas.dto import LoanCreate, LoanOut

router = APIRouter(prefix="/api/loans", tags=["loans"])


@router.post("", response_model=LoanOut)
async def create_loan(
    loan_in: LoanCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Give money (loan) to the group admin."""
    lender_uuid = uuid.UUID(user_id)

    # 1. Verify lender is a member of the group
    member_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == loan_in.group_id,
            GroupMember.user_id == lender_uuid
        )
    )
    if not member_check.scalars().first():
        raise HTTPException(status_code=403, detail="You are not a member of this group.")

    # 2. Find the group admin (recipient)
    admin_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == loan_in.group_id,
            GroupMember.role == "admin"
        )
    )
    admin_member = admin_check.scalars().first()
    if not admin_member:
        raise HTTPException(status_code=404, detail="No admin found for this group.")

    receiver_uuid = admin_member.user_id

    # 3. Cannot loan to yourself
    if lender_uuid == receiver_uuid:
        raise HTTPException(status_code=400, detail="Admin cannot give money to themselves.")

    # 4. Create the loan
    new_loan = Loan(
        group_id=loan_in.group_id,
        from_user=lender_uuid,
        to_user=receiver_uuid,
        amount=loan_in.amount,
        note=loan_in.note
    )
    db.add(new_loan)

    # 5. Notify the admin
    lender_res = await db.execute(select(User).where(User.id == lender_uuid))
    lender = lender_res.scalars().first()
    lender_name = lender.full_name if lender else "Someone"

    notification = Notification(
        user_id=receiver_uuid,
        message=f"{lender_name} gave you ₹{loan_in.amount} in the group.",
        type="info"
    )
    db.add(notification)

    await db.commit()
    await db.refresh(new_loan)

    # Invalidate cache for everyone in this group
    await invalidate_group_cache(loan_in.group_id, db)

    # 6. Fetch admin name for response
    admin_res = await db.execute(select(User).where(User.id == receiver_uuid))
    admin_user = admin_res.scalars().first()

    return LoanOut(
        id=new_loan.id,
        group_id=new_loan.group_id,
        from_user=new_loan.from_user,
        to_user=new_loan.to_user,
        amount=float(new_loan.amount),
        note=new_loan.note,
        created_at=new_loan.created_at,
        from_user_name=lender_name,
        to_user_name=admin_user.full_name if admin_user else "Admin"
    )


@router.get("/{group_id}", response_model=List[LoanOut])
async def list_group_loans(
    group_id: int,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """List all loans in a group."""
    current_user_uuid = uuid.UUID(user_id)

    # Verify membership
    member_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == current_user_uuid
        )
    )
    if not member_check.scalars().first():
        raise HTTPException(status_code=403, detail="Not authorized.")

    # Fetch all loans for the group
    result = await db.execute(
        select(Loan)
        .where(Loan.group_id == group_id)
        .order_by(Loan.created_at.desc())
    )
    loans = result.scalars().all()

    # Resolve user names
    user_ids = set()
    for loan in loans:
        user_ids.add(loan.from_user)
        user_ids.add(loan.to_user)

    users_res = await db.execute(select(User).where(User.id.in_(user_ids)))
    user_map = {u.id: u.full_name for u in users_res.scalars().all()}

    return [
        LoanOut(
            id=loan.id,
            group_id=loan.group_id,
            from_user=loan.from_user,
            to_user=loan.to_user,
            amount=float(loan.amount),
            note=loan.note,
            created_at=loan.created_at,
            from_user_name=user_map.get(loan.from_user, "Unknown"),
            to_user_name=user_map.get(loan.to_user, "Unknown")
        )
        for loan in loans
    ]
