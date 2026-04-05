import asyncio
from core.database import AsyncSessionLocal
from routers.groups import list_user_groups
from routers.users import get_dashboard_summary
from routers.expenses import list_expenses
from schemas.dto import GroupOut, DashboardSummaryOut, ExpenseOut
from models.domain import User
from sqlalchemy.future import select

async def run():
    async with AsyncSessionLocal() as db:
        users = (await db.execute(select(User))).scalars().all()
        for u in users:
            print(f"\n--- Testing User: {u.full_name} ({u.id}) ---")
            
            # 1. Groups
            try:
                groups = await list_user_groups(str(u.id), db)
                g_out = [GroupOut.model_validate(g, from_attributes=True) for g in groups]
                print(f"Groups: {len(g_out)} found")
            except Exception as e:
                print("GROUPS ERROR:", e)

            # 2. Expenses
            try:
                expenses = await list_expenses(group_id=None, user_id=str(u.id), db=db)
                e_out = [ExpenseOut.model_validate(e, from_attributes=True) for e in expenses]
                print(f"Expenses: {len(e_out)} found")
            except Exception as e:
                print("EXPENSES ERROR:", e)

            # 3. Dashboard
            try:
                summary = await get_dashboard_summary(str(u.id), db)
                s_out = DashboardSummaryOut.model_validate(summary, from_attributes=True)
                print(f"Dashboard: groups_count={s_out.groups_count}, total_owe={s_out.total_owe}")
            except Exception as e:
                print("DASHBOARD ERROR:", e)

if __name__ == "__main__":
    asyncio.run(run())
