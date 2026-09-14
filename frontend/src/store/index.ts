/**
 * Zustand global store — live metrics, incidents, auth, policy state.
 */

import { create } from 'zustand'
import type { SystemMetrics, ProcessSnapshot, Incident, Policy, HealingAction } from '../types'
import { api } from '../api/client'

const DEFAULT_POLICY: Policy = {
  simulation_mode: true,
  cpu_warning_pct: 70,
  cpu_critical_pct: 90,
  ram_warning_pct: 80,
  ram_critical_pct: 95,
  disk_warning_pct: 85,
  disk_critical_pct: 95,
  process_whitelist: ['node', 'python', 'vite', 'uvicorn', 'ffmpeg', 'chrome'],
  process_blacklist: ['systemd', 'explorer.exe', 'svchost.exe', 'csrss.exe', 'services.exe'],
}

const INITIAL_HEALING_ACTIONS: HealingAction[] = [
  {
    id: 'act-101',
    incident_id: 'inc-2041',
    action_type: 'renice',
    action_title: 'Renice to +10',
    pid: 2054,
    process_name: 'postgres',
    simulated: false,
    status_text: 'Executed',
    before_cpu: 45.2,
    before_memory_mb: 420,
    executed_at: '10:33:52',
    reason: 'Sustained CPU saturation contending with interactive work.',
  },
  {
    id: 'act-102',
    incident_id: 'inc-2031',
    action_type: 'no_action',
    action_title: 'No action',
    pid: 1288,
    process_name: 'postgres',
    simulated: false,
    status_text: 'No action',
    before_cpu: 6.3,
    before_memory_mb: 820,
    executed_at: '09:55:10',
    reason: 'Transient checkpoint I/O recognized as benign periodic pattern.',
  },
  {
    id: 'act-103',
    incident_id: 'inc-2041',
    action_type: 'restart',
    action_title: 'Restart process',
    pid: 3187,
    process_name: 'python3',
    simulated: true,
    status_text: 'Simulated',
    before_cpu: 9.1,
    before_memory_mb: 3190,
    executed_at: '09:14:03',
    reason: 'Memory usage exceeded configured critical threshold.',
  },
  {
    id: 'act-104',
    incident_id: 'inc-2035',
    action_type: 'throttle',
    action_title: 'Throttle CPU to 25%',
    pid: 6620,
    process_name: 'node',
    simulated: true,
    status_text: 'Simulated',
    before_cpu: 12.7,
    before_memory_mb: 440,
    executed_at: '08:47:20',
    reason: 'Runaway request loop detected during a deploy.',
  },
]

const INITIAL_INCIDENTS: Incident[] = [
  {
    id: 'inc-2041',
    inc_number: 'INC-2041',
    pid: 3190,
    process_name: 'python3',
    title: 'Memory leak suspected in python3 ingest worker',
    category: 'Memory leak',
    severity: 'critical',
    status: 'investigating',
    description: 'Resident memory for the event ingest worker climbed steadily without a matching workload increase.',
    prediction: 'RAM exhausted in ~12 min at current trajectory',
    recommended_action: 'restart',
    recommendation_text: 'Restart process python3 ingest worker',
    anomaly_score: -0.92,
    detected_at: '2026-09-13 10:58:04',
    what_happened: 'python3 (PID 3190) RSS memory grew from 1.2 GB to 3.19 GB over 24 minutes while parsing JSON batches.',
    why_detected: 'Memory growth rate (+82 MB/min) exceeded linear safety window (threshold 30 MB/min). ML score -0.92 indicates anomalous leak pattern.',
    ml_explanation: 'The IsolationForest detector flagged continuous monotonic memory allocation with zero garbage collection dips over 120 consecutive observation windows.',
    before_memory: '3.19 GB current',
    after_memory: '1.2 GB expected post-restart',
    slope: '+82 MB/min current',
    current_pipeline_step: 'Think',
    timeline: [
      { time: '10:58:04', text: 'Monitoring detected abnormal linear memory accumulation', step: 'SENSE' },
      { time: '10:58:06', text: 'ML anomaly engine classified growth pattern as Memory Leak (confidence 0.92)', step: 'THINK' },
      { time: '10:58:07', text: 'Safety engine evaluated process protection blacklist (Passed - ingest worker is permitted)', step: 'DECIDE' },
    ],
    actions: [INITIAL_HEALING_ACTIONS[2]],
  },
  {
    id: 'inc-2038',
    inc_number: 'INC-2038',
    pid: 4821,
    process_name: 'chrome',
    title: 'Elevated memory growth in chrome renderer',
    category: 'Monitoring',
    severity: 'warning',
    status: 'monitoring',
    description: 'A renderer process is accumulating memory faster than its typical session curve.',
    prediction: 'Exceeding soft warning band',
    recommended_action: 'observe',
    recommendation_text: 'Observe',
    anomaly_score: -0.58,
    detected_at: '2026-09-13 10:41:30',
    what_happened: 'chrome (PID 4821) grew from 3.4 GB to 4.85 GB over 18 minutes across several renderer tabs.',
    why_detected: 'Growth is within tolerance for an interactive browser but exceeds the soft warning band, so Nexus is watching rather than acting.',
    ml_explanation: 'The detector scored the trend as borderline (confidence 0.58). Browser workloads have high variance, so the system was downgraded to observation.',
    before_memory: '4.85 GB current',
    after_memory: '4.85 GB current',
    slope: '+80 MB/min current',
    current_pipeline_step: 'Decide',
    timeline: [
      { time: '10:41:30', text: 'Monitoring detected abnormal behavior', step: 'SENSE' },
      { time: '10:41:32', text: 'ML anomaly score scored as borderline (confidence 0.58)', step: 'THINK' },
      { time: '10:41:33', text: 'Decision engine selected Observe policy', step: 'DECIDE' },
    ],
    actions: [],
  },
  {
    id: 'inc-2035',
    inc_number: 'INC-2035',
    pid: 2054,
    process_name: 'ffmpeg',
    title: 'Sustained CPU saturation on ffmpeg transcode',
    category: 'CPU saturation',
    severity: 'warning',
    status: 'resolved',
    resolved_at: '2026-09-13 10:24:11',
    description: 'A transcode job held a full core above the warning threshold for several minutes.',
    recommended_action: 'renice',
    recommendation_text: 'Renice transcode process to +10',
    anomaly_score: -0.65,
    detected_at: '2026-09-13 10:18:22',
    what_happened: 'ffmpeg (PID 2054) consumed 41.2% CPU during high resolution video encoding.',
    why_detected: 'Sustained CPU utilization above 40% for 6 minutes.',
    ml_explanation: 'CPU saturation sustained over 300 seconds; reniced priority to preserve interactive system response.',
    before_memory: '2.0% RAM',
    after_memory: '2.0% RAM',
    slope: '0 MB/min',
    current_pipeline_step: 'Record',
    timeline: [
      { time: '10:18:22', text: 'CPU saturation detected', step: 'SENSE' },
      { time: '10:18:25', text: 'Decision engine executed renice to +10', step: 'ACT' },
      { time: '10:24:11', text: 'Incident resolved after transcode job completed', step: 'RECORD' },
    ],
    actions: [INITIAL_HEALING_ACTIONS[0]],
  },
  {
    id: 'inc-2031',
    inc_number: 'INC-2031',
    pid: 1288,
    process_name: 'postgres',
    title: 'Transient I/O wait on postgres writer',
    category: 'Disk pressure',
    severity: 'info',
    status: 'resolved',
    resolved_at: '2026-09-13 09:52:40',
    description: 'A database process had a transient I/O spike during a checkpoint.',
    recommended_action: 'no_action',
    recommendation_text: 'No action — periodic pattern',
    anomaly_score: 0.12,
    detected_at: '2026-09-13 09:50:10',
    what_happened: 'postgres (PID 1288) experienced elevated disk write throughput during scheduled WAL checkpointing.',
    why_detected: 'Pattern matched known benign periodic checkpoint behavior.',
    ml_explanation: 'Heuristic engine recognized periodic WAL flush signature and suppressed false alert.',
    before_memory: '6.3% CPU',
    after_memory: '6.3% CPU',
    slope: '0 MB/min',
    current_pipeline_step: 'Record',
    timeline: [
      { time: '09:50:10', text: 'WAL checkpoint disk write detected', step: 'SENSE' },
      { time: '09:50:12', text: 'Classified as periodic benign database checkpoint', step: 'THINK' },
      { time: '09:52:40', text: 'Cleared automatically', step: 'RECORD' },
    ],
    actions: [INITIAL_HEALING_ACTIONS[1]],
  },
]

const INITIAL_PROCESSES: ProcessSnapshot[] = [
  {
    pid: 2054,
    name: 'ffmpeg',
    cpu_percent: 41.2,
    memory_mb: 204.8,
    memory_percent: 2.0,
    status: 'running',
    username: 'devon',
    created_at: '10:14:00',
    health_status: 'under_observation',
    cmdline: '/usr/bin/ffmpeg -i raw_feed.mkv -c:v libx264 -preset slow output.mp4',
    uptime: 'up 34m',
    threads: 16,
    memory_trend: [150, 165, 180, 195, 204.8],
  },
  {
    pid: 4821,
    name: 'chrome',
    cpu_percent: 22.4,
    memory_mb: 4854,
    memory_percent: 14.8,
    status: 'running',
    username: 'devon',
    created_at: '07:30:00',
    health_status: 'warning',
    cmdline: '/opt/google/chrome/chrome --type=renderer --utility-sub-type=network',
    uptime: 'up 3h 12m',
    threads: 48,
    memory_trend: [3400, 3800, 4200, 4600, 4854],
  },
  {
    pid: 6620,
    name: 'node',
    cpu_percent: 12.7,
    memory_mb: 440,
    memory_percent: 4.4,
    status: 'running',
    username: 'devon',
    created_at: '08:00:00',
    health_status: 'healthy',
    cmdline: '/usr/bin/node server.js --env=production',
    uptime: 'up 2h 45m',
    threads: 12,
    memory_trend: [410, 420, 430, 435, 440],
  },
  {
    pid: 3190,
    name: 'python3',
    cpu_percent: 9.1,
    memory_mb: 3190,
    memory_percent: 5.6,
    status: 'running',
    username: 'devon',
    created_at: '10:30:00',
    health_status: 'critical',
    anomaly_score: -0.92,
    cmdline: '/usr/bin/python3 ingest_worker.py --batch-size=5000',
    uptime: 'up 28m',
    threads: 8,
    memory_trend: [1200, 1800, 2400, 2900, 3190],
  },
  {
    pid: 8342,
    name: 'code',
    cpu_percent: 7.5,
    memory_mb: 624,
    memory_percent: 6.1,
    status: 'running',
    username: 'devon',
    created_at: '08:15:00',
    health_status: 'healthy',
    cmdline: '/usr/share/code/code --type=renderer',
    uptime: 'up 2h 30m',
    threads: 32,
    memory_trend: [580, 595, 610, 618, 624],
  },
  {
    pid: 1288,
    name: 'postgres',
    cpu_percent: 6.3,
    memory_mb: 840,
    memory_percent: 8.2,
    status: 'running',
    username: 'postgres',
    created_at: '06:00:00',
    health_status: 'under_observation',
    cmdline: 'postgres: main: db_nexus postgres 127.0.0.1 idle',
    uptime: 'up 4h 45m',
    threads: 14,
    memory_trend: [800, 815, 825, 835, 840],
  },
  {
    pid: 917,
    name: 'dockerd',
    cpu_percent: 3.8,
    memory_mb: 318,
    memory_percent: 3.1,
    status: 'running',
    username: 'root',
    created_at: '05:00:00',
    health_status: 'healthy',
    cmdline: '/usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock',
    uptime: 'up 5h 45m',
    threads: 24,
    memory_trend: [300, 305, 310, 314, 318],
  },
  {
    pid: 990,
    name: 'nginx',
    cpu_percent: 2.1,
    memory_mb: 92,
    memory_percent: 0.9,
    status: 'running',
    username: 'www-data',
    created_at: '05:00:00',
    health_status: 'healthy',
    cmdline: 'nginx: worker process',
    uptime: 'up 5h 45m',
    threads: 4,
    memory_trend: [88, 89, 90, 91, 92],
  },
  {
    pid: 7781,
    name: 'redis-server',
    cpu_percent: 1.9,
    memory_mb: 174,
    memory_percent: 1.7,
    status: 'running',
    username: 'redis',
    created_at: '05:00:00',
    health_status: 'healthy',
    cmdline: '/usr/bin/redis-server 127.0.0.1:6379',
    uptime: 'up 5h 45m',
    threads: 6,
    memory_trend: [168, 170, 171, 173, 174],
  },
  {
    pid: 512,
    name: 'systemd',
    cpu_percent: 0.2,
    memory_mb: 30,
    memory_percent: 0.3,
    status: 'running',
    username: 'root',
    created_at: '00:00:00',
    health_status: 'healthy',
    cmdline: '/sbin/init',
    uptime: 'up 10h',
    threads: 1,
    memory_trend: [30, 30, 30, 30, 30],
  },
]

interface NexusState {
  // Auth
  token: string | null
  isAuthenticated: boolean
  setToken: (t: string | null) => void
  logout: () => void

  // Live metrics (updated by WebSocket)
  metrics: SystemMetrics | null
  metricsHistory: SystemMetrics[]
  processes: ProcessSnapshot[]
  setMetrics: (m: SystemMetrics) => void
  setProcesses: (p: ProcessSnapshot[]) => void

  // Incidents
  incidents: Incident[]
  openIncidentCount: number
  recentActions: HealingAction[]
  setIncidents: (inc: Incident[]) => void
  addIncident: (inc: Incident) => void
  resolveIncident: (incidentId: string) => void
  dismissIncident: (incidentId: string) => void

  // Selected Process Drawer State
  selectedProcess: ProcessSnapshot | null
  setSelectedProcess: (p: ProcessSnapshot | null) => void

  // Action Confirmation Modal State
  confirmingAction: {
    incidentId?: string
    pid?: number
    processName?: string
    actionType: string
    actionTitle: string
  } | null
  executingAction: boolean
  lastActionResult: { success: boolean; message: string; simulated: boolean } | null
  setConfirmingAction: (action: NexusState['confirmingAction']) => void
  clearLastActionResult: () => void
  executeAction: (actionType: string, pid: number, processName: string, incidentId?: string) => Promise<void>

  // Policy
  policy: Policy
  fetchPolicy: () => Promise<void>
  setPolicy: (p: Partial<Policy>) => void
  toggleSimulationMode: () => Promise<void>

  // WebSocket state
  wsConnected: boolean
  setWsConnected: (v: boolean) => void
}

const MAX_HISTORY = 120

export const useNexusStore = create<NexusState>((set, get) => ({
  // ── Auth ──────────────────────────────────────────────────────────────────
  token: localStorage.getItem('nexus_token'),
  isAuthenticated: !!localStorage.getItem('nexus_token'),
  setToken: (t) => {
    if (t) localStorage.setItem('nexus_token', t)
    else localStorage.removeItem('nexus_token')
    set({ token: t, isAuthenticated: !!t })
  },
  logout: () => {
    localStorage.removeItem('nexus_token')
    set({ token: null, isAuthenticated: false })
  },

  // ── Live metrics ──────────────────────────────────────────────────────────
  metrics: {
    timestamp: new Date().toISOString(),
    cpu_percent: 28.4,
    cpu_freq_mhz: 3400,
    ram_used_mb: 8450,
    ram_total_mb: 32768,
    ram_percent: 25.8,
    disk_used_gb: 240,
    disk_total_gb: 512,
    disk_percent: 46.8,
    net_bytes_sent: 1420000,
    net_bytes_recv: 5200000,
  },
  metricsHistory: [],
  processes: INITIAL_PROCESSES,
  setMetrics: (m) =>
    set((s) => ({
      metrics: m,
      metricsHistory: [...s.metricsHistory, m].slice(-MAX_HISTORY),
    })),
  setProcesses: (p) => set({ processes: p.length > 0 ? p : INITIAL_PROCESSES }),

  // ── Incidents & Actions ───────────────────────────────────────────────────
  incidents: INITIAL_INCIDENTS,
  openIncidentCount: INITIAL_INCIDENTS.filter((i) => i.status === 'open' || i.status === 'investigating' || i.status === 'monitoring').length,
  recentActions: INITIAL_HEALING_ACTIONS,
  setIncidents: (inc) =>
    set({
      incidents: inc,
      openIncidentCount: inc.filter((i) => i.status === 'open' || i.status === 'investigating' || i.status === 'monitoring').length,
    }),
  addIncident: (inc) =>
    set((s) => {
      const updated = [inc, ...s.incidents.filter((i) => i.id !== inc.id)].slice(0, 200)
      return {
        incidents: updated,
        openIncidentCount: updated.filter((i) => i.status === 'open' || i.status === 'investigating' || i.status === 'monitoring').length,
      }
    }),
  resolveIncident: (incidentId) =>
    set((s) => {
      const updated = s.incidents.map((i) =>
        i.id === incidentId ? { ...i, status: 'resolved' as const, resolved_at: new Date().toISOString() } : i
      )
      return {
        incidents: updated,
        openIncidentCount: updated.filter((i) => i.status === 'open' || i.status === 'investigating' || i.status === 'monitoring').length,
      }
    }),
  dismissIncident: (incidentId) =>
    set((s) => {
      const updated = s.incidents.map((i) =>
        i.id === incidentId ? { ...i, status: 'dismissed' as const } : i
      )
      return {
        incidents: updated,
        openIncidentCount: updated.filter((i) => i.status === 'open' || i.status === 'investigating' || i.status === 'monitoring').length,
      }
    }),

  // ── Process Drawer ────────────────────────────────────────────────────────
  selectedProcess: null,
  setSelectedProcess: (p) => set({ selectedProcess: p }),

  // ── Confirmation Modal ────────────────────────────────────────────────────
  confirmingAction: null,
  executingAction: false,
  lastActionResult: null,
  setConfirmingAction: (action) => set({ confirmingAction: action, lastActionResult: null }),
  clearLastActionResult: () => set({ lastActionResult: null }),
  executeAction: async (actionType, pid, processName, incidentId) => {
    set({ executingAction: true })
    try {
      const result = await api.executeAction(
        actionType,
        pid,
        processName,
        `Action approved via Nexus Dashboard for incident ${incidentId ?? 'manual'}.`,
      ) as any

      const isSimulated = result?.simulated ?? get().policy.simulation_mode
      const isSuccess = result?.success ?? true
      const newPid: number | null = result?.new_pid ?? null

      // Build a rich result message
      let message: string
      if (!isSuccess) {
        message = `\u2717 Action failed \u2014 ${result?.error ?? 'Unknown error'}`
      } else if (isSimulated) {
        message = `\u2713 Simulated \u2014 ${actionType} on ${processName} (PID ${pid}) logged.`
      } else if (actionType === 'restart' && newPid) {
        message = `\u2713 Restarted \u2014 ${processName} killed (PID ${pid}) and relaunched as PID ${newPid}.`
      } else if (actionType === 'restart') {
        message = `\u2713 Restarted \u2014 ${processName} (PID ${pid}) killed. Supervisor will relaunch.`
      } else {
        message = `\u2713 Executed \u2014 ${actionType} on ${processName} (PID ${pid}) completed on host.`
      }

      const newAction: HealingAction = {
        id: `act-${Date.now()}`,
        incident_id: incidentId ?? 'manual',
        action_type: actionType as any,
        action_title: `${actionType.charAt(0).toUpperCase() + actionType.slice(1)} ${processName}`,
        pid,
        process_name: processName,
        simulated: isSimulated,
        status_text: !isSuccess ? 'Failed' : isSimulated ? 'Simulated' : 'Executed',
        before_cpu: result?.before_cpu ?? 0,
        before_memory_mb: result?.before_memory_mb ?? 0,
        after_cpu: result?.after_cpu,
        after_memory_mb: result?.after_memory_mb,
        executed_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        reason: result?.reason ?? `Action ${isSimulated ? 'simulated' : 'executed'} via Nexus Dashboard.`,
      }

      set((s) => {
        const updatedIncidents = s.incidents.map((inc) => {
          if (inc.id === incidentId) {
            return {
              ...inc,
              status: 'resolved' as const,
              resolved_at: new Date().toISOString(),
              actions: [...(inc.actions ?? []), newAction],
              current_pipeline_step: 'Record' as const,
            }
          }
          return inc
        })
        return {
          recentActions: [newAction, ...s.recentActions],
          incidents: updatedIncidents,
          openIncidentCount: updatedIncidents.filter((i) =>
            i.status === 'open' || i.status === 'investigating' || i.status === 'monitoring'
          ).length,
          confirmingAction: null,
          executingAction: false,
          lastActionResult: {
            success: isSuccess,
            message,
            simulated: isSimulated,
          },
        }
      })
    } catch (err: any) {
      const isSimulated = get().policy.simulation_mode
      const errMsg = err?.message ?? String(err)
      const newAction: HealingAction = {
        id: `act-${Date.now()}`,
        incident_id: incidentId ?? 'manual',
        action_type: actionType as any,
        action_title: `${actionType.charAt(0).toUpperCase() + actionType.slice(1)} ${processName}`,
        pid,
        process_name: processName,
        simulated: true,
        status_text: 'Failed',
        before_cpu: 0,
        before_memory_mb: 0,
        executed_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        reason: `Action failed \u2014 backend error: ${errMsg}`,
      }
      set((s) => {
        const updatedIncidents = s.incidents.map((inc) => {
          if (inc.id === incidentId) {
            return { ...inc, status: 'resolved' as const, resolved_at: new Date().toISOString(), actions: [...(inc.actions ?? []), newAction] }
          }
          return inc
        })
        return {
          recentActions: [newAction, ...s.recentActions],
          incidents: updatedIncidents,
          openIncidentCount: updatedIncidents.filter((i) =>
            i.status === 'open' || i.status === 'investigating' || i.status === 'monitoring'
          ).length,
          confirmingAction: null,
          executingAction: false,
          lastActionResult: {
            success: false,
            message: isSimulated
              ? `\u2713 Simulated locally \u2014 ${actionType} on ${processName} logged (backend offline).`
              : `\u2717 Live action failed \u2014 ${errMsg}`,
            simulated: isSimulated,
          },
        }
      })
    }
  },

  // ── Policy ────────────────────────────────────────────────────────────────
  policy: DEFAULT_POLICY,
  fetchPolicy: async () => {
    try {
      const backendPolicy = await api.fetchPolicy() as any
      if (backendPolicy && typeof backendPolicy.simulation_mode === 'boolean') {
        set((s) => ({ policy: { ...s.policy, ...backendPolicy } }))
      }
    } catch (e) {
      console.warn('Failed to fetch policy from backend:', e)
    }
  },
  setPolicy: (p) =>
    set((s) => ({
      policy: { ...s.policy, ...p },
    })),
  toggleSimulationMode: async () => {
    const current = get().policy.simulation_mode
    const next = !current
    set((s) => ({
      policy: { ...s.policy, simulation_mode: next },
    }))
    try {
      await api.updatePolicy({ simulation_mode: next })
    } catch (e) {
      console.error('Failed to sync simulation_mode to backend:', e)
    }
  },

  // ── WebSocket ─────────────────────────────────────────────────────────────
  wsConnected: true,
  setWsConnected: (v) => set({ wsConnected: v }),
}))
