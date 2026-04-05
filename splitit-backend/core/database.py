from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from core.config import settings
from sqlalchemy.orm import declarative_base

# Supabase URL usually comes as postgres://
# We need it to be postgresql+asyncpg:// for async
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(
    db_url, 
    echo=False, 
    future=True,
    # Supabase connection limits often require these settings:
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True, # Test connections before use
    pool_recycle=3600,  # Refresh connections hourly
)

AsyncSessionLocal = async_sessionmaker(
    engine, 
    expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
