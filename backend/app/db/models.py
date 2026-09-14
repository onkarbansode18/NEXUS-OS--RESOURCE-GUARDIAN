"""
Nexus DB — SQLAlchemy models.
Designed so swapping the DATABASE_URL from sqlite+aiosqlite to
postgresql+asyncpg requires only changing the .env file — no model changes.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, relationship


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


# ── SystemMetricsRecord ───────────────────────────────────────────────────────

class SystemMetricsRecord(Base):
    """One row per polling interval — rolling window, pruned by a background task."""

    __tablename__ = "system_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, default=_now, index=True)

    # CPU
    cpu_percent       = Column(Float, nullable=False)
    cpu_freq_mhz      = Column(Float, nullable=True)
    cpu_count_logical = Column(Integer, nullable=True)

    # RAM
    ram_total_mb     = Column(Float, nullable=False)
    ram_used_mb      = Column(Float, nullable=False)
    ram_percent      = Column(Float, nullable=False)

    # Swap
    swap_total_mb = Column(Float, nullable=True)
    swap_used_mb  = Column(Float, nullable=True)
    swap_percent  = Column(Float, nullable=True)

    # Disk (primary)
    disk_path       = Column(String(255), nullable=True)
    disk_total_gb   = Column(Float, nullable=True)
    disk_used_gb    = Column(Float, nullable=True)
    disk_percent    = Column(Float, nullable=True)

    # Network (deltas since last sample)
    net_bytes_sent  = Column(Integer, nullable=True)
    net_bytes_recv  = Column(Integer, nullable=True)

    __table_args__ = (
        Index("ix_sys_metrics_ts", "timestamp"),
    )


# ── ProcessMetricsRecord ──────────────────────────────────────────────────────

class ProcessMetricsRecord(Base):
    """Per-process snapshot, linked to a SystemMetricsRecord."""

    __tablename__ = "process_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    system_metrics_id = Column(
        Integer, ForeignKey("system_metrics.id", ondelete="CASCADE"), nullable=False
    )
    timestamp  = Column(DateTime(timezone=True), nullable=False, default=_now, index=True)

    pid            = Column(Integer,  nullable=False)
    name           = Column(String(255), nullable=False)
    status         = Column(String(64),  nullable=True)
    username       = Column(String(128), nullable=True)
    cpu_percent    = Column(Float,    nullable=False, default=0.0)
    memory_mb      = Column(Float,    nullable=False, default=0.0)
    memory_percent = Column(Float,    nullable=True)
    num_threads    = Column(Integer,  nullable=True)

    # ML outputs (populated by Phase 3)
    anomaly_score  = Column(Float,   nullable=True)   # Isolation Forest score
    is_anomalous   = Column(Boolean, nullable=True)   # True if flagged

    system_metrics = relationship("SystemMetricsRecord", backref="processes", lazy="select")

    __table_args__ = (
        Index("ix_proc_metrics_ts", "timestamp"),
        Index("ix_proc_metrics_pid", "pid"),
        Index("ix_proc_metrics_name", "name"),
    )


# ── Incident ──────────────────────────────────────────────────────────────────

class IncidentRecord(Base):
    """An anomaly / predicted failure event."""

    __tablename__ = "incidents"

    id          = Column(String(36), primary_key=True, default=_uuid)
    pid         = Column(Integer,    nullable=False)
    process_name = Column(String(255), nullable=False)

    severity    = Column(String(16),  nullable=False)   # info / warning / critical
    status      = Column(String(16),  nullable=False, default="open")  # open/healing/resolved/dismissed

    description  = Column(Text,   nullable=False)        # plain-English explanation
    prediction   = Column(Text,   nullable=True)         # "RAM exhausted in ~6 min"
    anomaly_score = Column(Float, nullable=True)
    nl_summary    = Column(Text,   nullable=True)         # AI plain-English summary
    nl_slack_message = Column(Text, nullable=True)      # Ready-to-copy Slack notification snippet

    detected_at  = Column(DateTime(timezone=True), nullable=False, default=_now)
    resolved_at  = Column(DateTime(timezone=True), nullable=True)

    actions = relationship("HealingActionRecord", back_populates="incident", lazy="select")

    __table_args__ = (
        Index("ix_incidents_detected_at", "detected_at"),
        Index("ix_incidents_status", "status"),
        Index("ix_incidents_pid", "pid"),
    )


# ── HealingActionRecord ───────────────────────────────────────────────────────

class HealingActionRecord(Base):
    """Each automated (or simulated) corrective action taken."""

    __tablename__ = "healing_actions"

    id          = Column(String(36), primary_key=True, default=_uuid)
    incident_id = Column(String(36), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False)

    action_type = Column(String(32), nullable=False)   # renice/throttle/suspend/restart/kill/alert_only
    pid         = Column(Integer,    nullable=False)
    process_name = Column(String(255), nullable=False)
    simulated   = Column(Boolean,    nullable=False, default=True)

    before_cpu       = Column(Float, nullable=True)
    before_memory_mb = Column(Float, nullable=True)
    after_cpu        = Column(Float, nullable=True)
    after_memory_mb  = Column(Float, nullable=True)

    reason      = Column(Text,  nullable=False)
    executed_at = Column(DateTime(timezone=True), nullable=False, default=_now)

    incident = relationship("IncidentRecord", back_populates="actions")

    __table_args__ = (
        Index("ix_actions_incident", "incident_id"),
        Index("ix_actions_executed_at", "executed_at"),
    )


# ── PolicyRecord ──────────────────────────────────────────────────────────────

class PolicyRecord(Base):
    """Single-row table holding the active policy configuration."""

    __tablename__ = "policy"

    id = Column(Integer, primary_key=True, default=1)  # always 1

    simulation_mode   = Column(Boolean, nullable=False, default=True)

    cpu_warning_pct   = Column(Float, nullable=False, default=85.0)
    cpu_critical_pct  = Column(Float, nullable=False, default=95.0)
    ram_warning_pct   = Column(Float, nullable=False, default=80.0)
    ram_critical_pct  = Column(Float, nullable=False, default=92.0)
    disk_warning_pct  = Column(Float, nullable=False, default=85.0)
    disk_critical_pct = Column(Float, nullable=False, default=95.0)

    # JSON arrays of process name strings
    process_whitelist = Column(JSON, nullable=False, default=list)
    process_blacklist = Column(JSON, nullable=False, default=list)

    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)


# ── FeedbackRecord ─────────────────────────────────────────────────────────────

class FeedbackRecord(Base):
    """User feedback on incidents for false-positive learning loop."""

    __tablename__ = "feedback_labels"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(String(36), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False)
    label       = Column(String(32), nullable=False)  # "correct" | "false_positive" | "too_aggressive"
    user_note   = Column(Text, nullable=True)
    created_at  = Column(DateTime(timezone=True), nullable=False, default=_now)

    __table_args__ = (
        Index("ix_feedback_incident", "incident_id"),
        Index("ix_feedback_created_at", "created_at"),
    )


# ── MaintenanceWindowRecord ───────────────────────────────────────────────────

class MaintenanceWindowRecord(Base):
    """Scheduled windows during which autonomous healing is permitted/configured."""

    __tablename__ = "maintenance_windows"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    name            = Column(String(128), nullable=False)
    process_pattern = Column(String(128), nullable=False, default="*")  # e.g. "ffmpeg", "*", "python*"
    allowed_actions = Column(JSON, nullable=False, default=list)  # ["renice", "restart", "kill"]
    schedule_type   = Column(String(16), nullable=False, default="daily")  # "daily" | "weekly" | "always"
    start_hour      = Column(Integer, nullable=False, default=0)   # 0-23
    end_hour        = Column(Integer, nullable=False, default=23)  # 0-23
    days_of_week    = Column(JSON, nullable=False, default=list)  # [0,1,2,3,4,5,6] (0=Mon)
    active          = Column(Boolean, nullable=False, default=True)
    created_at      = Column(DateTime(timezone=True), nullable=False, default=_now)

    __table_args__ = (
        Index("ix_maint_active", "active"),
    )

