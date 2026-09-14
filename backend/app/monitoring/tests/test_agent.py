"""
Nexus Monitoring — Phase 1 unit tests.
Run:  python -m pytest backend/app/monitoring/tests/ -v
or:   python backend/app/monitoring/tests/test_agent.py
"""

from __future__ import annotations

import sys
import os

# Allow running directly without installing the package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", ".."))

from app.monitoring.agent import MetricsCollector, SystemMetrics, ProcessSnapshot


def _collect_once() -> SystemMetrics:
    collector = MetricsCollector(top_processes=5)
    return collector.collect()


def test_metrics_has_timestamp() -> None:
    m = _collect_once()
    assert m.timestamp, "timestamp must not be empty"
    assert "T" in m.timestamp, "timestamp must be ISO-8601"


def test_cpu_in_range() -> None:
    m = _collect_once()
    assert 0.0 <= m.cpu_percent <= 100.0, f"cpu_percent out of range: {m.cpu_percent}"


def test_ram_used_lte_total() -> None:
    m = _collect_once()
    assert m.ram_used_mb <= m.ram_total_mb, (
        f"RAM used ({m.ram_used_mb}) > total ({m.ram_total_mb})"
    )
    assert m.ram_total_mb > 0, "RAM total must be > 0"


def test_disk_percent_in_range() -> None:
    m = _collect_once()
    assert 0.0 <= m.disk.percent <= 100.0, f"disk percent out of range: {m.disk.percent}"
    assert m.disk.total_gb > 0, "disk total must be > 0"


def test_processes_returned() -> None:
    m = _collect_once()
    assert len(m.processes) > 0, "Must return at least one process"
    assert len(m.processes) <= 5, "Should respect top_processes limit"


def test_process_fields() -> None:
    m = _collect_once()
    for p in m.processes:
        assert isinstance(p, ProcessSnapshot)
        assert p.pid >= 0, f"Process has negative pid: {p.pid}"
        assert p.name, f"Process {p.pid} has no name"
        assert 0.0 <= p.cpu_percent <= 100.0, f"PID {p.pid} cpu out of range: {p.cpu_percent}"
        assert p.memory_mb >= 0.0, f"PID {p.pid} negative memory: {p.memory_mb}"


def test_network_deltas_non_negative() -> None:
    import time
    collector = MetricsCollector()
    collector.collect()       # prime
    time.sleep(0.2)
    m = collector.collect()   # delta sample
    assert m.network.delta_bytes_sent >= 0
    assert m.network.delta_bytes_recv >= 0


def test_two_consecutive_collections() -> None:
    """Collector must not crash or regress on second call."""
    import time
    collector = MetricsCollector(top_processes=3)
    m1 = collector.collect()
    time.sleep(0.5)
    m2 = collector.collect()
    assert m2.timestamp > m1.timestamp, "Second collection must have a later timestamp"


if __name__ == "__main__":
    # Force UTF-8 on Windows terminals (avoids CP1252 UnicodeEncodeError)
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

    # Run tests without pytest for quick standalone check
    tests = [
        test_metrics_has_timestamp,
        test_cpu_in_range,
        test_ram_used_lte_total,
        test_disk_percent_in_range,
        test_processes_returned,
        test_process_fields,
        test_network_deltas_non_negative,
        test_two_consecutive_collections,
    ]
    passed = failed = 0
    for fn in tests:
        try:
            fn()
            print(f"  PASS  {fn.__name__}")
            passed += 1
        except Exception as exc:
            print(f"  FAIL  {fn.__name__}: {exc}")
            failed += 1

    print(f"\n{passed} passed, {failed} failed")
    sys.exit(0 if failed == 0 else 1)
