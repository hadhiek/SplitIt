"""Supabase access-token verification for legacy and asymmetric signing keys."""

import json
import threading
import time
from urllib.error import URLError
from urllib.request import urlopen

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from core.config import settings

security = HTTPBearer()

_JWKS_CACHE_TTL_SECONDS = 600
_jwks_cache = {"expires_at": 0.0, "keys": []}
_jwks_lock = threading.Lock()


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _get_supabase_jwks() -> list[dict]:
    """Fetch and briefly cache the public signing keys advertised by Supabase."""
    supabase_url = settings.SUPABASE_URL.rstrip("/")
    if not supabase_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase URL is not configured on the API",
        )

    now = time.monotonic()
    with _jwks_lock:
        if now < _jwks_cache["expires_at"] and _jwks_cache["keys"]:
            return _jwks_cache["keys"]

        jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
        try:
            with urlopen(jwks_url, timeout=5) as response:
                jwks = json.loads(response.read().decode("utf-8"))
        except (OSError, URLError, ValueError) as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Could not retrieve Supabase signing keys",
            ) from exc

        keys = jwks.get("keys", [])
        if not isinstance(keys, list) or not keys:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Supabase did not provide any JWT signing keys",
            )

        _jwks_cache["keys"] = keys
        _jwks_cache["expires_at"] = now + _JWKS_CACHE_TTL_SECONDS
        return keys


def _decode_supabase_token(token: str) -> dict:
    """
    Verify Supabase JWTs signed by the active asymmetric key (ES256), while
    retaining support for legacy HS256 tokens during key migration.
    Never trust an unverified token payload for an authenticated identity.
    """
    try:
        header = jwt.get_unverified_header(token)
        algorithm = header.get("alg")
        issuer = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1"

        if algorithm == "ES256":
            kid = header.get("kid")
            if not kid:
                raise _unauthorized()

            signing_key = next(
                (
                    key
                    for key in _get_supabase_jwks()
                    if key.get("kid") == kid
                    and key.get("alg", "ES256") == "ES256"
                    and key.get("kty") == "EC"
                    and key.get("crv") == "P-256"
                ),
                None,
            )
            if signing_key is None:
                # Refresh once in case Supabase has rotated its signing key.
                _jwks_cache["expires_at"] = 0.0
                signing_key = next(
                    (
                        key
                        for key in _get_supabase_jwks()
                        if key.get("kid") == kid
                        and key.get("alg", "ES256") == "ES256"
                        and key.get("kty") == "EC"
                        and key.get("crv") == "P-256"
                    ),
                    None,
                )
            if signing_key is None:
                raise _unauthorized()

            return jwt.decode(
                token,
                signing_key,
                algorithms=["ES256"],
                issuer=issuer,
                options={"verify_aud": False},
            )

        if algorithm == "HS256":
            secret = settings.SUPABASE_JWT_SECRET
            if not secret:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Legacy Supabase JWT secret is not configured on the API",
                )
            return jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                issuer=issuer,
                options={"verify_aud": False},
            )

        raise _unauthorized()

    except HTTPException:
        raise
    except JWTError as exc:
        raise _unauthorized() from exc


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """Verify the Supabase JWT and return its subject UUID."""
    payload = _decode_supabase_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise _unauthorized()
    return user_id


async def get_current_user_payload(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Verify the Supabase JWT and return its full payload."""
    return _decode_supabase_token(credentials.credentials)
