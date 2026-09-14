"""
Nexus Decision Engine — Phase 4
================================
Hybrid rules + ML decision engine.
Takes anomaly results and system metrics, decides whether to act and what action
to take, while enforcing strict safety guardrails.

Three outputs:
  - NONE    → nothing concerning
  - ALERT   → log/notify but don't touch the process
  - ACTION  → specific heal action (renice / suspend / restart / kill)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional

from app.ml.anomaly import AnomalyResult
from app.ml.forecasting import ForecastResult
from app.monitoring.agent import ProcessSnapshot, SystemMetrics

logger = logging.getLogger("nexus.decision")

# ── Safety: HARDCODED permanent blacklist ─────────────────────────────────────
# These process names can NEVER be acted on, regardless of mode or user config.
# This list is intentionally conservative.
SYSTEM_PROCESS_BLACKLIST: frozenset[str] = frozenset({
    # Windows system processes
    "system", "system idle process", "registry", "smss.exe", "csrss.exe",
    "wininit.exe", "winlogon.exe", "services.exe", "lsass.exe", "lsm.exe",
    "svchost.exe", "dwm.exe", "fontdrvhost.exe", "sihost.exe", "taskhostw.exe",
    "ctfmon.exe", "explorer.exe", "spoolsv.exe", "searchindexer.exe",
    # Linux / macOS system processes
    "systemd", "init", "kthreadd", "kernel", "launchd",
    "kernel_task", "loginwindow", "windowserver",
})

# PIDs that can NEVER be acted on (PID 1 = init/systemd on Linux, PID 4 = Windows System)
SYSTEM_PIDS: frozenset[int] = frozenset({1, 4})


# ── Decision types ────────────────────────────────────────────────────────────

class ActionType:
    NONE       = "none"
    ALERT_ONLY = "alert_only"
    RENICE     = "renice"        # lower priority (nice value)
    THROTTLE   = "throttle"      # CPU limit via cgroups / job objects
    SUSPEND    = "suspend"       # SIGSTOP / NtSuspendProcess
    RESTART    = "restart"       # kill + let supervisor restart
    KILL       = "kill"          # SIGKILL — last resort


@dataclass
class Decision:
    pid: int
    process_name: str
    action: str                  # ActionType constant
    severity: str                # "info" | "warning" | "critical"
    reason: str                  # plain-English explanation
    anomaly_results: List[AnomalyResult]
    forecast: Optional[ForecastResult]
    confidence: float            # 0–1 overall confidence


# ── Decision Engine ───────────────────────────────────────────────────────────

class DecisionEngine:
    """
    Evaluates ML results against policy thresholds and returns a Decision.

    Safety contract:
      1. Is the PID in SYSTEM_PIDS? → NONE (hardcoded, unoverridable)
      2. Is the process name in SYSTEM_PROCESS_BLACKLIST? → NONE
      3. Is the process name in the user's blacklist? → NONE
      4. In SIMULATION MODE: any action becomes ALERT_ONLY
      5. In LIVE MODE: only processes in the whitelist can be acted on
    """

    def __init__(
        self,
        simulation_mode: bool = True,
        cpu_warning_pct: float = 85.0,
        cpu_critical_pct: float = 95.0,
        ram_warning_pct: float = 80.0,
        ram_critical_pct: float = 92.0,
        process_whitelist: Optional[List[str]] = None,
        process_blacklist: Optional[List[str]] = None,
    ) -> None:
        self.simulation_mode     = simulation_mode
        self.cpu_warning_pct     = cpu_warning_pct
        self.cpu_critical_pct    = cpu_critical_pct
        self.ram_warning_pct     = ram_warning_pct
        self.ram_critical_pct    = ram_critical_pct
        self._whitelist: frozenset[str] = frozenset(
            n.lower() for n in (process_whitelist or [])
        )
        self._user_blacklist: frozenset[str] = frozenset(
            n.lower() for n in (process_blacklist or [])
        )

    # ── Public ────────────────────────────────────────────────────────────────

    def evaluate(
        self,
        proc: ProcessSnapshot,
        anomaly_results: List[AnomalyResult],
        forecast: Optional[ForecastResult] = None,
        system_metrics: Optional[SystemMetrics] = None,
        is_maintenance_allowed: Optional[bool] = None,
    ) -> Decision:
        """
        Evaluate all signals for a process and return a Decision.
        """
        # ── 1. Safety guardrail: hardcoded blacklists ─────────────────────────
        if not self._is_safe_to_act(proc.pid, proc.name):
            return self._no_action(proc, anomaly_results, forecast,
                                   reason="System process — protected by safety guardrail.")

        # ── 2. Determine severity from ML + thresholds ────────────────────────
        severity, action, reason, confidence = self._classify(
            proc, anomaly_results, forecast, system_metrics
        )

        if action == ActionType.NONE:
            return self._no_action(proc, anomaly_results, forecast, reason=reason)

        # ── 3. Apply mode restrictions & maintenance schedule ──────────────────
        if self.simulation_mode:
            action = ActionType.ALERT_ONLY
            reason += " [SIMULATION MODE — no real action taken]"
        elif is_maintenance_allowed is False and action != ActionType.ALERT_ONLY:
            action = ActionType.ALERT_ONLY
            reason += " [Outside Scheduled Maintenance Window — escalating to alert only]"
        elif proc.name.lower() not in self._whitelist and action != ActionType.ALERT_ONLY:
            action = ActionType.ALERT_ONLY
            reason += " [Process not in whitelist — escalating to alert only]"


        return Decision(
            pid=proc.pid,
            process_name=proc.name,
            action=action,
            severity=severity,
            reason=reason,
            anomaly_results=anomaly_results,
            forecast=forecast,
            confidence=confidence,
        )

    # ── Private ───────────────────────────────────────────────────────────────

    def _is_safe_to_act(self, pid: int, name: str) -> bool:
        """Return True if we are ALLOWED to consider action on this process."""
        if pid in SYSTEM_PIDS:
            logger.debug("Safety: PID %d is a system PID — blocked.", pid)
            return False
        name_lower = name.lower()
        if name_lower in SYSTEM_PROCESS_BLACKLIST:
            logger.debug("Safety: '%s' in hardcoded blacklist — blocked.", name)
            return False
        if name_lower in self._user_blacklist:
            logger.debug("Safety: '%s' in user blacklist — blocked.", name)
            return False
        return True

    def _classify(
        self,
        proc: ProcessSnapshot,
        anomaly_results: List[AnomalyResult],
        forecast: Optional[ForecastResult],
        system_metrics: Optional[SystemMetrics],
    ) -> tuple[str, str, str, float]:
        """
        Return (severity, action_type, reason, confidence).
        Priority order: forecast breach > ML anomaly > threshold rule.
        """
        # ── Imminent breach forecast ──────────────────────────────────────────
        if forecast and forecast.minutes_until_breach is not None:
            mins = forecast.minutes_until_breach
            if mins <= 2:
                return (
                    "critical",
                    ActionType.RESTART,
                    (f"Imminent resource exhaustion: {forecast.explanation} "
                     f"Breach in ~{mins:.0f} min."),
                    forecast.confidence,
                )
            if mins <= 5:
                return (
                    "warning",
                    ActionType.RENICE,
                    forecast.explanation,
                    forecast.confidence,
                )

        # ── ML anomaly ────────────────────────────────────────────────────────
        cpu_anomaly  = next((r for r in anomaly_results if r.metric == "cpu_percent"  and r.is_anomalous), None)
        mem_anomaly  = next((r for r in anomaly_results if r.metric == "memory_mb"    and r.is_anomalous), None)

        if cpu_anomaly and mem_anomaly:
            return (
                "critical",
                ActionType.RESTART,
                f"Both CPU and memory anomalies detected simultaneously. "
                f"{cpu_anomaly.explanation} {mem_anomaly.explanation}",
                min(abs(cpu_anomaly.score), abs(mem_anomaly.score)),
            )

        if mem_anomaly:
            return (
                "warning",
                ActionType.RENICE,
                mem_anomaly.explanation,
                abs(mem_anomaly.score),
            )

        if cpu_anomaly:
            return (
                "warning",
                ActionType.RENICE,
                cpu_anomaly.explanation,
                abs(cpu_anomaly.score),
            )

        # ── Threshold rules (fallback) ─────────────────────────────────────────
        if proc.cpu_percent >= self.cpu_critical_pct:
            return (
                "critical",
                ActionType.RENICE,
                f"CPU at {proc.cpu_percent:.1f}% — exceeds critical threshold "
                f"({self.cpu_critical_pct}%).",
                0.9,
            )
        if proc.cpu_percent >= self.cpu_warning_pct:
            return (
                "warning",
                ActionType.ALERT_ONLY,
                f"CPU at {proc.cpu_percent:.1f}% — exceeds warning threshold "
                f"({self.cpu_warning_pct}%).",
                0.8,
            )
        if proc.memory_mb >= 2048 or (
            system_metrics and proc.memory_percent >= self.ram_critical_pct
        ):
            return (
                "critical",
                ActionType.RENICE,
                f"Memory at {proc.memory_mb:.0f} MB ({proc.memory_percent:.1f}%) "
                f"— high usage detected.",
                0.85,
            )

        return ("info", ActionType.NONE, "Process within normal parameters.", 0.0)

    @staticmethod
    def _no_action(
        proc: ProcessSnapshot,
        anomaly_results: List[AnomalyResult],
        forecast: Optional[ForecastResult],
        reason: str,
    ) -> Decision:
        return Decision(
            pid=proc.pid,
            process_name=proc.name,
            action=ActionType.NONE,
            severity="info",
            reason=reason,
            anomaly_results=anomaly_results,
            forecast=forecast,
            confidence=0.0,
        )
