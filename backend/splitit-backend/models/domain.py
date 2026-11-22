from sqlalchemy import Column, String, BigInteger, Numeric, ForeignKey, Date, DateTime, Boolean, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True)
    full_name = Column(String, nullable=False)
    avatar_url = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Group(Base):
    __tablename__ = "groups"

    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String)
    emoji = Column(String)
    invite_code = Column(String, unique=True)
    is_active = Column(Boolean, server_default='true')
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    members = relationship("GroupMember", back_populates="group")
    expenses = relationship("Expense", back_populates="group")
    join_requests = relationship("JoinRequest", back_populates="group")

class GroupMember(Base):
    __tablename__ = "group_members"

    group_id = Column(BigInteger, ForeignKey("groups.id"), primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    role = Column(String, server_default='member')
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    group = relationship("Group", back_populates="members")
    user = relationship("User")

class JoinRequest(Base):
    __tablename__ = "join_requests"

    id = Column(BigInteger, primary_key=True, index=True)
    group_id = Column(BigInteger, ForeignKey("groups.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status = Column(String, server_default='pending')  # pending, accepted, rejected
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    responded_at = Column(DateTime(timezone=True))

    group = relationship("Group", back_populates="join_requests")
    user = relationship("User")

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(BigInteger, primary_key=True, index=True)
    group_id = Column(BigInteger, ForeignKey("groups.id"))
    paid_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    amount = Column(Numeric(10, 2), nullable=False)
    description = Column(String, nullable=False)
    category = Column(String)
    receipt_url = Column(String)
    status = Column(String, server_default='pending')
    expense_date = Column(Date, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    group = relationship("Group", back_populates="expenses")
    splits = relationship("ExpenseSplit", back_populates="expense", cascade="all, delete-orphan")

class ExpenseSplit(Base):
    __tablename__ = "expense_splits"

    id = Column(BigInteger, primary_key=True, index=True)
    expense_id = Column(BigInteger, ForeignKey("expenses.id"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    amount_owed = Column(Numeric(10, 2), nullable=False)

    expense = relationship("Expense", back_populates="splits")

class Settlement(Base):
    __tablename__ = "settlements"

    id = Column(BigInteger, primary_key=True, index=True)
    group_id = Column(BigInteger, ForeignKey("groups.id"))
    from_user = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    to_user = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    amount = Column(Numeric(10, 2), nullable=False)
    payment_method = Column(String)
    status = Column(String, server_default='pending')
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Loan(Base):
    __tablename__ = "loans"

    id = Column(BigInteger, primary_key=True, index=True)
    group_id = Column(BigInteger, ForeignKey("groups.id"), nullable=False)
    from_user = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    to_user = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    note = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(BigInteger, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    message = Column(String, nullable=False)
    type = Column(String, server_default='info')
    read = Column(Boolean, server_default='false')
    created_at = Column(DateTime(timezone=True), server_default=func.now())

