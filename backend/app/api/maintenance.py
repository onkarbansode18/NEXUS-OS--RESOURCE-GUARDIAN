"""
Nexus OS — Maintenance Windows API Router
Manages scheduled time windows during which autonomous healing operations are permitted.
"""

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.auth import get_current_user
from app.db import get_db
from app.db.models import MaintenanceWindowRecord

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


class MaintenanceWindowOut(BaseModel):
    id: int
    name: str
    process_pattern: str
    allowed_actions: List[str]
    schedule_type: str
    start_hour: int
    end_hour: int
    days_of_week: List[int]
    active: bool
    created_at: str


class MaintenanceWindowCreate(BaseModel):
    name: str
    process_pattern: str = "*"
    allowed_actions: List[str] = ["renice", "restart", "kill", "throttle", "suspend"]
    schedule_type: str = "daily"
    start_hour: int = 0
    end_hour: int = 23
    days_of_week: List[int] = [0, 1, 2, 3, 4, 5, 6]
    active: bool = True


class MaintenanceWindowUpdate(BaseModel):
    name: Optional[str] = None
    process_pattern: Optional[str] = None
    allowed_actions: Optional[List[str]] = None
    schedule_type: Optional[str] = None
    start_hour: Optional[int] = None
    end_hour: Optional[int] = None
    days_of_week: Optional[List[int]] = None
    active: Optional[bool] = None


def is_window_active(window: MaintenanceWindowRecord, now_dt: Optional[datetime] = None) -> bool:
    if not window.active:
        return False
    if now_dt is None:
        now_dt = datetime.now(timezone.utc)
    current_hour = now_dt.hour
    current_weekday = now_dt.weekday()

    if window.schedule_type == "always":
        return True

    if window.days_of_week and isinstance(window.days_of_week, list):
        if current_weekday not in window.days_of_week:
            return False

    start = window.start_hour
    end = window.end_hour
    if start <= end:
        return start <= current_hour <= end
    else:
        return current_hour >= start or current_hour <= end


@router.get("/", response_model=List[MaintenanceWindowOut])
async def list_maintenance_windows(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> List[MaintenanceWindowOut]:
    stmt = select(MaintenanceWindowRecord).order_by(MaintenanceWindowRecord.id.desc())
    res = await db.execute(stmt)
    windows = res.scalars().all()
    return [
        MaintenanceWindowOut(
            id=w.id,
            name=w.name,
            process_pattern=w.process_pattern,
            allowed_actions=w.allowed_actions or [],
            schedule_type=w.schedule_type,
            start_hour=w.start_hour,
            end_hour=w.end_hour,
            days_of_week=w.days_of_week or [],
            active=w.active,
            created_at=w.created_at.isoformat() if w.created_at else "",
        )
        for w in windows
    ]


@router.post("/", response_model=MaintenanceWindowOut)
async def create_maintenance_window(
    body: MaintenanceWindowCreate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> MaintenanceWindowOut:
    w = MaintenanceWindowRecord(
        name=body.name,
        process_pattern=body.process_pattern,
        allowed_actions=body.allowed_actions,
        schedule_type=body.schedule_type,
        start_hour=body.start_hour,
        end_hour=body.end_hour,
        days_of_week=body.days_of_week,
        active=body.active,
    )
    db.add(w)
    await db.commit()
    await db.refresh(w)
    return MaintenanceWindowOut(
        id=w.id,
        name=w.name,
        process_pattern=w.process_pattern,
        allowed_actions=w.allowed_actions or [],
        schedule_type=w.schedule_type,
        start_hour=w.start_hour,
        end_hour=w.end_hour,
        days_of_week=w.days_of_week or [],
        active=w.active,
        created_at=w.created_at.isoformat() if w.created_at else "",
    )


@router.patch("/{window_id}", response_model=MaintenanceWindowOut)
async def update_maintenance_window(
    window_id: int,
    body: MaintenanceWindowUpdate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> MaintenanceWindowOut:
    stmt = select(MaintenanceWindowRecord).where(MaintenanceWindowRecord.id == window_id)
    res = await db.execute(stmt)
    w = res.scalar_one_or_none()
    if not w:
        raise HTTPException(status_code=404, detail="Maintenance window not found.")

    if body.name is not None:
        w.name = body.name
    if body.process_pattern is not None:
        w.process_pattern = body.process_pattern
    if body.allowed_actions is not None:
        w.allowed_actions = body.allowed_actions
    if body.schedule_type is not None:
        w.schedule_type = body.schedule_type
    if body.start_hour is not None:
        w.start_hour = body.start_hour
    if body.end_hour is not None:
        w.end_hour = body.end_hour
    if body.days_of_week is not None:
        w.days_of_week = body.days_of_week
    if body.active is not None:
        w.active = body.active

    await db.commit()
    await db.refresh(w)
    return MaintenanceWindowOut(
        id=w.id,
        name=w.name,
        process_pattern=w.process_pattern,
        allowed_actions=w.allowed_actions or [],
        schedule_type=w.schedule_type,
        start_hour=w.start_hour,
        end_hour=w.end_hour,
        days_of_week=w.days_of_week or [],
        active=w.active,
        created_at=w.created_at.isoformat() if w.created_at else "",
    )


@router.delete("/{window_id}")
async def delete_maintenance_window(
    window_id: int,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    stmt = select(MaintenanceWindowRecord).where(MaintenanceWindowRecord.id == window_id)
    res = await db.execute(stmt)
    w = res.scalar_one_or_none()
    if not w:
        raise HTTPException(status_code=404, detail="Maintenance window not found.")
    await db.delete(w)
    await db.commit()
    return {"status": "deleted", "id": window_id}


@router.get("/active")
async def check_maintenance_active(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    stmt = select(MaintenanceWindowRecord).where(MaintenanceWindowRecord.active == True)
    res = await db.execute(stmt)
    windows = res.scalars().all()

    now = datetime.now(timezone.utc)
    active_list = []
    for w in windows:
        if is_window_active(w, now):
            active_list.append({
                "id": w.id,
                "name": w.name,
                "process_pattern": w.process_pattern,
                "allowed_actions": w.allowed_actions,
            })

    return {
        "is_active": len(active_list) > 0 or len(windows) == 0, # If no window is defined, default to active
        "has_defined_windows": len(windows) > 0,
        "active_windows": active_list,
    }
