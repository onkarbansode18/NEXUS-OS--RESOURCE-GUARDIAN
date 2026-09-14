"""
Nexus — Metrics API routes.
Returns live system metrics and historical series.
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.db import get_db, get_recent_system_metrics

router = APIRouter(prefix="/metrics", tags=["metrics"])


class MetricPoint(BaseModel):
    timestamp: str
    cpu_percent: float
    ram_percent: float
    ram_used_mb: float
    ram_total_mb: float
    disk_percent: float
    net_bytes_sent: int
    net_bytes_recv: int


@router.get("/history", response_model=List[MetricPoint])
async def metrics_history(
    minutes: int = 30,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> List[MetricPoint]:
    """Return the last `minutes` of system metrics for sparkline graphs."""
    records = await get_recent_system_metrics(db, minutes=minutes)
    return [
        MetricPoint(
            timestamp=r.timestamp.isoformat(),
            cpu_percent=r.cpu_percent,
            ram_percent=r.ram_percent,
            ram_used_mb=r.ram_used_mb,
            ram_total_mb=r.ram_total_mb,
            disk_percent=r.disk_percent or 0.0,
            net_bytes_sent=r.net_bytes_sent or 0,
            net_bytes_recv=r.net_bytes_recv or 0,
        )
        for r in reversed(list(records))  # chronological order
    ]
