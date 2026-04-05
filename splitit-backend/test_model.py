import asyncio
from core.database import AsyncSessionLocal
from routers.users import get_dashboard_summary
from schemas.dto import DashboardSummaryOut
from pydantic import ValidationError

async def run():
    async with AsyncSessionLocal() as db:
        try:
            # We call the function directly. It expects user_id string and db.
            summary_obj = await get_dashboard_summary("a682214b-3b72-43bf-8ad9-a67bb290ac11", db)
            print("Successfully executed python logic.")
            
            # Now we force Pydantic to validate the response just like FastAPI does.
            try:
                out = DashboardSummaryOut.model_validate(summary_obj, from_attributes=True)
                print("Successfully serialized DTO!")
            except ValidationError as ve:
                print("PYDANTIC VALIDATION ERROR:")
                print(ve.json())
        except Exception as e:
            print("ERROR IN API:", e)

if __name__ == "__main__":
    asyncio.run(run())
