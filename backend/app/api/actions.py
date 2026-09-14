"""
Nexus — Actions API routes.
Executes or simulates manual corrective actions on processes.
"""

from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.db import get_db, get_policy
from app.executor.actions import ActionExecutor

router = APIRouter(prefix="/actions", tags=["actions"])


class ActionExecuteRequest(BaseModel):
    action_type: str         # 'renice' | 'throttle' | 'suspend' | 'restart' | 'kill' | 'observe'
    pid: int
    process_name: str
    reason: Optional[str] = "Manual action triggered via dashboard."


class ActionExecuteResponse(BaseModel):
    action_type: str
    pid: int
    process_name: str
    simulated: bool
    success: bool
    reason: str
    before_cpu: Optional[float] = None
    before_memory_mb: Optional[float] = None
    after_cpu: Optional[float] = None
    after_memory_mb: Optional[float] = None
    executed_at: str
    error: Optional[str] = None
    new_pid: Optional[int] = None   # populated after restart relaunches the process


@router.post("/execute", response_model=ActionExecuteResponse)
async def execute_action(
    req: ActionExecuteRequest,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> ActionExecuteResponse:
    policy = await get_policy(db)
    executor = ActionExecutor(simulation_mode=policy.simulation_mode)

    result = executor.execute(
        action_type=req.action_type,
        pid=req.pid,
        process_name=req.process_name,
        reason=req.reason or "Manual dashboard action",
    )

    return ActionExecuteResponse(
        action_type=result.action_type,
        pid=result.pid,
        process_name=result.process_name,
        simulated=result.simulated,
        success=result.success,
        reason=result.reason,
        before_cpu=result.before_cpu,
        before_memory_mb=result.before_memory_mb,
        after_cpu=result.after_cpu,
        after_memory_mb=result.after_memory_mb,
        executed_at=result.executed_at,
        error=result.error,
        new_pid=getattr(result, "new_pid", None),
    )
