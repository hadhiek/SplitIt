from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
from core.database import get_db
from core.security import get_current_user_id, get_current_user_payload
from models.domain import User, JoinRequest, GroupMember, Expense, ExpenseSplit, Settlement
from schemas.dto import UserOut, JoinRequestOut, DashboardSummaryOut
import uuid

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/me", response_model=UserOut)
async def get_current_user_profile(
    payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = payload.get("sub")
    user_uuid = uuid.UUID(user_id)
    
    # Extract real name from JWT user_metadata (set during Supabase signup)
    user_metadata = payload.get("user_metadata", {})
    jwt_full_name = user_metadata.get("full_name", "").strip()
    jwt_email = payload.get("email", "")
    
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalars().first()
    
    if not user:
        # Create user with real name from JWT metadata
        display_name = jwt_full_name or jwt_email.split("@")[0] if jwt_email else "New User"
        user = User(
            id=user_uuid,
            full_name=display_name
        )
        db.add(user)
        try:
            await db.commit()
            await db.refresh(user)
        except Exception:
            await db.rollback()
            raise HTTPException(status_code=500, detail="Could not sync user profile")
    elif user.full_name in ("New User", "Anonymous", ""):
        # Fix existing users who were created with placeholder names
        display_name = jwt_full_name or jwt_email.split("@")[0] if jwt_email else "New User"
        if display_name and display_name != user.full_name:
            user.full_name = display_name
            await db.commit()
            await db.refresh(user)
            
    return user

@router.get("/me/dashboard-summary", response_model=DashboardSummaryOut)
async def get_dashboard_summary(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    user_uuid = uuid.UUID(user_id)
    
    # 1. Fetch all groups user is a member of
    members_res = await db.execute(select(GroupMember).where(GroupMember.user_id == user_uuid))
    memberships = members_res.scalars().all()
    group_ids = [m.group_id for m in memberships]
    
    total_owe = 0.0
    total_owed = 0.0
    
    if group_ids:
        # 2. Fetch all expenses for those groups
        expenses_res = await db.execute(
            select(Expense).options(selectinload(Expense.splits))
            .where(Expense.group_id.in_(group_ids))
        )
        all_expenses = expenses_res.scalars().all()
        
        # 3. Fetch all settlements for those groups
        settlements_res = await db.execute(
            select(Settlement).where(Settlement.group_id.in_(group_ids))
        )
        all_settlements = settlements_res.scalars().all()
        
        # Calculate balance per group
        for g_id in group_ids:
            group_bal = 0.0
            # From expenses
            g_expenses = [e for e in all_expenses if e.group_id == g_id]
            for exp in g_expenses:
                if exp.paid_by == user_uuid:
                    group_bal += float(exp.amount)
                for split in exp.splits:
                    if split.user_id == user_uuid:
                        group_bal -= float(split.amount_owed)
            
            # From settlements
            g_settlements = [s for s in all_settlements if s.group_id == g_id]
            for s in g_settlements:
                if s.from_user == user_uuid:
                    group_bal += float(s.amount)
                if s.to_user == user_uuid:
                    group_bal -= float(s.amount)
            
            if group_bal > 0.01:
                total_owed += group_bal
            elif group_bal < -0.01:
                total_owe += abs(group_bal)

    # 4. Count pending approvals for admin groups
    admin_group_ids = [m.group_id for m in memberships if m.role in ('admin', 'co-admin')]
    pending_approvals_count = 0
    if admin_group_ids:
        approvals_res = await db.execute(
            select(JoinRequest).where(JoinRequest.group_id.in_(admin_group_ids), JoinRequest.status == 'pending')
        )
        pending_approvals_count = len(approvals_res.scalars().all())

    # 5. Fetch latest 5 expenses involving user
    # Involving user means: user paid it OR user is in the splits
    recent_expenses_res = await db.execute(
        select(Expense)
        .options(selectinload(Expense.splits), selectinload(Expense.group))
        .join(ExpenseSplit, ExpenseSplit.expense_id == Expense.id, isouter=True)
        .where((Expense.paid_by == user_uuid) | (ExpenseSplit.user_id == user_uuid))
        .distinct()
        .order_by(Expense.created_at.desc())
        .limit(5)
    )
    recent_expenses = recent_expenses_res.scalars().all()
    
    # Map group details to expense objects for the DTO
    for e in recent_expenses:
        if e.group:
            e.group_name = e.group.name
            e.group_emoji = e.group.emoji

    return DashboardSummaryOut(
        groups_count=len(group_ids),
        total_owe=round(total_owe, 2),
        total_owed=round(total_owed, 2),
        pending_approvals_count=pending_approvals_count,
        recent_expenses=recent_expenses
    )

@router.patch("/me", response_model=UserOut)
async def update_my_profile(
    updates: dict,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Update the current user's profile (full_name, avatar_url)."""
    user_uuid = uuid.UUID(user_id)
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if "full_name" in updates and updates["full_name"].strip():
        user.full_name = updates["full_name"].strip()
    if "avatar_url" in updates:
        user.avatar_url = updates["avatar_url"]
    
    await db.commit()
    await db.refresh(user)
    return user

@router.get("/me/join-requests", response_model=List[JoinRequestOut])
async def get_my_join_requests(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Fetch the current user's join requests (to see accepted/rejected status)."""
    user_uuid = uuid.UUID(user_id)
    result = await db.execute(
        select(JoinRequest)
        .options(selectinload(JoinRequest.group))
        .where(JoinRequest.user_id == user_uuid)
        .order_by(JoinRequest.created_at.desc())
    )
    requests = result.scalars().all()
    return [
        JoinRequestOut(
            id=r.id,
            group_id=r.group_id,
            user_id=r.user_id,
            status=r.status,
            created_at=r.created_at,
            responded_at=r.responded_at,
            group_name=r.group.name if r.group else None,
            group_emoji=r.group.emoji if r.group else None
        )
        for r in requests
    ]
