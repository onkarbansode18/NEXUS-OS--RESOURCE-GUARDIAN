"""
Nexus configuration — all settings pulled from environment variables.
Uses pydantic-settings so Docker / Railway / Render env vars just work.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Application ─────────────────────────────────────────────────────────
    app_env: str = "development"
    debug: bool = True
    secret_key: str = "change-me-in-production"

    # ── Database ─────────────────────────────────────────────────────────────
    # SQLite for dev  →  set DATABASE_URL=postgresql://... for prod
    database_url: str = "sqlite+aiosqlite:///./nexus.db"

    # ── Monitoring Agent ──────────────────────────────────────────────────────
    metrics_interval_seconds: float = 2.0   # how often psutil polls
    metrics_history_minutes: int = 60        # rolling window kept in DB

    # ── ML Engine ────────────────────────────────────────────────────────────
    anomaly_contamination: float = 0.05      # Isolation Forest contamination
    forecast_horizon_minutes: int = 10       # how far ahead to predict
    gemini_api_key: str = ""                 # Google Gemini API key for LLM summaries


    # ── Decision / Action ────────────────────────────────────────────────────
    simulation_mode: bool = True             # SAFE DEFAULT — no real OS actions
    cpu_warning_pct: float = 85.0
    cpu_critical_pct: float = 95.0
    ram_warning_pct: float = 80.0
    ram_critical_pct: float = 92.0
    disk_warning_pct: float = 85.0
    disk_critical_pct: float = 95.0

    # ── Auth ─────────────────────────────────────────────────────────────────
    admin_username: str = "admin"
    admin_password: str = "nexus2024"        # change before any real deploy
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 480   # 8 h


settings = Settings()
