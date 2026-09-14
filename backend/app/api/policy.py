"""
Nexus — Policy API routes.
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.db import get_db, get_policy, update_policy

router = APIRouter(prefix="/policy", tags=["policy"])


class PolicyOut(BaseModel):
    simulation_mode: bool
    cpu_warning_pct: float
    cpu_critical_pct: float
    ram_warning_pct: float
    ram_critical_pct: float
    disk_warning_pct: float
    disk_critical_pct: float
    process_whitelist: List[str]
    process_blacklist: List[str]


class PolicyUpdate(BaseModel):
    simulation_mode: Optional[bool] = None
    cpu_warning_pct: Optional[float] = None
    cpu_critical_pct: Optional[float] = None
    ram_warning_pct: Optional[float] = None
    ram_critical_pct: Optional[float] = None
    disk_warning_pct: Optional[float] = None
    disk_critical_pct: Optional[float] = None
    process_whitelist: Optional[List[str]] = None
    process_blacklist: Optional[List[str]] = None


def _to_out(p) -> PolicyOut:
    return PolicyOut(
        simulation_mode=p.simulation_mode,
        cpu_warning_pct=p.cpu_warning_pct,
        cpu_critical_pct=p.cpu_critical_pct,
        ram_warning_pct=p.ram_warning_pct,
        ram_critical_pct=p.ram_critical_pct,
        disk_warning_pct=p.disk_warning_pct,
        disk_critical_pct=p.disk_critical_pct,
        process_whitelist=p.process_whitelist or [],
        process_blacklist=p.process_blacklist or [],
    )


@router.get("/", response_model=PolicyOut)
async def get(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> PolicyOut:
    return _to_out(await get_policy(db))


@router.patch("/", response_model=PolicyOut)
@router.put("/", response_model=PolicyOut)
async def update(
    body: PolicyUpdate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> PolicyOut:
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    return _to_out(await update_policy(db, **updates))
