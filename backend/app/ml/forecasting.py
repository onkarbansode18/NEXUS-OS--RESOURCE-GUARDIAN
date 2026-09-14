"""
Nexus ML Engine — Forecasting (Phase 3)
=======================================
Lightweight forecasting using exponential smoothing + linear regression.
Predicts minutes until a metric breaches a threshold.

Design: pure functions, no external state, easily testable.
"""

from __future__ import annotations

import logging
from typing import Optional

import numpy as np

logger = logging.getLogger("nexus.ml.forecasting")


# ── Types ─────────────────────────────────────────────────────────────────────

class ForecastResult:
    __slots__ = ("metric", "current_value", "threshold", "slope_per_sample",
                 "minutes_until_breach", "confidence", "explanation")

    def __init__(
        self,
        metric: str,
        current_value: float,
        threshold: float,
        slope_per_sample: float,
        minutes_until_breach: Optional[float],
        confidence: float,
        explanation: str,
    ) -> None:
        self.metric = metric
        self.current_value = current_value
        self.threshold = threshold
        self.slope_per_sample = slope_per_sample
        self.minutes_until_breach = minutes_until_breach
        self.confidence = confidence          # 0–1 (R² of the linear fit)
        self.explanation = explanation


# ── Public API ────────────────────────────────────────────────────────────────

def forecast_breach(
    history: list[float],
    threshold: float,
    metric: str,
    process_name: str,
    sample_interval_seconds: float = 2.0,
    horizon_minutes: int = 15,
    min_samples: int = 10,
    smoothing_alpha: float = 0.3,
) -> Optional[ForecastResult]:
    """
    Estimate minutes until `metric` crosses `threshold`, based on recent history.

    Algorithm:
      1. Apply exponential smoothing to reduce noise.
      2. Fit a linear regression to the smoothed series.
      3. Extrapolate: samples_needed = (threshold - current) / slope.
      4. Convert samples → minutes using sample_interval_seconds.

    Returns None if:
      - Not enough history.
      - Slope is non-positive (metric is stable or declining — no breach imminent).
      - Breach is beyond horizon_minutes (not urgent).
    """
    if len(history) < min_samples:
        return None

    smoothed = _exponential_smooth(history, alpha=smoothing_alpha)
    slope, intercept, r_squared = _linear_regression(smoothed)

    current = smoothed[-1]

    if slope <= 0:
        return None   # metric is stable or declining

    # samples_until_breach = (threshold - current) / slope
    samples_to_breach = (threshold - current) / slope
    if samples_to_breach <= 0:
        # Already above threshold
        minutes = 0.0
    else:
        minutes = (samples_to_breach * sample_interval_seconds) / 60.0

    if minutes > horizon_minutes:
        return None   # not urgent enough to surface

    explanation = _explain_forecast(
        process_name=process_name,
        metric=metric,
        current=current,
        threshold=threshold,
        minutes=minutes,
        r_squared=r_squared,
    )

    return ForecastResult(
        metric=metric,
        current_value=round(current, 2),
        threshold=threshold,
        slope_per_sample=round(slope, 4),
        minutes_until_breach=round(minutes, 1),
        confidence=round(r_squared, 3),
        explanation=explanation,
    )


# ── Smoothing & regression ────────────────────────────────────────────────────

def _exponential_smooth(values: list[float], alpha: float = 0.3) -> list[float]:
    """Single exponential smoothing (Holt's level model)."""
    if not values:
        return []
    smoothed = [values[0]]
    for v in values[1:]:
        smoothed.append(alpha * v + (1 - alpha) * smoothed[-1])
    return smoothed


def _linear_regression(values: list[float]) -> tuple[float, float, float]:
    """
    Fit y = slope * x + intercept to the values series.
    Returns (slope, intercept, r_squared).
    """
    n = len(values)
    if n < 2:
        return 0.0, values[0] if values else 0.0, 0.0

    x = np.arange(n, dtype=float)
    y = np.array(values, dtype=float)

    # Using numpy polyfit for speed
    coeffs = np.polyfit(x, y, deg=1)
    slope, intercept = float(coeffs[0]), float(coeffs[1])

    # R² (coefficient of determination)
    y_pred = slope * x + intercept
    ss_res = float(np.sum((y - y_pred) ** 2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    r_squared = 1.0 - (ss_res / ss_tot) if ss_tot > 0 else 0.0

    return slope, intercept, max(0.0, r_squared)


def _explain_forecast(
    process_name: str,
    metric: str,
    current: float,
    threshold: float,
    minutes: float,
    r_squared: float,
) -> str:
    metric_label = {
        "ram_percent":    "RAM usage",
        "cpu_percent":    "CPU usage",
        "disk_percent":   "disk usage",
        "memory_mb":      "memory (RSS)",
        "memory_percent": "memory %",
    }.get(metric, metric)

    unit = "%" if "percent" in metric else " MB"
    confidence_label = "high" if r_squared > 0.85 else ("medium" if r_squared > 0.6 else "low")

    if minutes < 1:
        time_str = "less than 1 minute"
    elif minutes < 2:
        time_str = "~1 minute"
    else:
        time_str = f"~{minutes:.0f} minutes"

    subject = f"Process '{process_name}'" if process_name else "System"

    return (
        f"{subject} {metric_label} is trending upward "
        f"(now {current:.1f}{unit}, threshold {threshold:.1f}{unit}). "
        f"At this rate, threshold will be breached in {time_str}. "
        f"[Forecast confidence: {confidence_label}, R²={r_squared:.2f}]"
    )
