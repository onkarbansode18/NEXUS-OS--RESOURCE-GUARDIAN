"""
Nexus Monitoring Agent — continuous polling loop.
Runs standalone with:   python -m app.monitoring.runner
or:                     python backend/app/monitoring/runner.py
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
from typing import Callable

from .agent import MetricsCollector, SystemMetrics
from .renderer import OutputFormat, render_json, render_pretty

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("nexus.monitoring")


def run_loop(
    interval: float = 2.0,
    top_processes: int = 10,
    output_format: OutputFormat = "pretty",
    on_metrics: Callable[[SystemMetrics], None] | None = None,
    max_iterations: int | None = None,
) -> None:
    """
    Polling loop.

    Args:
        interval:       Seconds between collections.
        top_processes:  How many processes to show in output.
        output_format:  "pretty" for human table, "json" for structured output.
        on_metrics:     Optional callback invoked with each SystemMetrics.
                        Used by the FastAPI layer (Phase 6) to push to WebSocket.
        max_iterations: Stop after N iterations (None = run forever).
    """
    collector = MetricsCollector(top_processes=top_processes)
    logger.info(
        "Monitoring agent started — interval=%.1fs, format=%s",
        interval, output_format,
    )

    iteration = 0
    try:
        while max_iterations is None or iteration < max_iterations:
            try:
                metrics = collector.collect()

                # ── Render to terminal ────────────────────────────────────────
                if output_format == "pretty":
                    print(render_pretty(metrics, show_processes=top_processes),
                          flush=True)
                else:
                    print(render_json(metrics), flush=True)

                # ── Callback (Phase 6 WebSocket hook) ────────────────────────
                if on_metrics is not None:
                    on_metrics(metrics)

            except Exception as exc:       # noqa: BLE001
                logger.error("Collection error (will retry): %s", exc, exc_info=True)

            iteration += 1
            time.sleep(interval)

    except KeyboardInterrupt:
        logger.info("Monitoring agent stopped by user.")
        sys.exit(0)


# ── CLI entry-point ───────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Nexus monitoring agent — streams system metrics to stdout."
    )
    parser.add_argument(
        "--interval", "-i", type=float, default=2.0,
        help="Polling interval in seconds (default: 2.0)",
    )
    parser.add_argument(
        "--top", "-t", type=int, default=10,
        help="Number of top processes to display (default: 10)",
    )
    parser.add_argument(
        "--format", "-f", choices=["pretty", "json"], default="pretty",
        dest="fmt",
        help="Output format: pretty (human-readable) or json (default: pretty)",
    )
    parser.add_argument(
        "--count", "-n", type=int, default=None,
        help="Stop after N iterations (default: run forever)",
    )
    args = parser.parse_args()

    run_loop(
        interval=args.interval,
        top_processes=args.top,
        output_format=args.fmt,
        max_iterations=args.count,
    )


if __name__ == "__main__":
    main()
