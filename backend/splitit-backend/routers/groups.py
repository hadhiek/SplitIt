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
from models.domain import Group, GroupMember, JoinRequest, Notification
from schemas.dto import (
    GroupCreate, GroupOut, GroupDetailOut,
    JoinGroupIn, JoinRequestOut, JoinRequestAction
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
    # Fetch groups with members and expenses
    from models.domain import Expense, ExpenseSplit, Settlement
    result = await db.execute(
        select(Group)
        .join(GroupMember)
        .options(
            selectinload(Group.members),
            selectinload(Group.expenses).selectinload(Expense.splits)
        )
        .where(GroupMember.user_id == user_uuid)
        .order_by(Group.created_at.desc())
    )
    groups = result.scalars().all()

    # Pre-fetch settlements for all these groups to avoid N+1
    group_ids = [g.id for g in groups]
    settlements_res = await db.execute(
        select(Settlement).where(Settlement.group_id.in_(group_ids))
    )
    all_settlements = settlements_res.scalars().all()
    
    # Enrich groups with stats
    for g in groups:
        # 1. Member Count
        g.members_count = len(g.members)
        
        # 2. Total Settled
        g_settlements = [s for s in all_settlements if s.group_id == g.id]
        g.total_settled = sum(float(s.amount) for s in g_settlements)
        
        # 3. User Balance
        balance = 0.0
        # From expenses
        for exp in g.expenses:
            if exp.paid_by == user_uuid:
                balance += float(exp.amount)
            for split in exp.splits:
                if split.user_id == user_uuid:
                    balance -= float(split.amount_owed)
        # From settlements
        for s in g_settlements:
            if s.from_user == user_uuid:
                balance += float(s.amount)
            if s.to_user == user_uuid:
                balance -= float(s.amount)
        
        g.user_balance = round(balance, 2)

    return groups


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
    from models.domain import Expense, ExpenseSplit, Settlement
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
        # Sender gives money (increases their "payment" balance)
        user_balances[s.from_user] += float(s.amount)
        # Receiver gets money (decreases their "outstanding claim" balance)
        user_balances[s.to_user] -= float(s.amount)

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
