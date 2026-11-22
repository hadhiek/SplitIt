from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
import uuid
from datetime import datetime, timedelta, timezone

from core.database import get_db
from core.security import get_current_user_id
from models.domain import Notification, Group, GroupMember, Expense, Settlement
from schemas.dto import NotificationOut

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

@router.post("/groups/{group_id}/remind-debtors")
async def remind_group_debtors(
    group_id: int,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Allow a group admin to send an in-app reminder to members with a negative balance."""
    caller_uuid = uuid.UUID(user_id)
    members_result = await db.execute(select(GroupMember).where(GroupMember.group_id == group_id))
    members = members_result.scalars().all()
    caller = next((member for member in members if member.user_id == caller_uuid), None)
    if caller is None:
        raise HTTPException(status_code=403, detail="Not a member of this group")
    if caller.role not in {"admin", "co-admin"}:
        raise HTTPException(status_code=403, detail="Only group admins can send payment reminders")

    group_result = await db.execute(select(Group).where(Group.id == group_id))
    group = group_result.scalars().first()
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")

    member_ids = {member.user_id for member in members}
    balances = {member_id: 0.0 for member_id in member_ids}
    expenses_result = await db.execute(select(Expense).options(selectinload(Expense.splits)).where(Expense.group_id == group_id))
    for expense in expenses_result.scalars().all():
        if expense.paid_by in balances:
            balances[expense.paid_by] += float(expense.amount)
        for split in expense.splits:
            if split.user_id in balances:
                balances[split.user_id] -= float(split.amount_owed)
    settlements_result = await db.execute(select(Settlement).where(Settlement.group_id == group_id, Settlement.status == "completed"))
    for settlement in settlements_result.scalars().all():
        if settlement.from_user in balances:
            balances[settlement.from_user] += float(settlement.amount)
        if settlement.to_user in balances:
            balances[settlement.to_user] -= float(settlement.amount)

    debtors = [(member_id, round(-balance, 2)) for member_id, balance in balances.items() if balance < -0.005]
    cutoff = datetime.now(timezone.utc) - timedelta(hours=2)
    debtor_ids = [member_id for member_id, _ in debtors]
    recent_result = await db.execute(select(Notification.user_id).where(
        Notification.user_id.in_(debtor_ids),
        Notification.type == "warning",
        Notification.message.like("Reminder:%"),
        Notification.created_at >= cutoff,
    )) if debtor_ids else None
    recently_reminded = {row[0] for row in recent_result.all()} if recent_result else set()
    sent_count = 0
    skipped_count = 0
    for member_id, amount in debtors:
        if member_id in recently_reminded:
            skipped_count += 1
            continue
        db.add(Notification(
            user_id=member_id,
            message=f"Reminder: you owe ₹{amount:.2f} in {group.name}. Please review the group and settle when ready.",
            type="warning",
        ))
        sent_count += 1
    await db.commit()
    return {"reminded_count": sent_count, "cooldown_skipped": skipped_count, "cooldown_hours": 2}

@router.get("", response_model=List[NotificationOut])
async def get_notifications(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Fetch notifications for the current user."""
    user_uuid = uuid.UUID(user_id)
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user_uuid)
        .order_by(Notification.created_at.desc())
    )
    return result.scalars().all()

@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_notification_read(
    notification_id: int,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Mark a single notification as read."""
    user_uuid = uuid.UUID(user_id)
    result = await db.execute(
        select(Notification)
        .where(Notification.id == notification_id, Notification.user_id == user_uuid)
    )
    notification = result.scalars().first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    notification.read = True
    await db.commit()
    await db.refresh(notification)
    return notification

@router.post("/read-all")
async def mark_all_notifications_read(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    """Mark all notifications as read for current user."""
    user_uuid = uuid.UUID(user_id)
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user_uuid, Notification.read == False)
    )
    notifications = result.scalars().all()
    for notif in notifications:
        notif.read = True
        
    await db.commit()
    return {"message": f"{len(notifications)} notifications marked as read"}
