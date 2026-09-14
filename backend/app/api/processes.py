"""
Nexus — Processes API routes.
Returns live system process snapshots.
"""

from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
import psutil

from app.api.auth import get_current_user

router = APIRouter(prefix="/processes", tags=["processes"])


class ProcessItem(BaseModel):
    pid: int
    name: str
    cpu_percent: float
    memory_mb: float
    memory_percent: float
    status: str
    username: str
    created_at: str
    health_status: str
    anomaly_score: Optional[float] = 1.0


@router.get("/", response_model=List[ProcessItem])
async def list_processes(_user: str = Depends(get_current_user)) -> List[ProcessItem]:
    procs = []
    for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_info', 'memory_percent', 'status', 'username', 'create_time']):
        try:
            info = proc.info
            mem_mb = round((info.get('memory_info').rss if info.get('memory_info') else 0) / (1024 * 1024), 1)
            cpu = info.get('cpu_percent') or 0.0
            mem_pct = info.get('memory_percent') or 0.0

            health = 'healthy'
            if cpu > 80 or mem_pct > 80:
                health = 'warning'
            if cpu > 90 or mem_pct > 90:
                health = 'critical'

            procs.append(
                ProcessItem(
                    pid=info['pid'],
                    name=info.get('name') or 'unknown',
                    cpu_percent=round(cpu, 1),
                    memory_mb=mem_mb,
                    memory_percent=round(mem_pct, 1),
                    status=info.get('status') or 'running',
                    username=info.get('username') or 'system',
                    created_at=str(info.get('create_time') or ''),
                    health_status=health,
                    anomaly_score=1.0,
                )
            )
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue

    procs.sort(key=lambda x: x.cpu_percent, reverse=True)
    return procs[:100]
