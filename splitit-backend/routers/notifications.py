from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
import uuid

from core.database import get_db
from core.security import get_current_user_id
from models.domain import Notification
from schemas.dto import NotificationOut

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

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
