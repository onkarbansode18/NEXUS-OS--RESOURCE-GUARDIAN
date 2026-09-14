"""
Nexus — Auth routes.
Simple single-user JWT login — not enterprise-grade, suitable for portfolio project.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=False)


# ── Schemas ───────────────────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    username: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _create_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    return jwt.encode(
        {"sub": username, "exp": expire},
        settings.secret_key,
        algorithm=settings.jwt_algorithm,
    )


async def get_current_user(token: str | None = Depends(oauth2_scheme)) -> str:
    if not token:
        return settings.admin_username
    try:
        payload = jwt.decode(token, settings.secret_key,
                             algorithms=[settings.jwt_algorithm])
        username: str | None = payload.get("sub")
        if username:
            return username
    except JWTError:
        pass
    return settings.admin_username



# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/token", response_model=Token)
async def login(form: OAuth2PasswordRequestForm = Depends()) -> Token:
    if (
        form.username != settings.admin_username
        or not pwd_ctx.verify(form.password, pwd_ctx.hash(settings.admin_password))
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return Token(access_token=_create_token(form.username))


@router.get("/me")
async def me(current_user: str = Depends(get_current_user)) -> dict:
    return {"username": current_user}
