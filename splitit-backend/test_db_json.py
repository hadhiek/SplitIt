import asyncio, json
from sqlalchemy import select
from core.database import AsyncSessionLocal
from models.domain import Group, GroupMember, User, Expense

async def run():
    async with AsyncSessionLocal() as db:
        users = (await db.execute(select(User))).scalars().all()
        groups = (await db.execute(select(Group))).scalars().all()
        members = (await db.execute(select(GroupMember))).scalars().all()
        expenses = (await db.execute(select(Expense))).scalars().all()

        data = {
            "users": [{"id": str(u.id), "full_name": u.full_name} for u in users],
            "groups": [{"id": g.id, "name": g.name} for g in groups],
            "members": [{"group_id": m.group_id, "user_id": str(m.user_id), "role": m.role} for m in members],
            "expenses": [{"id": e.id, "group_id": e.group_id, "paid_by": str(e.paid_by)} for e in expenses]
        }
        with open("db_dump.json", "w") as f:
            json.dump(data, f, indent=2)

if __name__ == "__main__":
    asyncio.run(run())
