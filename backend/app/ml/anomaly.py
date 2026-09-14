"""
Nexus ML Engine — Anomaly Detection (Phase 3)
=============================================
Uses Isolation Forest (scikit-learn) to flag per-process resource anomalies.
Designed as pure functions so it's fully testable without any DB/network.

Key design decisions:
- One model per (pid, metric_name) combination — isolates process-specific baselines
- Model is retrained on each call once enough history exists (simple, stateless for now)
- Returns a float anomaly score in [-1, 1] where < 0 = anomalous
"""

from __future__ import annotations

import logging
from typing import Dict, List, NamedTuple, Optional

import numpy as np
from sklearn.ensemble import IsolationForest

logger = logging.getLogger("nexus.ml.anomaly")

# ── Constants ─────────────────────────────────────────────────────────────────

# Minimum data points before the model is trained (avoid false positives on startup)
MIN_SAMPLES = 30

# sklearn Isolation Forest contamination — expected fraction of anomalies
DEFAULT_CONTAMINATION = 0.05
_active_contamination = DEFAULT_CONTAMINATION


def get_current_contamination() -> float:
    return _active_contamination


def set_current_contamination(val: float) -> float:
    global _active_contamination
    _active_contamination = max(0.01, min(0.20, val))
    return _active_contamination


def adjust_contamination_from_feedback(false_positive_rate: float) -> float:
    """
    Auto-tunes contamination based on false-positive feedback rate.
    If FP rate is high (> 20%), lowers contamination to make detection less sensitive.
    """
    global _active_contamination
    if false_positive_rate > 0.20:
        _active_contamination = max(0.01, round(_active_contamination * 0.8, 3))
    elif false_positive_rate < 0.05 and _active_contamination < DEFAULT_CONTAMINATION:
        _active_contamination = min(DEFAULT_CONTAMINATION, round(_active_contamination * 1.1, 3))
    return _active_contamination


# ── Types ─────────────────────────────────────────────────────────────────────

class AnomalyResult(NamedTuple):
    pid: int
    process_name: str
    metric: str          # "cpu_percent" | "memory_mb" | "memory_percent"
    score: float         # raw Isolation Forest score (lower = more anomalous)
    is_anomalous: bool
    explanation: str     # plain-English reason


# ── In-memory model cache ─────────────────────────────────────────────────────
# Key: (pid, metric_name) → trained IsolationForest instance
_model_cache: Dict[tuple, IsolationForest] = {}
# Key: (pid, metric_name) → list of float values (rolling history)
_history_cache: Dict[tuple, List[float]] = {}

# Rolling window — keep at most N samples per (pid, metric) pair
MAX_HISTORY = 500


# ── Public API ────────────────────────────────────────────────────────────────

def update_and_detect(
    pid: int,
    process_name: str,
    cpu_percent: float,
    memory_mb: float,
    memory_percent: float,
    contamination: Optional[float] = None,
) -> List[AnomalyResult]:
    """
    Feed one data point for a process and return anomaly results for each metric.
    Returns an empty list if not enough history yet.
    """
    eff_contamination = contamination if contamination is not None else _active_contamination

    metrics = {
        "cpu_percent":    cpu_percent,
        "memory_mb":      memory_mb,
        "memory_percent": memory_percent,
    }
    results: List[AnomalyResult] = []

    for metric_name, value in metrics.items():
        key = (pid, metric_name)

        # Append to rolling history
        history = _history_cache.setdefault(key, [])
        history.append(value)
        if len(history) > MAX_HISTORY:
            history.pop(0)

        # Not enough data yet
        if len(history) < MIN_SAMPLES:
            continue

        # Train / retrain the model
        model = _train_model(key, history, eff_contamination)

        # Score the latest value
        X = np.array([[value]])
        score = float(model.score_samples(X)[0])
        pred  = int(model.predict(X)[0])   # 1 = normal, -1 = anomaly
        is_anomalous = pred == -1

        explanation = _explain(
            process_name=process_name,
            metric=metric_name,
            value=value,
            history=history,
            is_anomalous=is_anomalous,
        )

        results.append(AnomalyResult(
            pid=pid,
            process_name=process_name,
            metric=metric_name,
            score=round(score, 4),
            is_anomalous=is_anomalous,
            explanation=explanation,
        ))

    return results


def reset_process(pid: int) -> None:
    """Clear all history and models for a PID (called when process exits/restarts)."""
    keys = [k for k in _history_cache if k[0] == pid]
    for k in keys:
        _history_cache.pop(k, None)
        _model_cache.pop(k, None)
    if keys:
        logger.debug("Reset ML state for PID %d (%d keys cleared)", pid, len(keys))


def reset_all() -> None:
    """Clear all state — useful for testing."""
    _model_cache.clear()
    _history_cache.clear()


def get_history(pid: int, metric: str) -> List[float]:
    """Return the raw history list for a (pid, metric) pair — for forecasting."""
    return list(_history_cache.get((pid, metric), []))


# ── Private helpers ────────────────────────────────────────────────────────────

def _train_model(
    key: tuple,
    history: List[float],
    contamination: float,
) -> IsolationForest:
    """(Re)train an IsolationForest on the current history window."""
    X = np.array(history).reshape(-1, 1)
    model = IsolationForest(
        contamination=contamination,
        random_state=42,
        n_estimators=100,
    )
    model.fit(X)
    _model_cache[key] = model
    return model


def _explain(
    process_name: str,
    metric: str,
    value: float,
    history: List[float],
    is_anomalous: bool,
) -> str:
    """Generate a plain-English explanation for the anomaly result."""
    if not history:
        return ""

    recent = history[-10:] if len(history) >= 10 else history
    avg    = sum(recent) / len(recent)
    pct_change = ((value - avg) / avg * 100) if avg > 0 else 0

    metric_label = {
        "cpu_percent":    "CPU usage",
        "memory_mb":      "memory (RSS)",
        "memory_percent": "memory %",
    }.get(metric, metric)

    unit = "%" if "percent" in metric else " MB"

    if is_anomalous:
        direction = "spike" if value > avg else "drop"
        return (
            f"Process '{process_name}' {metric_label} anomaly detected: "
            f"current={value:.1f}{unit}, recent avg={avg:.1f}{unit} "
            f"({pct_change:+.0f}% {direction})."
        )
    return (
        f"Process '{process_name}' {metric_label} normal: "
        f"{value:.1f}{unit} (avg {avg:.1f}{unit})."
    )
