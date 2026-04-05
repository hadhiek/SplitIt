import asyncio
from core.database import AsyncSessionLocal
from routers.expenses import list_expenses

async def run():
    async with AsyncSessionLocal() as db:
        try:
            expenses = await list_expenses(group_id=None, user_id="a682214b-3b72-43bf-8ad9-a67bb290ac11", db=db)
            print("EXPENSES RETURNED:", len(expenses))
        except Exception as e:
            print("ERROR IN API:", e)

if __name__ == "__main__":
    asyncio.run(run())
