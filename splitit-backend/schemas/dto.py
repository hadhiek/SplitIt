from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID

# --- Users ---
class UserOut(BaseModel):
    id: UUID
    full_name: str
    avatar_url: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# --- Expenses ---
class ExpenseSplitIn(BaseModel):
    user_id: UUID
    amount_owed: float

class ExpenseCreate(BaseModel):
    group_id: int
    amount: float
    description: str
    category: Optional[str] = "Other"
    paid_by: UUID
    receipt_url: Optional[str] = None
    expense_date: date
    splits: List[ExpenseSplitIn]

class ExpenseSplitOut(BaseModel):
    user_id: UUID
    amount_owed: float
    model_config = ConfigDict(from_attributes=True)

class ExpenseOut(BaseModel):
    id: int
    group_id: int
    paid_by: Optional[UUID] = None
    amount: float
    description: str
    category: Optional[str] = None
    receipt_url: Optional[str] = None
    status: str
    expense_date: date
    created_at: datetime
    splits: List[ExpenseSplitOut]
    group_name: Optional[str] = None
    group_emoji: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# --- Groups ---
class GroupCreate(BaseModel):
    name: str
    description: Optional[str] = None
    emoji: Optional[str] = "👥"

class GroupOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    emoji: Optional[str] = None
    invite_code: Optional[str] = None
    is_active: bool = True
    created_by: Optional[UUID] = None
    created_at: datetime
    members_count: Optional[int] = 0
    user_balance: Optional[float] = 0.0
    total_settled: Optional[float] = 0.0
    model_config = ConfigDict(from_attributes=True)

class GroupMemberAdd(BaseModel):
    user_id: UUID
    role: str = "member"

class GroupMemberOut(BaseModel):
    user_id: UUID
    role: str
    user: Optional[UserOut] = None
    model_config = ConfigDict(from_attributes=True)

class GroupDetailOut(GroupOut):
    members: List[GroupMemberOut]
    expenses: List[ExpenseOut] = []

# --- Join Requests ---
class JoinGroupIn(BaseModel):
    invite_code: str

class JoinRequestOut(BaseModel):
    id: int
    group_id: int
    user_id: UUID
    status: str
    created_at: datetime
    responded_at: Optional[datetime] = None
    user: Optional[UserOut] = None
    group_name: Optional[str] = None
    group_emoji: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class JoinRequestAction(BaseModel):
    action: str  # "accept" or "reject"
    

# --- Settlements ---
class SettlementCreate(BaseModel):
    group_id: int
    from_user: UUID
    to_user: UUID
    amount: float
    payment_method: Optional[str] = "cash"

class SettlementOut(BaseModel):
    id: int
    group_id: int
    from_user: UUID
    to_user: UUID
    amount: float
    payment_method: Optional[str] = None
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class SettlementDetailOut(SettlementOut):
    from_user_name: Optional[str] = None
    to_user_name: Optional[str] = None

class UserBalance(BaseModel):
    user_id: UUID
    full_name: str
    net_balance: float # positive means they are owed money, negative means they owe money

class SuggestedSettlement(BaseModel):
    from_user: UUID
    from_user_name: str
    to_user: UUID
    to_user_name: str
    amount: float

class GroupBalancesOut(BaseModel):
    total_spent: float
    user_paid: float
    user_share: float
    user_balance: float
    members_balances: List[UserBalance]
    suggested_settlements: List[SuggestedSettlement]

# --- Loans ---
class LoanCreate(BaseModel):
    group_id: int
    amount: float
    note: Optional[str] = None

class LoanOut(BaseModel):
    id: int
    group_id: int
    from_user: UUID
    to_user: UUID
    amount: float
    note: Optional[str] = None
    created_at: datetime
    from_user_name: Optional[str] = None
    to_user_name: Optional[str] = None

# --- Notifications ---
class NotificationOut(BaseModel):
    id: int
    user_id: UUID
    message: str
    type: str
    read: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class DashboardSummaryOut(BaseModel):
    groups_count: int
    total_owe: float
    total_owed: float
    pending_approvals_count: int
    recent_expenses: List[ExpenseOut]

class GroupSuggestedSettlements(BaseModel):
    group_id: int
    group_name: str
    group_emoji: Optional[str] = None
    settlements: List[SuggestedSettlement]

class GlobalSettlementsOut(BaseModel):
    total_owe: float
    total_owed: float
    groups: List[GroupSuggestedSettlements]

