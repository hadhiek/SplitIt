from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from core.config import settings
from core.cache import init_redis, close_redis

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_redis()
    yield
    # Shutdown
    await close_redis()

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for the SplitIt Expense Management Dashboard",
    lifespan=lifespan
)

# CORS configuration - Permissive for local development. Bearer tokens work with wildcard.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False, 
    allow_methods=["*"],
    allow_headers=["*"],
)

import traceback
from fastapi.responses import JSONResponse
from fastapi import FastAPI, Request

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"GLOBAL 500 ERROR: {request.url}")
    traceback.print_exc()
    return JSONResponse(status_code=500, content={"detail": f"Internal Server Error: {str(exc)}"})

@app.get("/")
async def root():
    return {"message": "Welcome to SplitIt API. See /docs for endpoint documentation."}

from routers import users, groups, expenses, settlements, notifications, loans

app.include_router(users.router)
app.include_router(groups.router)
app.include_router(expenses.router)
app.include_router(settlements.router)
app.include_router(notifications.router)
app.include_router(loans.router)

