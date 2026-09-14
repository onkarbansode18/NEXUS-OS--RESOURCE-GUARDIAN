"""
Nexus — WebSocket endpoint + background agent orchestrator.
This module:
  1. Runs the monitoring → ML → decision → executor pipeline in a background task.
  2. Broadcasts live metrics + incident events to all connected WebSocket clients.
  3. Persists everything to the DB.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from sqlalchemy import select
from app.config import settings
from app.db import (
    AsyncSessionLocal,
    create_incident,
    get_policy,
    log_action,
    save_system_metrics,
    prune_old_metrics,
)
from app.db.models import MaintenanceWindowRecord
from app.api.maintenance import is_window_active
from app.decision import DecisionEngine, ActionType
from app.executor import ActionExecutor
from app.ml import update_and_detect, get_history, forecast_breach
from app.ml.llm_summarizer import generate_incident_summary
from app.monitoring import MetricsCollector, run_loop, SystemMetrics


logger = logging.getLogger("nexus.ws")

router = APIRouter(tags=["websocket"])

# ── Connection manager ────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self) -> None:
        self.active: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.add(ws)
        logger.info("WebSocket connected — total=%d", len(self.active))

    def disconnect(self, ws: WebSocket) -> None:
        self.active.discard(ws)
        logger.info("WebSocket disconnected — total=%d", len(self.active))

    async def broadcast(self, message: dict) -> None:
        if not self.active:
            return
        text = json.dumps(message, default=str)
        dead: Set[WebSocket] = set()
        for ws in list(self.active):
            try:
                await ws.send_text(text)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.active.discard(ws)


manager = ConnectionManager()

# ── Shared latest snapshot (for HTTP endpoints that need current state) ────────
_latest_metrics: SystemMetrics | None = None


def get_latest_metrics() -> SystemMetrics | None:
    return _latest_metrics


# ── Background pipeline ───────────────────────────────────────────────────────

async def _pipeline_tick(metrics: SystemMetrics) -> None:
    """Run the full Sense → Think → Act → Log → Broadcast cycle."""
    global _latest_metrics
    _latest_metrics = metrics

    async with AsyncSessionLocal() as db:
        # ── 1. Persist metrics ────────────────────────────────────────────────
        try:
            await save_system_metrics(db, metrics)
        except Exception as exc:
            logger.error("DB write failed: %s", exc)

        # ── 2. Load current policy ────────────────────────────────────────────
        policy = await get_policy(db)
        engine = DecisionEngine(
            simulation_mode=policy.simulation_mode,
            cpu_warning_pct=policy.cpu_warning_pct,
            cpu_critical_pct=policy.cpu_critical_pct,
            ram_warning_pct=policy.ram_warning_pct,
            ram_critical_pct=policy.ram_critical_pct,
            process_whitelist=policy.process_whitelist or [],
            process_blacklist=policy.process_blacklist or [],
        )
        executor = ActionExecutor(simulation_mode=policy.simulation_mode)

        # ── 3. Broadcast live metrics ─────────────────────────────────────────
        await manager.broadcast({
            "event": "metrics",
            "ts": metrics.timestamp,
            "data": {
                "cpu_percent":    metrics.cpu_percent,
                "cpu_freq_mhz":   metrics.cpu_freq_mhz,
                "ram_percent":    metrics.ram_percent,
                "ram_used_mb":    metrics.ram_used_mb,
                "ram_total_mb":   metrics.ram_total_mb,
                "disk_percent":   metrics.disk.percent,
                "disk_used_gb":   metrics.disk.used_gb,
                "disk_total_gb":  metrics.disk.total_gb,
                "net_bytes_sent": metrics.network.delta_bytes_sent,
                "net_bytes_recv": metrics.network.delta_bytes_recv,
                "processes": [
                    {
                        "pid":            p.pid,
                        "name":           p.name,
                        "cpu_percent":    p.cpu_percent,
                        "memory_mb":      p.memory_mb,
                        "memory_percent": p.memory_percent,
                        "status":         p.status,
                        "username":       p.username,
                        "created_at":     p.created_at,
                        "health_status":  "healthy",
                    }
                    for p in metrics.processes[:20]
                ],
            },
        })


        # ── 4. ML + Decision per process ──────────────────────────────────────
        for proc in metrics.processes:
            anomaly_results = update_and_detect(
                pid=proc.pid,
                process_name=proc.name,
                cpu_percent=proc.cpu_percent,
                memory_mb=proc.memory_mb,
                memory_percent=proc.memory_percent,
                contamination=settings.anomaly_contamination,
            )

            # Forecast (RAM exhaustion per-process)
            mem_history = get_history(proc.pid, "memory_mb")
            forecast = forecast_breach(
                history=mem_history,
                threshold=2048.0,           # 2 GB per-process threshold
                metric="memory_mb",
                process_name=proc.name,
                sample_interval_seconds=settings.metrics_interval_seconds,
                horizon_minutes=settings.forecast_horizon_minutes,
            )

            # Maintenance window check
            stmt_maint = select(MaintenanceWindowRecord).where(MaintenanceWindowRecord.active == True)
            res_maint = await db.execute(stmt_maint)
            windows = res_maint.scalars().all()
            maint_active = True
            if windows:
                now_utc = datetime.now(timezone.utc)
                maint_active = any(is_window_active(w, now_utc) for w in windows)

            decision = engine.evaluate(proc, anomaly_results, forecast, metrics, is_maintenance_allowed=maint_active)

            if decision.action == ActionType.NONE:
                continue

            # ── 5. Execute action ─────────────────────────────────────────────
            result = executor.execute(
                action_type=decision.action,
                pid=decision.pid,
                process_name=decision.process_name,
                reason=decision.reason,
            )

            # ── 6. Persist incident + action + AI summary ──────────────────────
            try:
                incident = await create_incident(
                    db=db,
                    pid=decision.pid,
                    process_name=decision.process_name,
                    severity=decision.severity,
                    description=decision.reason,
                    anomaly_score=anomaly_results[0].score if anomaly_results else None,
                    prediction=forecast.explanation if forecast else None,
                )

                # Generate summary
                inc_dict = {
                    "id": incident.id,
                    "process_name": decision.process_name,
                    "pid": decision.pid,
                    "severity": decision.severity,
                    "description": decision.reason,
                    "prediction": forecast.explanation if forecast else None,
                    "anomaly_score": anomaly_results[0].score if anomaly_results else None,
                }
                sum_res = await generate_incident_summary(inc_dict)
                incident.nl_summary = sum_res.get("summary")
                incident.nl_slack_message = sum_res.get("slack_message")
                await db.commit()

                await log_action(
                    db=db,
                    incident_id=incident.id,
                    action_type=result.action_type,
                    pid=result.pid,
                    process_name=result.process_name,
                    simulated=result.simulated,
                    reason=result.reason,
                    before_cpu=result.before_cpu,
                    before_memory_mb=result.before_memory_mb,
                )
            except Exception as exc:
                logger.error("Failed to persist incident: %s", exc)

            # ── 7. Broadcast incident event ───────────────────────────────────
            await manager.broadcast({
                "event": "incident",
                "ts": datetime.now(timezone.utc).isoformat(),
                "data": {
                    "id":           incident.id if 'incident' in locals() else None,
                    "pid":          decision.pid,
                    "process_name": decision.process_name,
                    "severity":     decision.severity,
                    "action":       decision.action,
                    "reason":       decision.reason,
                    "simulated":    result.simulated,
                    "nl_summary":   incident.nl_summary if 'incident' in locals() else None,
                },
            })


        # ── 8. Prune old metrics (keep rolling window) ─────────────────────────
        try:
            await prune_old_metrics(db, keep_minutes=settings.metrics_history_minutes)
        except Exception:
            pass


async def _agent_loop() -> None:
    """Run the monitoring agent in a thread, calling the async pipeline for each tick."""
    collector = MetricsCollector(
        top_processes=20,
        disk_path="C:\\",
    )
    interval = settings.metrics_interval_seconds

    while True:
        try:
            metrics = await asyncio.to_thread(collector.collect)
            await _pipeline_tick(metrics)
        except Exception as exc:
            logger.error("Pipeline error: %s", exc, exc_info=True)
        await asyncio.sleep(interval)


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        # Send the current snapshot immediately on connect
        if _latest_metrics:
            await websocket.send_text(json.dumps({
                "event": "connected",
                "ts": datetime.now(timezone.utc).isoformat(),
                "data": {"message": "Connected to Nexus live stream."},
            }))
        while True:
            # Keep connection alive — actual data is pushed by the pipeline
            await asyncio.sleep(30)
            await websocket.send_text(json.dumps({"event": "ping", "ts": datetime.now(timezone.utc).isoformat()}))
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ── Startup hook (called from main.py) ───────────────────────────────────────

_agent_task: asyncio.Task | None = None


def start_agent_background() -> None:
    """Launch the agent loop as a background asyncio task."""
    global _agent_task
    _agent_task = asyncio.create_task(_agent_loop())
    logger.info("Nexus monitoring agent started as background task.")
