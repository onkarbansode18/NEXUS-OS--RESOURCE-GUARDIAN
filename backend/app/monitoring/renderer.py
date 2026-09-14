"""
Nexus Monitoring — pretty-print renderer for terminal output.
Used by the standalone agent loop in Phase 1.
Separated from collection logic so the collector remains pure/testable.
"""

from __future__ import annotations

import json
from dataclasses import asdict
from typing import Literal

from .agent import SystemMetrics, ProcessSnapshot

OutputFormat = Literal["pretty", "json"]


def _bar(percent: float, width: int = 20, fill: str = "█", empty: str = "░") -> str:
    """ASCII progress bar."""
    filled = int(width * percent / 100)
    filled = max(0, min(width, filled))
    return fill * filled + empty * (width - filled)


def _bytes_human(b: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if b < 1024:
            return f"{b:.1f} {unit}"
        b //= 1024
    return f"{b:.1f} TB"


def render_pretty(m: SystemMetrics, show_processes: int = 10) -> str:
    lines: list[str] = []
    sep = "─" * 64

    lines.append(f"\n{'━' * 64}")
    lines.append(f"  NEXUS  │  {m.timestamp}")
    lines.append("━" * 64)

    # ── CPU ──────────────────────────────────────────────────────────
    cpu_bar = _bar(m.cpu_percent)
    lines.append(f"\n  CPU    {cpu_bar}  {m.cpu_percent:5.1f}%  @{m.cpu_freq_mhz:.0f} MHz")
    core_line = "         " + "  ".join(
        f"C{i}:{p:4.1f}%" for i, p in enumerate(m.cpu_percent_per_core)
    )
    lines.append(core_line)

    # ── RAM ──────────────────────────────────────────────────────────
    ram_bar = _bar(m.ram_percent)
    lines.append(
        f"\n  RAM    {ram_bar}  {m.ram_percent:5.1f}%"
        f"  {m.ram_used_mb:.0f}/{m.ram_total_mb:.0f} MB"
    )

    # ── Swap ─────────────────────────────────────────────────────────
    if m.swap_total_mb > 0:
        swap_bar = _bar(m.swap_percent)
        lines.append(
            f"  SWAP   {swap_bar}  {m.swap_percent:5.1f}%"
            f"  {m.swap_used_mb:.0f}/{m.swap_total_mb:.0f} MB"
        )

    # ── Disk ─────────────────────────────────────────────────────────
    disk_bar = _bar(m.disk.percent)
    lines.append(
        f"\n  DISK   {disk_bar}  {m.disk.percent:5.1f}%"
        f"  {m.disk.used_gb:.1f}/{m.disk.total_gb:.1f} GB  [{m.disk.path}]"
    )

    # ── Network ──────────────────────────────────────────────────────
    lines.append(
        f"\n  NET    ↑ {_bytes_human(m.network.delta_bytes_sent):>10}/s"
        f"   ↓ {_bytes_human(m.network.delta_bytes_recv):>10}/s"
    )

    # ── Processes ────────────────────────────────────────────────────
    lines.append(f"\n{sep}")
    lines.append(
        f"  {'PID':>6}  {'NAME':<22}  {'CPU%':>6}  {'MEM MB':>8}  {'STATUS':<10}  USER"
    )
    lines.append(sep)

    for p in m.processes[:show_processes]:
        cpu_flag = " ⚠" if p.cpu_percent > 50 else ("  " if p.cpu_percent < 0.1 else "  ")
        mem_flag = " ⚠" if p.memory_mb > 500 else "  "
        lines.append(
            f"  {p.pid:>6}  {p.name[:22]:<22}  {p.cpu_percent:>5.1f}%{cpu_flag}"
            f"  {p.memory_mb:>7.1f}{mem_flag}  {p.status:<10}  {p.username[:16]}"
        )

    lines.append(sep)
    return "\n".join(lines)


def render_json(m: SystemMetrics) -> str:
    return json.dumps(asdict(m), indent=2)
