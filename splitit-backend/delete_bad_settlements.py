import asyncio
from sqlalchemy.future import select
from core.database import get_db, SessionLocal
from models.domain import Settlement

async def main():
    async with SessionLocal() as db:
        result = await db.execute(select(Settlement))
        settlements = result.scalars().all()
        
        to_delete = []
        for s in settlements:
            if s.from_user == s.to_user:
                to_delete.append(s)
        
        print(f"Found {len(to_delete)} bad settlements where from_user == to_user")
        for s in to_delete:
            await db.delete(s)
            
        if to_delete:
            await db.commit()
            print("Successfully deleted bad settlements.")
        else:
            print("No bad settlements found.")

if __name__ == "__main__":
    asyncio.run(main())
