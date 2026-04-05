from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func as sqlfunc
from typing import List
import uuid

from core.database import get_db
from core.security import get_current_user_id, get_current_user_payload
from models.domain import User, JoinRequest, GroupMember, Expense, ExpenseSplit, Settlement, Group, Loan
from schemas.dto import UserOut, JoinRequestOut, DashboardSummaryOut

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
    
    # Fetch totals using SQL aggregation for efficiency
    try:
        print(f"DEBUG: Fetching dashboard summary for user {user_uuid}")
        # 1. Net Balance per Group for this user
        members_count_sq = (
            select(sqlfunc.count(GroupMember.user_id))
            .where(GroupMember.group_id == Group.id)
            .correlate(Group)
            .scalar_subquery()
        )

        user_paid_sq = (
            select(sqlfunc.coalesce(sqlfunc.sum(Expense.amount), 0))
            .where(Expense.group_id == Group.id, Expense.paid_by == user_uuid)
            .correlate(Group)
            .scalar_subquery()
        )
        user_owed_sq = (
            select(sqlfunc.coalesce(sqlfunc.sum(ExpenseSplit.amount_owed), 0))
            .join(Expense, Expense.id == ExpenseSplit.expense_id)
            .where(Expense.group_id == Group.id, ExpenseSplit.user_id == user_uuid)
            .correlate(Group)
            .scalar_subquery()
        )
        user_sent_sq = (
            select(sqlfunc.coalesce(sqlfunc.sum(Settlement.amount), 0))
            .where(Settlement.group_id == Group.id, Settlement.from_user == user_uuid)
            .correlate(Group)
            .scalar_subquery()
        )
        user_received_sq = (
            select(sqlfunc.coalesce(sqlfunc.sum(Settlement.amount), 0))
            .where(Settlement.group_id == Group.id, Settlement.to_user == user_uuid)
            .correlate(Group)
            .scalar_subquery()
        )

        net_balance_sq = (user_paid_sq - user_owed_sq + user_sent_sq - user_received_sq).label("net_balance")

        # Loan subqueries
        loans_given_sq = (
            select(sqlfunc.coalesce(sqlfunc.sum(Loan.amount), 0))
            .where(Loan.group_id == Group.id, Loan.from_user == user_uuid)
            .correlate(Group)
            .scalar_subquery()
        )
        loans_received_sq = (
            select(sqlfunc.coalesce(sqlfunc.sum(Loan.amount), 0))
            .where(Loan.group_id == Group.id, Loan.to_user == user_uuid)
            .correlate(Group)
            .scalar_subquery()
        )

        net_balance_with_loans_sq = (user_paid_sq - user_owed_sq + user_sent_sq - user_received_sq + loans_given_sq - loans_received_sq).label("net_balance")

        # Final Summary Query
        summary_query = (
            select(net_balance_with_loans_sq)
            .select_from(GroupMember)
            .join(Group, Group.id == GroupMember.group_id)
            .where(GroupMember.user_id == user_uuid)
        )
        
        print("DEBUG: Executing summary query...")
        summary_result = await db.execute(summary_query)
        balances = summary_result.scalars().all()
        print(f"DEBUG: Found {len(balances)} group balances")
        
        total_owe = 0.0
        total_owed = 0.0
        for bal in balances:
            if bal is None:
                continue
            b = float(bal)
            if b > 0.01:
                total_owed += b
            elif b < -0.01:
                total_owe += abs(b)

        # 4. Count pending approvals for admin groups
        admin_memberships_res = await db.execute(
            select(GroupMember.group_id).where(GroupMember.user_id == user_uuid, GroupMember.role.in_(('admin', 'co-admin')))
        )
        admin_group_ids = admin_memberships_res.scalars().all()
        
        pending_approvals_count = 0
        if admin_group_ids:
            approvals_res = await db.execute(
                select(sqlfunc.count(JoinRequest.id)).where(JoinRequest.group_id.in_(admin_group_ids), JoinRequest.status == 'pending')
            )
            pending_approvals_count = approvals_res.scalar() or 0

        # 5. Fetch latest 5 expenses
        print("DEBUG: Fetching recent expenses...")
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
        
        for e in recent_expenses:
            if e.group:
                e.group_name = e.group.name
                e.group_emoji = e.group.emoji

        print("DEBUG: Dashboard summary complete")
        return DashboardSummaryOut(
            groups_count=len(balances),
            total_owe=round(total_owe, 2),
            total_owed=round(total_owed, 2),
            pending_approvals_count=pending_approvals_count,
            recent_expenses=recent_expenses
        )
    except Exception as e:
        print(f"ERROR in get_dashboard_summary: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Dashboard calculation error: {str(e)}")

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
