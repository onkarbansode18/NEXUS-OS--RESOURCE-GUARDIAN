# Nexus — AI-Powered Self-Healing OS Resource Guardian

> Nexus continuously monitors system resources, uses ML to detect anomalies and predict failures before they happen, and autonomously takes corrective action — with full transparency and audit logging.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   NEXUS DASHBOARD (React)                   │
│  Live vitals · Process table · Incident timeline · Policies │
└───────────────────────────▲─────────────────────────────────┘
                             │ REST + WebSocket
┌───────────────────────────┴─────────────────────────────────┐
│                   API GATEWAY (FastAPI)                      │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  Monitoring  │  ML Engine   │  Decision    │  Action        │
│  Agent       │  (Isolation  │  Engine      │  Executor      │
│  (psutil)    │  Forest +    │  (rules+ML)  │  (heal)        │
│              │  Forecasting)│              │                │
└──────────────┴──────────────┴──────────────┴────────────────┘
                             │
                    ┌────────┴────────┐
                    │  SQLite / PgSQL │  ← metrics, incidents, audit log
                    └─────────────────┘
```

## Quick Start

### Prerequisites
- Python 3.12+
- Node.js 20+
- (Optional) Docker + Docker Compose for containerised run

---

### 1 · Run Backend (dev)

```powershell
cd backend

# Create a virtual environment
python -m venv .venv
.\.venv\Scripts\activate      # Windows
# source .venv/bin/activate   # macOS / Linux

# Install dependencies
pip install -r requirements.txt

# Copy env file and adjust as needed
copy .env.example .env

# Start the API server
uvicorn app.main:app --reload --port 8000
```

API is now live at **http://localhost:8000**  
Interactive docs: **http://localhost:8000/docs**

---

### 2 · Run Frontend (dev)

```powershell
cd frontend
npm install
npm run dev
```

Dashboard is now live at **http://localhost:5173**

---

### 3 · Run with Docker Compose (both services)

```powershell
# From the repo root
docker compose up --build
```

| Service   | URL                       |
|-----------|---------------------------|
| Dashboard | http://localhost:5173      |
| API       | http://localhost:8000      |
| API Docs  | http://localhost:8000/docs |

---

## Project Structure

```
nexus/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app + CORS
│   │   ├── config.py        # All settings via env vars
│   │   ├── monitoring/      # psutil agent (Phase 1)
│   │   ├── db/              # SQLAlchemy models + migrations (Phase 2)
│   │   ├── ml/              # Anomaly detection + forecasting (Phase 3)
│   │   ├── decision/        # Decision engine + safety guardrails (Phase 4)
│   │   ├── executor/        # Simulation + live healing (Phase 5)
│   │   └── api/             # REST routes + WebSocket (Phase 6)
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Dashboard / Processes / Incidents / Policies / Settings
│   │   ├── hooks/           # Custom React hooks (WebSocket, API)
│   │   ├── store/           # Zustand global state
│   │   └── types/           # TypeScript types mirroring API schemas
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

---

## Safety

Nexus ships with **Simulation Mode ON by default**. In this mode it detects anomalies, decides on corrective actions, and logs everything — but never touches a real process. You must explicitly enable Live Mode in the Policies page, which requires confirmation.

In Live Mode, Nexus will never act on:
- PID 1 or any kernel thread
- Any process in the built-in system blacklist (systemd, svchost, lsass, etc.)
- Any process not explicitly in your personal whitelist

---

## Build Phases

| Phase | Status | What it adds |
|-------|--------|-------------|
| 0 | ✅ | Repo scaffold, env setup |
| 1 | 🔜 | Monitoring Agent (psutil) |
| 2 | 🔜 | SQLite storage + schema |
| 3 | 🔜 | ML Engine (anomaly + forecasting) |
| 4 | 🔜 | Decision Engine + safety guardrails |
| 5 | 🔜 | Action Executor (Simulation + Live) |
| 6 | 🔜 | FastAPI REST + WebSocket |
| 7 | 🔜 | React dashboard (full design spec) |
| 8 | 🔜 | End-to-end wiring + audit logging |
| 9 | 🔜 | Integration tests (memory leak + CPU hog simulation) |
| 10 | 🔜 | Docker + deployment (Render / Vercel) |

---

## Environment Variables

See [`backend/.env.example`](backend/.env.example) for the full list.

Key variables:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite+aiosqlite:///./nexus.db` | DB connection string |
| `SIMULATION_MODE` | `true` | Safe mode — no real OS actions |
| `METRICS_INTERVAL_SECONDS` | `2.0` | Polling frequency |
| `CPU_CRITICAL_PCT` | `95.0` | CPU threshold for critical alert |
| `RAM_CRITICAL_PCT` | `92.0` | RAM threshold for critical alert |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | FastAPI (async) |
| Monitoring | psutil |
| ML | scikit-learn (Isolation Forest), statsmodels |
| Database | SQLite → PostgreSQL |
| ORM / Migrations | SQLAlchemy 2.0, Alembic |
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS |
| Realtime | WebSockets (native FastAPI) |
| Containers | Docker + Docker Compose |
| Deployment | Render/Railway (backend), Vercel (frontend) |
