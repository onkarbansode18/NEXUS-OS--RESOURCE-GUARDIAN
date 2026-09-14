/**
 * Nexus — shared TypeScript types matching reference design & backend API.
 */

// ── System vitals ────────────────────────────────────────────────────────────
export interface SystemMetrics {
  timestamp: string          // ISO-8601
  cpu_percent: number        // 0–100
  cpu_freq_mhz: number
  ram_used_mb: number
  ram_total_mb: number
  ram_percent: number
  disk_used_gb: number
  disk_total_gb: number
  disk_percent: number
  net_bytes_sent: number
  net_bytes_recv: number
}

// ── Per-process snapshot ──────────────────────────────────────────────────────
export type ProcessHealthStatus = 'healthy' | 'under_observation' | 'warning' | 'critical' | 'unknown'

export interface ProcessSnapshot {
  pid: number
  name: string
  cpu_percent: number
  memory_mb: number
  memory_percent: number
  status: string             // 'running' | 'sleeping' | 'zombie' | …
  username: string
  created_at: string
  health_status: ProcessHealthStatus
  anomaly_score?: number     // -1 = anomalous (Isolation Forest)
  cmdline?: string
  uptime?: string
  threads?: number
  memory_trend?: number[]    // array of MB points for sparkline
}

// ── Incident ─────────────────────────────────────────────────────────────────
export type IncidentSeverity = 'info' | 'warning' | 'critical'
export type IncidentStatus = 'open' | 'investigating' | 'monitoring' | 'healing' | 'resolved' | 'dismissed'
export type ActionType =
  | 'renice'
  | 'throttle'
  | 'suspend'
  | 'restart'
  | 'kill'
  | 'observe'
  | 'alert_only'
  | 'no_action'

export interface HealingAction {
  id: string
  incident_id: string
  action_type: ActionType
  action_title?: string
  pid: number
  process_name: string
  simulated: boolean           // true = Simulation Mode
  status_text?: 'Executed' | 'No action' | 'Simulated' | 'Failed'
  before_cpu: number
  before_memory_mb: number
  after_cpu?: number
  after_memory_mb?: number
  executed_at: string
  reason: string
}

export interface IncidentTimelineItem {
  time: string
  text: string
  step: 'SENSE' | 'THINK' | 'DECIDE' | 'ACT' | 'RECORD'
}

export interface Incident {
  id: string
  inc_number?: string        // e.g. "INC-2041"
  pid: number
  process_name: string
  title?: string
  category?: string           // e.g. "Memory leak", "CPU saturation", "Transient I/O"
  severity: IncidentSeverity
  status: IncidentStatus
  description: string        // plain-English explanation
  prediction?: string        // e.g. "RAM exhausted in ~6 min"
  recommended_action?: ActionType
  recommendation_text?: string
  anomaly_score: number
  detected_at: string
  resolved_at?: string
  what_happened?: string
  why_detected?: string
  ml_explanation?: string
  before_memory?: string
  after_memory?: string
  slope?: string
  current_pipeline_step?: 'Sense' | 'Think' | 'Decide' | 'Act' | 'Record'
  timeline?: IncidentTimelineItem[]
  actions: HealingAction[]
}

// ── Policy settings ───────────────────────────────────────────────────────────
export interface Policy {
  simulation_mode: boolean
  cpu_warning_pct: number
  cpu_critical_pct: number
  ram_warning_pct: number
  ram_critical_pct: number
  disk_warning_pct: number
  disk_critical_pct: number
  process_whitelist: string[]  // process names safe to act on in Live Mode
  process_blacklist: string[]  // process names that must NEVER be touched
}

// ── WebSocket envelope ────────────────────────────────────────────────────────
export type WsEventType = 'metrics' | 'incident' | 'action' | 'policy_update'

export interface WsMessage<T = unknown> {
  event: WsEventType
  data: T
  ts: string
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthToken {
  access_token: string
  token_type: 'bearer'
}
