from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func as sqlfunc
import uuid
from typing import List

from core.database import get_db
from core.security import get_current_user_id
from models.domain import Settlement, Expense, ExpenseSplit, GroupMember, User, Notification, Loan
from schemas.dto import (
    SettlementCreate, SettlementOut, SettlementDetailOut,
    GroupBalancesOut, UserBalance, SuggestedSettlement
)

from schemas.dto import GlobalSettlementsOut, GroupSuggestedSettlements

router = APIRouter(prefix="/api/settlements", tags=["settlements"])

@router.post("", response_model=SettlementOut)
async def record_settlement(
    settlement_in: SettlementCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    sender_uuid = uuid.UUID(user_id)
    recipient_uuid = settlement_in.to_user
    
    # Verify sender is in the group
    member_check = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == settlement_in.group_id,
            GroupMember.user_id == sender_uuid
        )
    )
    if not member_check.scalars().first():
        raise HTTPException(status_code=403, detail="Not a member of this group")

    # Insert a new settlement record
    new_settlement = Settlement(
        group_id=settlement_in.group_id,
        from_user=sender_uuid,
        to_user=recipient_uuid,
        amount=settlement_in.amount,
        payment_method=settlement_in.payment_method,
        status='completed'
    )
    
    db.add(new_settlement)

    # Notify the recipient
    sender_res = await db.execute(select(User).where(User.id == sender_uuid))
    sender = sender_res.scalars().first()
    sender_name = sender.full_name if sender else "Someone"
    
    notification = Notification(
        user_id=recipient_uuid,
        message=f"{sender_name} settled ₹{settlement_in.amount} with you.",
        type="success"
    )
    db.add(notification)

    await db.commit()
    await db.refresh(new_settlement)
    return new_settlement

@router.get("/balances/{group_id}", response_model=GroupBalancesOut)
async def get_group_balances(
    group_id: int,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    current_user_uuid = uuid.UUID(user_id)
    
    # Use subqueries for each balance component per user in the group
    user_paid_sq = (
        select(sqlfunc.coalesce(sqlfunc.sum(Expense.amount), 0))
        .where(Expense.group_id == group_id, Expense.paid_by == GroupMember.user_id)
        .scalar_subquery()
    )
    user_owed_sq = (
        select(sqlfunc.coalesce(sqlfunc.sum(ExpenseSplit.amount_owed), 0))
        .join(Expense, Expense.id == ExpenseSplit.expense_id)
        .where(Expense.group_id == group_id, ExpenseSplit.user_id == GroupMember.user_id)
        .scalar_subquery()
    )
    user_sent_sq = (
        select(sqlfunc.coalesce(sqlfunc.sum(Settlement.amount), 0))
        .where(Settlement.group_id == group_id, Settlement.from_user == GroupMember.user_id)
        .scalar_subquery()
    )
    user_received_sq = (
        select(sqlfunc.coalesce(sqlfunc.sum(Settlement.amount), 0))
        .where(Settlement.group_id == group_id, Settlement.to_user == GroupMember.user_id)
        .scalar_subquery()
    )
    # Loan subqueries: loans_given increases balance, loans_received decreases it
    loans_given_sq = (
        select(sqlfunc.coalesce(sqlfunc.sum(Loan.amount), 0))
        .where(Loan.group_id == group_id, Loan.from_user == GroupMember.user_id)
        .scalar_subquery()
    )
    loans_received_sq = (
        select(sqlfunc.coalesce(sqlfunc.sum(Loan.amount), 0))
        .where(Loan.group_id == group_id, Loan.to_user == GroupMember.user_id)
        .scalar_subquery()
    )

    # Main Query to get all member balances at once
    query = (
        select(
            User.id,
            User.full_name,
            user_paid_sq.label("paid"),
            user_owed_sq.label("owed"),
            user_sent_sq.label("sent"),
            user_received_sq.label("received"),
            loans_given_sq.label("loans_given"),
            loans_received_sq.label("loans_received")
        )
        .join(GroupMember, GroupMember.user_id == User.id)
        .where(GroupMember.group_id == group_id)
    )

    result = await db.execute(query)
    member_data = result.all()

    # Total group spending
    total_spent_res = await db.execute(
        select(sqlfunc.coalesce(sqlfunc.sum(Expense.amount), 0)).where(Expense.group_id == group_id)
    )
    total_spent = float(total_spent_res.scalar() or 0)

    # Check authorization (if current user is in the result set)
    is_member = any(row[0] == current_user_uuid for row in member_data)
    if not is_member:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Calculate net balances and prepare DTOs
    members_balances = []
    balances_map = {} # user_id -> net_balance
    user_names = {}
    
    user_paid_val = 0.0
    user_share_val = 0.0
    user_balance_val = 0.0

    for row in member_data:
        uid, name, paid, owed, sent, received, lg, lr = row
        
        paid_v = float(paid) if paid is not None else 0.0
        owed_v = float(owed) if owed is not None else 0.0
        sent_v = float(sent) if sent is not None else 0.0
        received_v = float(received) if received is not None else 0.0
        lg_v = float(lg) if lg is not None else 0.0
        lr_v = float(lr) if lr is not None else 0.0
        
        net = paid_v - owed_v + sent_v - received_v + lg_v - lr_v
        
        members_balances.append(UserBalance(
            user_id=uid,
            full_name=name,
            net_balance=round(net, 2)
        ))
        
        balances_map[uid] = net
        user_names[uid] = name
        
        if uid == current_user_uuid:
            user_paid_val = paid_v
            user_share_val = owed_v
            user_balance_val = net

    # 5. Debt Simplification Algorithm (Greedy)
    debtors = [] # (amount, user_id)
    creditors = [] # (amount, user_id)
    
    for uid, bal in balances_map.items():
        if bal < -0.01:
            debtors.append([-bal, uid])
        elif bal > 0.01:
            creditors.append([bal, uid])
            
    suggested = []
    while debtors and creditors:
        debtors.sort(reverse=True)
        creditors.sort(reverse=True)
        
        d_amt, d_id = debtors[0]
        c_amt, c_id = creditors[0]
        
        settle_amt = min(d_amt, c_amt)
        suggested.append(SuggestedSettlement(
            from_user=d_id,
            from_user_name=user_names[d_id],
            to_user=c_id,
            to_user_name=user_names[c_id],
            amount=round(settle_amt, 2)
        ))
        
        debtors[0][0] -= settle_amt
        creditors[0][0] -= settle_amt
        
        if debtors[0][0] < 0.01: debtors.pop(0)
        if creditors[0][0] < 0.01: creditors.pop(0)

    return GroupBalancesOut(
        total_spent=round(total_spent, 2),
        user_paid=round(user_paid_val, 2),
        user_share=round(user_share_val, 2),
        user_balance=round(user_balance_val, 2),
        members_balances=members_balances,
        suggested_settlements=suggested
    )

@router.get("/history/{group_id}", response_model=List[SettlementDetailOut])
async def get_settlement_history(
    group_id: int,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    # Verify membership
    current_user_uuid = uuid.UUID(user_id)
    member_check = await db.execute(
        select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == current_user_uuid)
    )
    if not member_check.scalars().first():
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.execute(
        select(Settlement)
        .where(Settlement.group_id == group_id)
        .order_by(Settlement.created_at.desc())
    )
    history = result.scalars().all()
    
    # We need user names for details
    user_ids = set()
    for h in history:
        user_ids.add(h.from_user)
        user_ids.add(h.to_user)
        
    users_res = await db.execute(select(User).where(User.id.in_(user_ids)))
    user_map = {u.id: u.full_name for u in users_res.scalars().all()}
    
    return [
        SettlementDetailOut(
            id=h.id,
            group_id=h.group_id,
            from_user=h.from_user,
            to_user=h.to_user,
            amount=float(h.amount),
            payment_method=h.payment_method,
            status=h.status,
            created_at=h.created_at,
            from_user_name=user_map.get(h.from_user, "Unknown"),
            to_user_name=user_map.get(h.to_user, "Unknown")
        )
        for h in history
    ]

@router.get("/optimize/{group_id}", response_model=List[SuggestedSettlement])
async def optimize_settlements(
    group_id: int,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    # This is essentially the suggested_settlements part of get_group_balances
    balances_data = await get_group_balances(group_id, user_id, db)
    return balances_data.suggested_settlements

@router.get("/optimize", response_model=GlobalSettlementsOut)
async def global_optimize_settlements(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db)
):
    user_uuid = uuid.UUID(user_id)
    
    # 1. Fetch all groups user is a member of
    members_res = await db.execute(
        select(GroupMember)
        .options(selectinload(GroupMember.group))
        .where(GroupMember.user_id == user_uuid)
    )
    memberships = members_res.scalars().all()
    
    total_owe = 0.0
    total_owed = 0.0
    results = []
    
    for m in memberships:
        try:
            # 2. Get balances for each group
            balances = await get_group_balances(m.group_id, user_id, db)
            
            # 3. Add to global totals
            if balances.user_balance > 0.01:
                total_owed += balances.user_balance
            elif balances.user_balance < -0.01:
                total_owe += abs(balances.user_balance)
            
            # 4. Only include groups with pending settlements
            if balances.suggested_settlements:
                results.append(GroupSuggestedSettlements(
                    group_id=m.group_id,
                    group_name=m.group.name,
                    group_emoji=m.group.emoji,
                    settlements=balances.suggested_settlements
                ))
        except Exception as e:
            print(f"Error calculating global balance for group {m.group_id}: {e}")
            continue

    return GlobalSettlementsOut(
        total_owe=round(total_owe, 2),
        total_owed=round(total_owed, 2),
        groups=results
    )
