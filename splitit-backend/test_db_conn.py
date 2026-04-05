import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from core.config import settings

async def test_connection():
    try:
        url = settings.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            
        print(f"Attempting to connect using: {url.split('@')[1]}") # hides password
            
        engine = create_async_engine(url)
        async with engine.connect() as conn:
            print("Successfully connected to the database!")
    except Exception as e:
        print(f"Connection Failed: {type(e).__name__} - {e}")

if __name__ == "__main__":
    asyncio.run(test_connection())
