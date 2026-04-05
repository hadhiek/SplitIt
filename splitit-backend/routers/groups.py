from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func as sqlfunc
from typing import List
import uuid
from uuid import UUID
import string
import random
from datetime import datetime, timezone

from core.database import get_db
from core.security import get_current_user_id
from models.domain import Group, GroupMember, JoinRequest, Notification, Expense, ExpenseSplit, Settlement, Loan
from schemas.dto import (
    GroupCreate, GroupOut, GroupDetailOut,
    JoinGroupIn, JoinRequestOut, JoinRequestAction,
    ExpenseOut
)

router = APIRouter(prefix="/api/groups", tags=["groups"])


def generate_invite_code(length=8):
    """Generate a random alphanumeric invite code."""
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=length))


@router.get("", response_model=List[GroupOut])
async def list_user_groups(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    user_uuid = uuid.UUID(user_id)
    try:
        print(f"DEBUG: Listing groups for user {user_uuid}")
        # Subqueries for aggregation
        members_count_sq = (
            select(sqlfunc.count(GroupMember.user_id))
            .where(GroupMember.group_id == Group.id)
            .correlate(Group)
            .scalar_subquery()
            .label("members_count")
        )

        total_settled_sq = (
            select(sqlfunc.coalesce(sqlfunc.sum(Settlement.amount), 0))
            .where(Settlement.group_id == Group.id)
            .correlate(Group)
            .scalar_subquery()
            .label("total_settled")
        )

        # User Balance Components
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

        user_balance_sq = (user_paid_sq - user_owed_sq + user_sent_sq - user_received_sq).label("user_balance")

        # Loan components
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

        user_balance_with_loans_sq = (user_paid_sq - user_owed_sq + user_sent_sq - user_received_sq + loans_given_sq - loans_received_sq).label("user_balance")

        # Main Query - Explicitly select from Group first to avoid join ambiguity
        query = (
            select(
                Group,
                members_count_sq,
                total_settled_sq,
                user_balance_with_loans_sq
            )
            .select_from(Group)
            .join(GroupMember, GroupMember.group_id == Group.id)
            .where(GroupMember.user_id == user_uuid)
            .order_by(Group.created_at.desc())
        )

        print("DEBUG: Executing group list query...")
        result = await db.execute(query)
        
        groups = []
        for row in result.all():
            g = row[0]
            # Attach aggregated fields to the object with null safety
            g.members_count = int(row[1]) if row[1] is not None else 0
            g.total_settled = float(row[2]) if row[2] is not None else 0.0
            g.user_balance = round(float(row[3]), 2) if row[3] is not None else 0.0
            groups.append(g)

        print(f"DEBUG: Found {len(groups)} groups")
        return groups
    except Exception as e:
        print(f"ERROR in list_user_groups: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Database error while listing groups: {str(e)}")


@router.post("", response_model=GroupOut)
async def create_group(
    group_in: GroupCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    # Generate a unique invite code
    for _ in range(10):  # retry up to 10 times for uniqueness
        code = generate_invite_code()
        existing = await db.execute(select(Group).where(Group.invite_code == code))
        if not existing.scalars().first():
            break
    else:
        raise HTTPException(status_code=500, detail="Could not generate unique invite code")

    new_group = Group(
        name=group_in.name,
        description=group_in.description,
        emoji=group_in.emoji,
        invite_code=code,
        created_by=uuid.UUID(user_id)
    )
    db.add(new_group)
    await db.flush()

    member = GroupMember(
        group_id=new_group.id,
        user_id=uuid.UUID(user_id),
        role="admin"
    )
    db.add(member)
    await db.commit()
    await db.refresh(new_group)
    return new_group


@router.get("/{group_id}", response_model=GroupDetailOut)
async def get_group_details(
    group_id: int,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Group)
        .options(
            selectinload(Group.members).selectinload(GroupMember.user),
            selectinload(Group.expenses).selectinload(Expense.splits)
        )
        .where(Group.id == group_id)
    )
    group = result.scalars().first()

    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    is_member = any(m.user_id == UUID(user_id) for m in group.members)
    if not is_member:
        raise HTTPException(status_code=403, detail="Not authorized to view this group")

    # Retroactive invite code generation (if missing)
    if not group.invite_code:
        # User must be an admin to generate/fix the code
        is_admin = any(m.user_id == UUID(user_id) and m.role == "admin" for m in group.members)
        if is_admin:
            for _ in range(10):
                code = generate_invite_code()
                existing = await db.execute(select(Group).where(Group.invite_code == code))
                if not existing.scalars().first():
                    group.invite_code = code
                    await db.commit()
                    await db.refresh(group)
                    break

    return group

@router.delete("/{group_id}")
async def delete_group(
    group_id: int,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Soft-delete a group if all balances are settled."""
    user_uuid = uuid.UUID(user_id)

    # 1. Fetch group with members, expenses, and settlements
    result = await db.execute(
        select(Group)
        .options(
            selectinload(Group.members),
            selectinload(Group.expenses).selectinload(Expense.splits)
        )
        .where(Group.id == group_id)
    )
    group = result.scalars().first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # 2. Check if user is admin
    is_admin = any(m.user_id == user_uuid and m.role == "admin" for m in group.members)
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can delete groups")

    # 3. Calculate balances
    # We need all settlements too
    res_settlements = await db.execute(select(Settlement).where(Settlement.group_id == group_id))
    settlements = res_settlements.scalars().all()

    user_balances = {} # dict of UUID -> float
    for m in group.members:
        user_balances[m.user_id] = 0.0

    # Subtract/Add from expenses
    for exp in group.expenses:
        # Money spent by payer
        user_balances[exp.paid_by] += float(exp.amount)
        # Money owed by people in splits
        for split in exp.splits:
            if split.user_id in user_balances:
                user_balances[split.user_id] -= float(split.amount_owed)

    # Add/Subtract from settlements
    for s in settlements:
        user_balances[s.from_user] += float(s.amount)
        user_balances[s.to_user] -= float(s.amount)

    # Add/Subtract from loans
    res_loans = await db.execute(select(Loan).where(Loan.group_id == group_id))
    group_loans = res_loans.scalars().all()
    for loan in group_loans:
        if loan.from_user in user_balances:
            user_balances[loan.from_user] += float(loan.amount)
        if loan.to_user in user_balances:
            user_balances[loan.to_user] -= float(loan.amount)

    # 4. Verify all balances are zero (within floating point error)
    for uid, balance in user_balances.items():
        if abs(balance) > 0.05: # Using small epsilon for currency
            raise HTTPException(
                status_code=400, 
                detail="Cannot delete group. There are still unsettled balances."
            )

    # 5. Soft delete
    group.is_active = False
    await db.commit()
    return {"message": "Group has been moved to history."}


# ─── Join Request Endpoints ─────────────────────────────────────────

@router.post("/join", response_model=JoinRequestOut)
async def join_group_by_code(
    body: JoinGroupIn,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """User submits an invite code to request joining a group."""
    user_uuid = uuid.UUID(user_id)

    # Find the group by invite code
    result = await db.execute(
        select(Group).where(Group.invite_code == body.invite_code.strip().upper())
    )
    group = result.scalars().first()
    if not group:
        raise HTTPException(status_code=404, detail="Invalid invite code. No group found.")

    # Check if already a member
    member_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group.id,
            GroupMember.user_id == user_uuid
        )
    )
    if member_check.scalars().first():
        raise HTTPException(status_code=400, detail="You are already a member of this group.")

    # Check if a pending request already exists
    existing_req = await db.execute(
        select(JoinRequest).where(
            JoinRequest.group_id == group.id,
            JoinRequest.user_id == user_uuid,
            JoinRequest.status == "pending"
        )
    )
    if existing_req.scalars().first():
        raise HTTPException(status_code=400, detail="You already have a pending request for this group.")

    # Create the join request
    join_req = JoinRequest(
        group_id=group.id,
        user_id=user_uuid,
        status="pending"
    )
    db.add(join_req)

    # Notify the admin(s)
    admins_result = await db.execute(
        select(GroupMember).where(GroupMember.group_id == group.id, GroupMember.role == "admin")
    )
    for admin in admins_result.scalars().all():
        notification = Notification(
            user_id=admin.user_id,
            message=f"A user wants to join your group '{group.name}'",
            type="info"
        )
        db.add(notification)

    await db.commit()
    await db.refresh(join_req)

    # Return with group info
    return JoinRequestOut(
        id=join_req.id,
        group_id=join_req.group_id,
        user_id=join_req.user_id,
        status=join_req.status,
        created_at=join_req.created_at,
        group_name=group.name,
        group_emoji=group.emoji
    )


@router.get("/{group_id}/requests", response_model=List[JoinRequestOut])
async def get_group_join_requests(
    group_id: int,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Admin fetches all pending join requests for a group."""
    user_uuid = uuid.UUID(user_id)

    # Verify the requester is an admin of this group
    admin_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_uuid,
            GroupMember.role == "admin"
        )
    )
    if not admin_check.scalars().first():
        raise HTTPException(status_code=403, detail="Only admins can view join requests.")

    # Fetch pending requests with user info
    result = await db.execute(
        select(JoinRequest)
        .options(selectinload(JoinRequest.user))
        .where(
            JoinRequest.group_id == group_id,
            JoinRequest.status == "pending"
        )
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
            user=r.user
        )
        for r in requests
    ]


@router.post("/{group_id}/requests/{request_id}/action", response_model=JoinRequestOut)
async def action_join_request(
    group_id: int,
    request_id: int,
    body: JoinRequestAction,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Admin accepts or rejects a join request."""
    user_uuid = uuid.UUID(user_id)

    # Verify admin
    admin_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_uuid,
            GroupMember.role == "admin"
        )
    )
    if not admin_check.scalars().first():
        raise HTTPException(status_code=403, detail="Only admins can manage join requests.")

    # Fetch the request
    result = await db.execute(
        select(JoinRequest)
        .options(selectinload(JoinRequest.user))
        .where(JoinRequest.id == request_id, JoinRequest.group_id == group_id)
    )
    join_req = result.scalars().first()
    if not join_req:
        raise HTTPException(status_code=404, detail="Join request not found.")
    if join_req.status != "pending":
        raise HTTPException(status_code=400, detail="This request has already been processed.")

    action = body.action.lower()
    if action not in ("accept", "reject"):
        raise HTTPException(status_code=400, detail="Action must be 'accept' or 'reject'.")

    join_req.status = "accepted" if action == "accept" else "rejected"
    join_req.responded_at = datetime.now(timezone.utc)

    if action == "accept":
        # Add the user as a member
        new_member = GroupMember(
            group_id=group_id,
            user_id=join_req.user_id,
            role="member"
        )
        db.add(new_member)

    # Notify the user
    # Need to fetch the group name to provide a nice message
    group_res = await db.execute(select(Group).where(Group.id == group_id))
    grp = group_res.scalars().first()
    gname = grp.name if grp else "a group"
    
    notification = Notification(
        user_id=join_req.user_id,
        message=f"Your request to join '{gname}' was {join_req.status}.",
        type="success" if action == "accept" else "error"
    )
    db.add(notification)

    await db.commit()
    await db.refresh(join_req)

    return JoinRequestOut(
        id=join_req.id,
        group_id=join_req.group_id,
        user_id=join_req.user_id,
        status=join_req.status,
        created_at=join_req.created_at,
        responded_at=join_req.responded_at,
        user=join_req.user
    )
