/// <reference types="vite/client" />
/**
 * Nexus API client — typed REST helpers.
 * All methods return typed data or throw on failure.
 */

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('nexus_token')
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`)
  return res.json()
}

export const api = {
  // ── Incidents ──────────────────────────────────────────────────────────────
  fetchIncidents: (status?: string, limit = 100) => {
    const params = new URLSearchParams({ limit: String(limit) })
    if (status) params.set('status', status)
    return request<unknown[]>(`/incidents/?${params}`)
  },

  resolveIncident: (id: string) =>
    request(`/incidents/${id}/resolve`, { method: 'POST' }),

  // ── Policy ─────────────────────────────────────────────────────────────────
  fetchPolicy: () => request<unknown>('/policy/'),

  updatePolicy: (patch: Record<string, unknown>) =>
    request('/policy/', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  // ── Metrics & Processes ───────────────────────────────────────────────────
  fetchMetricsHistory: (minutes = 30) =>
    request<unknown[]>(`/metrics/history?minutes=${minutes}`),

  fetchProcesses: () => request<unknown[]>('/processes/'),

  // ── Actions ────────────────────────────────────────────────────────────────
  executeAction: (action_type: string, pid: number, process_name: string, reason = '') =>
    request('/actions/execute', {
      method: 'POST',
      body: JSON.stringify({ action_type, pid, process_name, reason }),
    }),

  // ── Reports ────────────────────────────────────────────────────────────────
  fetchReportSummary: () => request<unknown>('/reports/summary'),

  generateReport: (format = 'markdown', include_history_minutes = 60) =>
    request<{ status: string; content_type: string; report: string }>('/reports/generate', {
      method: 'POST',
      body: JSON.stringify({ format, include_history_minutes }),
    }),

  exportReportUrl: (format = 'markdown') => `${BASE}/reports/export?format=${format}`,

  generateComplianceReport: () =>
    request<{ status: string; format: string; digest: string; generated_at: string; report_html: string }>(
      '/reports/compliance',
      { method: 'POST' }
    ),

  // ── AI Summarizer ─────────────────────────────────────────────────────────
  summarizeIncident: (id: string) =>
    request<{ incident_id: string; nl_summary: string; nl_slack_message: string; provider: string }>(
      `/incidents/${id}/summarize`,
      { method: 'POST' }
    ),

  // ── Feedback Loop ──────────────────────────────────────────────────────────
  submitFeedback: (incident_id: string, label: string, user_note?: string) =>
    request<{ status: string; fp_rate: number; current_contamination: number }>(`/feedback/`, {
      method: 'POST',
      body: JSON.stringify({ incident_id, label, user_note }),
    }),

  fetchFeedbackStats: () =>
    request<{
      total_feedback: number
      correct_count: number
      false_positive_count: number
      too_aggressive_count: number
      false_positive_rate: number
      current_contamination: number
      auto_tuning_active: boolean
    }>('/feedback/stats'),

  // ── Maintenance Windows ────────────────────────────────────────────────────
  fetchMaintenanceWindows: () => request<any[]>('/maintenance/'),

  createMaintenanceWindow: (data: any) =>
    request('/maintenance/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateMaintenanceWindow: (id: number, data: any) =>
    request(`/maintenance/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteMaintenanceWindow: (id: number) =>
    request(`/maintenance/${id}`, { method: 'DELETE' }),

  checkMaintenanceActive: () =>
    request<{ is_active: boolean; has_defined_windows: boolean; active_windows: any[] }>(
      '/maintenance/active'
    ),

  // ── Auth ───────────────────────────────────────────────────────────────────
  login: async (username: string, password: string): Promise<string> => {
    const form = new URLSearchParams({ username, password })
    const res = await fetch(`${BASE}/auth/token`, {
      method: 'POST',
      body: form,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    if (!res.ok) throw new Error('Login failed')
    const data = await res.json()
    return data.access_token
  },
}

