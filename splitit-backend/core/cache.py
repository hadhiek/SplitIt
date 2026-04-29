"""
core/cache.py
-------------
Centralised Redis cache client and helper utilities for SplitIt.

Architecture
------------
  - A single `redis.asyncio` connection pool is created at app startup and
    stored in the module-level `_redis` variable.
  - All routers import the helper functions below (get_cache, set_cache,
    delete_cache, invalidate_group_cache) so cache logic is never duplicated.

Cache Key Convention
--------------------
  balances:group:{group_id} -> serialised JSON of GroupBalancesOut for that group
"""

import json
import logging
from typing import Any, Optional

import redis.asyncio as aioredis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level client – initialised in main.py lifespan
# ---------------------------------------------------------------------------
_redis: Optional[aioredis.Redis] = None

CACHE_TTL_SECONDS = 3600  # 1 hour default TTL


def get_redis() -> aioredis.Redis:
    """Return the active Redis client. Raises RuntimeError if not initialised."""
    if _redis is None:
        raise RuntimeError(
            "Redis client has not been initialised. "
            "Ensure the lifespan context manager in main.py is running."
        )
    return _redis


async def init_redis() -> None:
    """
    Create the async Redis connection pool.
    Called once during FastAPI app startup.
    """
    global _redis
    try:
        _redis = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
        )
        # Validate the connection immediately so we fail fast on misconfiguration
        await _redis.ping()
        logger.info("✅ Redis connected successfully at %s", settings.REDIS_URL)
    except Exception as exc:
        # If Redis is unavailable we log a warning but do NOT crash the app.
        # All cache helpers below are safe – they silently skip on errors.
        logger.warning("⚠️  Redis unavailable (%s). Running WITHOUT cache.", exc)
        _redis = None


async def close_redis() -> None:
    """
    Close the Redis connection pool gracefully.
    Called once during FastAPI app shutdown.
    """
    global _redis
    if _redis:
        await _redis.aclose()
        _redis = None
        logger.info("Redis connection closed.")


# ---------------------------------------------------------------------------
# Generic cache helpers
# ---------------------------------------------------------------------------

async def get_cache(key: str) -> Optional[Any]:
    """
    Fetch a JSON-serialised value from Redis by *key*.
    Returns the deserialised Python object on a CACHE HIT, or None on a miss.
    """
    if _redis is None:
        return None
    try:
        raw = await _redis.get(key)
        if raw:
            logger.debug("CACHE HIT  → %s", key)
            return json.loads(raw)
        logger.debug("CACHE MISS → %s", key)
        return None
    except Exception as exc:
        logger.warning("Redis GET error for key '%s': %s", key, exc)
        return None


async def set_cache(key: str, value: Any, ttl: int = CACHE_TTL_SECONDS) -> None:
    """
    Serialise *value* as JSON and store it in Redis under *key* with the
    given TTL (seconds).
    """
    if _redis is None:
        return
    try:
        await _redis.setex(key, ttl, json.dumps(value))
        logger.debug("CACHE SET  → %s (TTL %ss)", key, ttl)
    except Exception as exc:
        logger.warning("Redis SET error for key '%s': %s", key, exc)


async def delete_cache(key: str) -> None:
    """Delete a single cache key."""
    if _redis is None:
        return
    try:
        await _redis.delete(key)
        logger.debug("CACHE DEL  → %s", key)
    except Exception as exc:
        logger.warning("Redis DEL error for key '%s': %s", key, exc)


# ---------------------------------------------------------------------------
# Domain-specific invalidation helper
# ---------------------------------------------------------------------------

async def invalidate_group_cache(group_id: int, db: AsyncSession) -> None:
    """
    Wipe every balance cache entry related to *group_id*.

    We store balances under the key  `balances:group:{group_id}`, one entry
    per group (the balances endpoint returns all members at once so there is
    no per-user split at the DB level).
    We also use a pattern scan to catch any legacy per-user keys if the
    scheme ever changes.
    """
    if _redis is None:
        return
    try:
        # Primary key used by get_group_balances
        primary_key = f"balances:group:{group_id}"
        await delete_cache(primary_key)

        # Safety net: scan for any extra keys matching this group
        pattern = f"balances:group:{group_id}*"
        async for key in _redis.scan_iter(match=pattern):
            await _redis.delete(key)
            logger.debug("CACHE SCAN DEL → %s", key)

        logger.info("Cache invalidated for group %s", group_id)
    except Exception as exc:
        logger.warning("Cache invalidation error (group %s): %s", group_id, exc)
