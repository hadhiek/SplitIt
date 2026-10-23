import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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

logger = logging.getLogger(__name__)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Keep exception details in server logs only; never expose them to API clients.
    request_id = str(uuid.uuid4())
    logger.exception(
        "Unhandled exception request_id=%s method=%s path=%s",
        request_id,
        request.method,
        request.url.path,
        exc_info=exc,
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An unexpected server error occurred.",
            "request_id": request_id,
        },
    )

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

