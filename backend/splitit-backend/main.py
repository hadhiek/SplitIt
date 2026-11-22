from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for the SplitIt Expense Management Dashboard"
)

cors_origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]

# CORS configuration. Keep this explicit; wildcard origins cannot safely be
# combined with credentialed Supabase requests.
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Welcome to SplitIt API. See /docs for endpoint documentation."}

from routers import users, groups, expenses, settlements, notifications, receipt_extraction, loans

app.include_router(users.router)
app.include_router(groups.router)
app.include_router(expenses.router)
app.include_router(settlements.router)
app.include_router(notifications.router)
app.include_router(receipt_extraction.router)
app.include_router(loans.router)

