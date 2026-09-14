"""
Nexus API Gateway — main application entry point.
Registers all routers: Auth, Metrics, Incidents, Policy, Actions, Processes, Reports, WebSockets.
"""

from __future__ import annotations

import logging
import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.api.auth import router as auth_router
from app.api.metrics import router as metrics_router
from app.api.incidents import router as incidents_router
from app.api.policy import router as policy_router
from app.api.actions import router as actions_router
from app.api.processes import router as processes_router
from app.api.reports import router as reports_router
from app.api.feedback import router as feedback_router
from app.api.maintenance import router as maintenance_router
from app.api.websocket import router as ws_router, start_agent_background

# ── Structured logging ────────────────────────────────────────────────────────
structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)
logging.basicConfig(level=logging.INFO)

# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    start_agent_background()
    yield
    # Shutdown


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Nexus API",
    description="AI-Powered Self-Healing OS Resource Guardian",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(metrics_router)
app.include_router(incidents_router)
app.include_router(policy_router)
app.include_router(actions_router)
app.include_router(processes_router)
app.include_router(reports_router)
app.include_router(feedback_router)
app.include_router(maintenance_router)
app.include_router(ws_router)



# ── Health probe ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["system"])
async def health() -> dict:
    return {"status": "ok", "service": "nexus-api", "version": "1.0.0"}


@app.get("/", tags=["system"])
async def root() -> dict:
    return {
        "name": "Nexus",
        "description": "AI-Powered Self-Healing OS Resource Guardian",
        "docs": "/docs",
        "health": "/health",
    }
