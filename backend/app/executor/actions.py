"""
Nexus Action Executor — Phase 5 (Live Mode)
===========================================
Executes (or simulates) corrective healing actions on processes.

SIMULATION MODE (default ON):
  - All action methods log what they WOULD do and return success.
  - No real OS calls are made.
  - Safe to demo and test.

LIVE MODE (opt-in, explicit confirmation required):
  - Only acts on processes the user has whitelisted.
  - Never touches system PIDs or blacklisted processes.
  - Each action is logged before + after with actual measurements.
  - RESTART: captures the process command line, kills it, then relaunches.
  - THROTTLE: sets a high nice value (Windows: below-normal priority class).
  - SUSPEND/RESUME: uses psutil cross-platform API.
  - KILL: terminates the process immediately.

Actions implemented:
  - renice    : Lower process scheduling priority (niceness / priority class)
  - throttle  : Alias for renice with max nice value (Windows: BELOW_NORMAL_PRIORITY_CLASS)
  - suspend   : Pause the process (SIGSTOP / NtSuspendProcess)
  - resume    : Resume a suspended process
  - restart   : Kill and relaunch the process with captured argv
  - kill      : SIGKILL (last resort)
  - observe   : Alert only — no OS action
"""

from __future__ import annotations

import ctypes
import logging
import os
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional

import psutil

from app.decision.engine import SYSTEM_PIDS, SYSTEM_PROCESS_BLACKLIST, ActionType

logger = logging.getLogger("nexus.executor")

_IS_WINDOWS = sys.platform == "win32"


# ── Result type ───────────────────────────────────────────────────────────────

@dataclass
class ActionResult:
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
    executed_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    error: Optional[str] = None
    new_pid: Optional[int] = None   # populated after a successful restart


# ── Executor ──────────────────────────────────────────────────────────────────

class ActionExecutor:
    """
    Executes or simulates healing actions.
    Thread-safe: each call is independent.
    """

    def __init__(self, simulation_mode: bool = True) -> None:
        self.simulation_mode = simulation_mode
        logger.info(
            "ActionExecutor initialised — mode=%s",
            "SIMULATION" if simulation_mode else "LIVE",
        )

    # ── Safety gate (called before EVERY action) ──────────────────────────────

    def _safety_check(self, pid: int, name: str) -> Optional[str]:
        """Return an error string if the action should be blocked, else None."""
        if pid == os.getpid():
            return f"PID {pid} is the Nexus OS server process itself."
        if pid in SYSTEM_PIDS:
            return f"PID {pid} is a protected system PID."
        clean_name = name.lower().removesuffix(".exe")
        if name.lower() in SYSTEM_PROCESS_BLACKLIST or clean_name in SYSTEM_PROCESS_BLACKLIST:
            return f"'{name}' is a protected system process."
        return None

    def _snapshot(self, pid: int) -> tuple[Optional[float], Optional[float]]:
        """Capture current cpu/memory before/after action."""
        try:
            proc = psutil.Process(pid)
            cpu = proc.cpu_percent(interval=0.1)
            mem = round(proc.memory_info().rss / (1024 ** 2), 2)
            return cpu, mem
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.Error):
            return None, None

    def _capture_cmdline(self, pid: int) -> Optional[List[str]]:
        """Return the argv of a running process, or None if unavailable."""
        try:
            cmd = psutil.Process(pid).cmdline()
            return cmd if cmd else None
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess, psutil.Error):
            return None

    # ── Public action methods ─────────────────────────────────────────────────

    def renice(self, pid: int, process_name: str, nice_value: int = 10) -> ActionResult:
        """Lower the scheduling priority of a process."""
        reason = f"Reduce CPU scheduling priority to nice={nice_value}."
        blocked = self._safety_check(pid, process_name)
        if blocked:
            return self._blocked(ActionType.RENICE, pid, process_name, blocked)

        before_cpu, before_mem = self._snapshot(pid)

        if self.simulation_mode:
            logger.info("[SIM] Would renice PID %d (%s) to nice=%d", pid, process_name, nice_value)
            return ActionResult(
                action_type=ActionType.RENICE, pid=pid, process_name=process_name,
                simulated=True, success=True, reason=reason,
                before_cpu=before_cpu, before_memory_mb=before_mem,
            )

        try:
            proc = psutil.Process(pid)
            if _IS_WINDOWS:
                # On Windows use BELOW_NORMAL_PRIORITY_CLASS (0x4000) for throttling
                proc.nice(psutil.BELOW_NORMAL_PRIORITY_CLASS)
                logger.info("Set BELOW_NORMAL priority for PID %d (%s)", pid, process_name)
            else:
                proc.nice(nice_value)
                logger.info("Reniced PID %d (%s) to nice=%d", pid, process_name, nice_value)
            after_cpu, after_mem = self._snapshot(pid)
            return ActionResult(
                action_type=ActionType.RENICE, pid=pid, process_name=process_name,
                simulated=False, success=True, reason=reason,
                before_cpu=before_cpu, before_memory_mb=before_mem,
                after_cpu=after_cpu, after_memory_mb=after_mem,
            )
        except (psutil.NoSuchProcess, psutil.AccessDenied, PermissionError) as exc:
            return self._error(ActionType.RENICE, pid, process_name, reason, str(exc),
                               before_cpu, before_mem)

    def throttle(self, pid: int, process_name: str) -> ActionResult:
        """
        Throttle a CPU-heavy process by setting the lowest scheduling priority.
        On Windows: IDLE_PRIORITY_CLASS.
        On Linux/macOS: nice=19.
        """
        reason = "Throttle process to lowest scheduling priority to reduce CPU pressure."
        blocked = self._safety_check(pid, process_name)
        if blocked:
            return self._blocked("throttle", pid, process_name, blocked)

        before_cpu, before_mem = self._snapshot(pid)

        if self.simulation_mode:
            logger.info("[SIM] Would throttle PID %d (%s)", pid, process_name)
            return ActionResult(
                action_type="throttle", pid=pid, process_name=process_name,
                simulated=True, success=True, reason=reason,
                before_cpu=before_cpu, before_memory_mb=before_mem,
            )

        try:
            proc = psutil.Process(pid)
            if _IS_WINDOWS:
                proc.nice(psutil.IDLE_PRIORITY_CLASS)
                logger.info("Set IDLE_PRIORITY_CLASS for PID %d (%s)", pid, process_name)
            else:
                proc.nice(19)
                logger.info("Throttled PID %d (%s) to nice=19", pid, process_name)
            after_cpu, after_mem = self._snapshot(pid)
            return ActionResult(
                action_type="throttle", pid=pid, process_name=process_name,
                simulated=False, success=True, reason=reason,
                before_cpu=before_cpu, before_memory_mb=before_mem,
                after_cpu=after_cpu, after_memory_mb=after_mem,
            )
        except (psutil.NoSuchProcess, psutil.AccessDenied, PermissionError) as exc:
            return self._error("throttle", pid, process_name, reason, str(exc),
                               before_cpu, before_mem)

    def suspend(self, pid: int, process_name: str) -> ActionResult:
        """Pause a process (SIGSTOP on Unix, NtSuspendProcess on Windows)."""
        reason = "Suspend process to prevent resource exhaustion."
        blocked = self._safety_check(pid, process_name)
        if blocked:
            return self._blocked(ActionType.SUSPEND, pid, process_name, blocked)

        before_cpu, before_mem = self._snapshot(pid)

        if self.simulation_mode:
            logger.info("[SIM] Would suspend PID %d (%s)", pid, process_name)
            return ActionResult(
                action_type=ActionType.SUSPEND, pid=pid, process_name=process_name,
                simulated=True, success=True, reason=reason,
                before_cpu=before_cpu, before_memory_mb=before_mem,
            )

        try:
            proc = psutil.Process(pid)
            proc.suspend()
            logger.warning("Suspended PID %d (%s)", pid, process_name)
            return ActionResult(
                action_type=ActionType.SUSPEND, pid=pid, process_name=process_name,
                simulated=False, success=True, reason=reason,
                before_cpu=before_cpu, before_memory_mb=before_mem,
            )
        except (psutil.NoSuchProcess, psutil.AccessDenied, PermissionError) as exc:
            return self._error(ActionType.SUSPEND, pid, process_name, reason, str(exc),
                               before_cpu, before_mem)

    def resume(self, pid: int, process_name: str) -> ActionResult:
        """Resume a suspended process."""
        reason = "Resume previously suspended process."
        if self.simulation_mode:
            logger.info("[SIM] Would resume PID %d (%s)", pid, process_name)
            return ActionResult(
                action_type="resume", pid=pid, process_name=process_name,
                simulated=True, success=True, reason=reason,
            )
        try:
            proc = psutil.Process(pid)
            proc.resume()
            logger.info("Resumed PID %d (%s)", pid, process_name)
            return ActionResult(
                action_type="resume", pid=pid, process_name=process_name,
                simulated=False, success=True, reason=reason,
            )
        except (psutil.NoSuchProcess, psutil.AccessDenied, PermissionError) as exc:
            return self._error("resume", pid, process_name, reason, str(exc))

    def restart(self, pid: int, process_name: str) -> ActionResult:
        """
        Kill the process and relaunch it using the same command-line arguments.
        Falls back to kill-only if the cmdline cannot be captured or re-exec fails.
        """
        reason = "Restart process: terminate and relaunch with original arguments."
        blocked = self._safety_check(pid, process_name)
        if blocked:
            return self._blocked(ActionType.RESTART, pid, process_name, blocked)

        before_cpu, before_mem = self._snapshot(pid)

        if self.simulation_mode:
            logger.info("[SIM] Would restart PID %d (%s)", pid, process_name)
            return ActionResult(
                action_type=ActionType.RESTART, pid=pid, process_name=process_name,
                simulated=True, success=True, reason=reason,
                before_cpu=before_cpu, before_memory_mb=before_mem,
            )

        # Capture cmdline & exe BEFORE killing
        cmdline = self._capture_cmdline(pid)
        exe_path: Optional[str] = None
        cwd: Optional[str] = None
        try:
            proc = psutil.Process(pid)
            exe_path = proc.exe()
            cwd = proc.cwd()
        except Exception:
            pass

        # Fallback for cmdline
        if not cmdline:
            if exe_path:
                cmdline = [exe_path]
            elif process_name:
                cmdline = [process_name]

        # Kill the process
        try:
            proc = psutil.Process(pid)
            proc.kill()
            try:
                proc.wait(timeout=3)
            except Exception:
                pass
            logger.warning("Killed PID %d (%s) for restart", pid, process_name)
        except psutil.NoSuchProcess:
            pass  # Already gone
        except (psutil.AccessDenied, PermissionError) as exc:
            return self._error(ActionType.RESTART, pid, process_name, reason, str(exc),
                               before_cpu, before_mem)

        # Attempt to relaunch
        new_pid: Optional[int] = None
        if cmdline:
            try:
                pop_kwargs = {
                    "cwd": cwd,
                    "stdout": subprocess.DEVNULL,
                    "stderr": subprocess.DEVNULL,
                    "close_fds": True,
                }
                if _IS_WINDOWS:
                    pop_kwargs["creationflags"] = (
                        subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
                    )
                else:
                    pop_kwargs["start_new_session"] = True

                new_proc = subprocess.Popen(cmdline, **pop_kwargs)
                new_pid = new_proc.pid
                logger.info(
                    "Restarted %s — old PID=%d new PID=%d cmd=%s",
                    process_name, pid, new_pid, cmdline[0],
                )
            except Exception as exc:
                logger.error("Relaunch of %s failed: %s", process_name, exc)
                return ActionResult(
                    action_type=ActionType.RESTART, pid=pid, process_name=process_name,
                    simulated=False, success=False,
                    reason=f"Process killed but relaunch failed: {exc}",
                    error=str(exc),
                    before_cpu=before_cpu, before_memory_mb=before_mem,
                )
        else:
            logger.warning(
                "Could not capture cmdline for %s (PID %d); killed only.", process_name, pid
            )

        return ActionResult(
            action_type=ActionType.RESTART, pid=pid, process_name=process_name,
            simulated=False, success=True,
            reason=reason + (f" Relaunched as PID {new_pid}." if new_pid else " (cmdline unavailable — killed only)."),
            before_cpu=before_cpu, before_memory_mb=before_mem,
            new_pid=new_pid,
        )

    def kill(self, pid: int, process_name: str) -> ActionResult:
        """SIGKILL — last resort only."""
        reason = "Terminate process — last resort after escalation."
        blocked = self._safety_check(pid, process_name)
        if blocked:
            return self._blocked(ActionType.KILL, pid, process_name, blocked)

        before_cpu, before_mem = self._snapshot(pid)

        if self.simulation_mode:
            logger.info("[SIM] Would kill PID %d (%s)", pid, process_name)
            return ActionResult(
                action_type=ActionType.KILL, pid=pid, process_name=process_name,
                simulated=True, success=True, reason=reason,
                before_cpu=before_cpu, before_memory_mb=before_mem,
            )

        try:
            proc = psutil.Process(pid)
            proc.kill()
            logger.critical("Killed PID %d (%s)", pid, process_name)
            return ActionResult(
                action_type=ActionType.KILL, pid=pid, process_name=process_name,
                simulated=False, success=True, reason=reason,
                before_cpu=before_cpu, before_memory_mb=before_mem,
            )
        except (psutil.NoSuchProcess, psutil.AccessDenied, PermissionError) as exc:
            return self._error(ActionType.KILL, pid, process_name, reason, str(exc),
                               before_cpu, before_mem)

    def alert_only(self, pid: int, process_name: str, reason: str) -> ActionResult:
        """Log an alert without touching the process."""
        logger.warning("ALERT: PID %d (%s) — %s", pid, process_name, reason)
        return ActionResult(
            action_type=ActionType.ALERT_ONLY, pid=pid, process_name=process_name,
            simulated=self.simulation_mode, success=True, reason=reason,
        )

    def execute(self, action_type: str, pid: int, process_name: str,
                reason: str = "") -> ActionResult:
        """Dispatch to the correct action method by action_type string."""
        dispatch = {
            ActionType.RENICE:     lambda: self.renice(pid, process_name),
            "throttle":            lambda: self.throttle(pid, process_name),
            ActionType.SUSPEND:    lambda: self.suspend(pid, process_name),
            "resume":              lambda: self.resume(pid, process_name),
            ActionType.RESTART:    lambda: self.restart(pid, process_name),
            ActionType.KILL:       lambda: self.kill(pid, process_name),
            ActionType.ALERT_ONLY: lambda: self.alert_only(pid, process_name, reason),
            "observe":             lambda: self.alert_only(pid, process_name, reason or "Observing process."),
        }
        fn = dispatch.get(action_type)
        if fn is None:
            return self.alert_only(pid, process_name, f"Unknown action type '{action_type}' — observing.")
        return fn()

    # ── Private helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _blocked(action_type: str, pid: int, name: str, reason: str) -> ActionResult:
        logger.debug("Action blocked: %s on PID %d (%s) — %s", action_type, pid, name, reason)
        return ActionResult(
            action_type=action_type, pid=pid, process_name=name,
            simulated=False, success=False,
            reason=f"Action blocked by safety guardrail: {reason}",
            error=reason,
        )

    @staticmethod
    def _error(
        action_type: str, pid: int, name: str, reason: str, error: str,
        before_cpu: Optional[float] = None, before_mem: Optional[float] = None,
    ) -> ActionResult:
        logger.error("Action failed: %s on PID %d (%s) — %s", action_type, pid, name, error)
        return ActionResult(
            action_type=action_type, pid=pid, process_name=name,
            simulated=False, success=False, reason=reason, error=error,
            before_cpu=before_cpu, before_memory_mb=before_mem,
        )
