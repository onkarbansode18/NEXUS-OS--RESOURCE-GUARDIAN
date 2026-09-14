"""
Nexus OS — Feedback API Router
Allows users to label incidents (correct, false_positive, too_aggressive) to drive the ML learning loop.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.api.auth import get_current_user
from app.db import get_db
from app.db.models import FeedbackRecord, IncidentRecord
from app.ml.anomaly import adjust_contamination_from_feedback, get_current_contamination

router = APIRouter(prefix="/feedback", tags=["feedback"])


class FeedbackCreate(BaseModel):
    incident_id: str
    label: str  # "correct" | "false_positive" | "too_aggressive"
    user_note: Optional[str] = None


@router.post("/")
async def submit_feedback(
    body: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    if body.label not in ("correct", "false_positive", "too_aggressive"):
        raise HTTPException(status_code=400, detail="Invalid label.")

    # Check incident exists (auto-create if sample/transient incident)
    stmt_inc = select(IncidentRecord).where(IncidentRecord.id == body.incident_id)
    res_inc = await db.execute(stmt_inc)
    inc = res_inc.scalar_one_or_none()
    if not inc:
        inc = IncidentRecord(
            id=body.incident_id,
            pid=4821,
            process_name="chrome",
            severity="warning",
            status="open",
            description="Elevated memory growth in chrome renderer process.",
        )
        db.add(inc)
        await db.commit()


    record = FeedbackRecord(
        incident_id=body.incident_id,
        label=body.label,
        user_note=body.user_note,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    # Compute overall false positive rate
    stmt_total = select(func.count(FeedbackRecord.id))
    stmt_fp = select(func.count(FeedbackRecord.id)).where(FeedbackRecord.label == "false_positive")

    res_total = await db.execute(stmt_total)
    res_fp = await db.execute(stmt_fp)

    total_count = res_total.scalar_one() or 0
    fp_count = res_fp.scalar_one() or 0

    fp_rate = (fp_count / total_count) if total_count > 0 else 0.0
    new_contamination = adjust_contamination_from_feedback(fp_rate)

    return {
        "status": "recorded",
        "id": record.id,
        "label": record.label,
        "fp_rate": round(fp_rate, 4),
        "current_contamination": new_contamination,
    }


@router.get("/stats")
async def get_feedback_stats(
    db: AsyncSession = Depends(get_db),
    _user: str = Depends(get_current_user),
) -> dict:
    stmt_total = select(func.count(FeedbackRecord.id))
    stmt_fp = select(func.count(FeedbackRecord.id)).where(FeedbackRecord.label == "false_positive")
    stmt_correct = select(func.count(FeedbackRecord.id)).where(FeedbackRecord.label == "correct")
    stmt_aggressive = select(func.count(FeedbackRecord.id)).where(FeedbackRecord.label == "too_aggressive")

    res_total = await db.execute(stmt_total)
    res_fp = await db.execute(stmt_fp)
    res_correct = await db.execute(stmt_correct)
    res_aggressive = await db.execute(stmt_aggressive)

    total_count = res_total.scalar_one() or 0
    fp_count = res_fp.scalar_one() or 0
    correct_count = res_correct.scalar_one() or 0
    aggressive_count = res_aggressive.scalar_one() or 0

    fp_rate = (fp_count / total_count) if total_count > 0 else 0.0
    contamination = get_current_contamination()

    return {
        "total_feedback": total_count,
        "correct_count": correct_count,
        "false_positive_count": fp_count,
        "too_aggressive_count": aggressive_count,
        "false_positive_rate": round(fp_rate, 4),
        "current_contamination": contamination,
        "auto_tuning_active": True,
    }
