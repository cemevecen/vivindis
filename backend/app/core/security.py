"""Clerk oturum JWT doğrulama (PyJWT + JWKS)."""

from __future__ import annotations

from functools import lru_cache

import jwt
from fastapi import HTTPException, status
from jwt import PyJWKClient

from app.core.config import get_settings


@lru_cache
def _jwks_client() -> PyJWKClient:
    url = get_settings().clerk_jwks_url.strip()
    if not url:
        msg = "CLERK_JWKS_URL is not configured"
        raise RuntimeError(msg)
    return PyJWKClient(url)


def verify_clerk_session_token(token: str) -> str:
    """
    Bearer token içindeki Clerk oturum JWT'sini doğrular.
    Dönüş: Clerk kullanıcı kimliği (`sub` claim) — `users.clerk_id` ile eşleşir.
    """
    settings = get_settings()
    if not settings.clerk_jwks_url.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Clerk JWT doğrulama yapılandırılmadı (CLERK_JWKS_URL).",
        )
    try:
        client = _jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)
        issuer = settings.clerk_jwt_issuer.strip() or None
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=issuer,
            options={"verify_aud": False},
        )
    except jwt.exceptions.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz veya süresi dolmuş oturum.",
        ) from exc

    sub = payload.get("sub")
    if not sub or not isinstance(sub, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token içinde kullanıcı kimliği yok.",
        )
    return sub
