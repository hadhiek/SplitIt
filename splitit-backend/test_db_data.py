import asyncio
from sqlalchemy import select
from core.database import AsyncSessionLocal
from models.domain import Group, GroupMember, User, Expense

async def run():
    async with AsyncSessionLocal() as db:
        users = (await db.execute(select(User))).scalars().all()
        print("--- USERS ---")
        for u in users:
            print(f"ID: {u.id}, Name: {u.full_name}")
            
        groups = (await db.execute(select(Group))).scalars().all()
        print("\n--- GROUPS ---")
        for g in groups:
            print(f"ID: {g.id}, Name: {g.name}")
            
        members = (await db.execute(select(GroupMember))).scalars().all()
        print("\n--- GROUP MEMBERS ---")
        for m in members:
            print(f"Group ID: {m.group_id}, User ID: {m.user_id}, Role: {m.role}")

        expenses = (await db.execute(select(Expense))).scalars().all()
        print("\n--- EXPENSES ---")
        for e in expenses:
            print(f"Expense ID: {e.id}, Group: {e.group_id}, Paid By: {e.paid_by}")


if __name__ == "__main__":
    asyncio.run(run())
