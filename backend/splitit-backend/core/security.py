from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from core.config import settings

security = HTTPBearer()


def _decode_supabase_token(token: str) -> dict:
    """
    Verify the Supabase access token using the project's configured JWT secret.
    Never trust an unverified token payload for an authenticated user identity.
    """
    secret = settings.SUPABASE_JWT_SECRET
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured on the API",
        )

    try:
        return jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    """Verify the Supabase JWT and return its subject UUID."""
    payload = _decode_supabase_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has no user identity",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user_id


async def get_current_user_payload(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Verify the Supabase JWT and return its full payload."""
    return _decode_supabase_token(credentials.credentials)
