from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import uuid

from core.database import get_db
from core.security import get_current_user_id
from models.domain import Loan, GroupMember, User, Notification
from schemas.dto import LoanCreate, LoanOut

router = APIRouter(prefix="/api/loans", tags=["loans"])

@router.post("", response_model=LoanOut)
async def create_loan(loan_in: LoanCreate, user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    lender = uuid.UUID(user_id)
    if loan_in.amount <= 0:
        raise HTTPException(status_code=400, detail="Loan amount must be positive")
    member_result = await db.execute(select(GroupMember).where(GroupMember.group_id == loan_in.group_id))
    members = member_result.scalars().all()
    if not any(member.user_id == lender for member in members):
        raise HTTPException(status_code=403, detail="You are not a member of this group")
    admin = next((member for member in members if member.role == "admin"), None)
    if admin is None or admin.user_id == lender:
        raise HTTPException(status_code=400, detail="A group admin must receive the loan from another member")
    loan = Loan(group_id=loan_in.group_id, from_user=lender, to_user=admin.user_id, amount=loan_in.amount, note=loan_in.note)
    db.add(loan)
    lender_result = await db.execute(select(User).where(User.id == lender))
    lender_user = lender_result.scalars().first()
    db.add(Notification(user_id=admin.user_id, message=f"{lender_user.full_name if lender_user else 'A member'} gave you ₹{loan_in.amount:.2f} in the group.", type="info"))
    await db.commit()
    await db.refresh(loan)
    return LoanOut(id=loan.id, group_id=loan.group_id, from_user=loan.from_user, to_user=loan.to_user, amount=float(loan.amount), note=loan.note, created_at=loan.created_at, from_user_name=lender_user.full_name if lender_user else "Member", to_user_name="Admin")

@router.get("/{group_id}", response_model=list[LoanOut])
async def list_group_loans(group_id: int, user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    current_user = uuid.UUID(user_id)
    member_result = await db.execute(select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == current_user))
    if not member_result.scalars().first():
        raise HTTPException(status_code=403, detail="Not authorized")
    result = await db.execute(select(Loan).where(Loan.group_id == group_id).order_by(Loan.created_at.desc()))
    loans = result.scalars().all()
    ids = {user_id for loan in loans for user_id in (loan.from_user, loan.to_user)}
    users_result = await db.execute(select(User).where(User.id.in_(ids))) if ids else None
    names = {user.id: user.full_name for user in users_result.scalars().all()} if users_result else {}
    return [LoanOut(id=loan.id, group_id=loan.group_id, from_user=loan.from_user, to_user=loan.to_user, amount=float(loan.amount), note=loan.note, created_at=loan.created_at, from_user_name=names.get(loan.from_user, "Unknown"), to_user_name=names.get(loan.to_user, "Unknown")) for loan in loans]
