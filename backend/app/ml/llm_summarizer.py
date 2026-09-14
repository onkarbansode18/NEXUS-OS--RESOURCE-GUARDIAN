"""
Nexus OS — Natural Language Incident Summarizer
Generates plain-English incident summaries and Slack message snippets using Google Gemini
or falls back gracefully to template-based summaries if GEMINI_API_KEY is not configured.
"""

import os
import logging
import json
from typing import Dict, Any
from dotenv import load_dotenv

from app.config import settings

load_dotenv()

logger = logging.getLogger("nexus.llm_summarizer")


def _generate_template_summary(incident_data: Dict[str, Any]) -> Dict[str, str]:
    proc_name = incident_data.get("process_name", "Unknown Process")
    pid = incident_data.get("pid", 0)
    severity = str(incident_data.get("severity", "warning")).upper()
    desc = incident_data.get("description", "High resource consumption detected.")
    prediction = incident_data.get("prediction", "")
    actions = incident_data.get("actions", [])

    action_str = "No automated action taken yet."
    if actions:
        action_names = [a.get("action_type", "action") if isinstance(a, dict) else getattr(a, "action_type", "action") for a in actions]
        action_str = f"Executed mitigation action(s): {', '.join(action_names)}."

    summary = (
        f"[{severity}] Process '{proc_name}' (PID {pid}) was flagged by Nexus Guardian. "
        f"Root Cause: {desc}. "
        f"{f'Predictive Warning: {prediction}. ' if prediction else ''}"
        f"{action_str}"
    )

    slack_msg = (
        f"🚨 *Nexus Guardian Incident Report* [{severity}]\n"
        f"• *Process:* `{proc_name}` (PID: `{pid}`)\n"
        f"• *Diagnosis:* {desc}\n"
        f"{f'• *Forecast:* {prediction}\n' if prediction else ''}"
        f"• *Status/Action:* {action_str}\n"
        f"• *Timestamp:* `{incident_data.get('detected_at', 'Now')}`"
    )

    return {
        "summary": summary,
        "slack_message": slack_msg,
        "provider": "template"
    }


async def generate_incident_summary(incident_data: Dict[str, Any]) -> Dict[str, str]:
    """
    Asynchronously generates an AI summary for an incident.
    Attempts Gemini API call if a valid GEMINI_API_KEY or GOOGLE_API_KEY is available.
    """
    raw_key = (settings.gemini_api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()

    # If key is empty or default placeholder, use template summary directly
    if not raw_key or raw_key.lower().startswith("your_") or "placeholder" in raw_key.lower():
        return _generate_template_summary(incident_data)

    try:
        import httpx
        proc_name = incident_data.get("process_name", "Process")
        pid = incident_data.get("pid", 0)
        desc = incident_data.get("description", "")
        prediction = incident_data.get("prediction", "")
        score = incident_data.get("anomaly_score", 0.0)

        prompt = (
            f"You are Nexus OS AI Guardian. Summarize this system incident concisely in 2 parts.\n"
            f"Incident Details:\n"
            f"- Process: {proc_name} (PID {pid})\n"
            f"- Anomaly Score: {score}\n"
            f"- Reason: {desc}\n"
            f"- Forecast: {prediction}\n\n"
            f"Provide output in this JSON format strictly:\n"
            f'{{"summary": "2-3 sentence plain English summary for DevOps stakeholders", "slack_message": "Formatted Slack message with emojis and code blocks"}}'
        )

        models_to_try = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-exp"]

        async with httpx.AsyncClient(timeout=10.0) as client:
            for model_name in models_to_try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={raw_key}"
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"response_mime_type": "application/json"}
                }
                resp = await client.post(url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    text = data["candidates"][0]["content"]["parts"][0]["text"]
                    parsed = json.loads(text)
                    parsed["provider"] = f"gemini ({model_name})"
                    return parsed
                else:
                    logger.warning(f"Gemini API ({model_name}) status {resp.status_code}: {resp.text}")

    except Exception as e:
        logger.warning(f"Failed to generate Gemini summary, falling back to template: {e}")

    return _generate_template_summary(incident_data)

