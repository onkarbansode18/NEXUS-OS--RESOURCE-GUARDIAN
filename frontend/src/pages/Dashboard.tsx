import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, ChevronRight, ShieldAlert, Zap, Cpu, Server, HardDrive, ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react'
import { Header } from '../components'
import { useNexusStore } from '../store'

export function Dashboard() {
  const { metrics, incidents, recentActions } = useNexusStore()
  const navigate = useNavigate()

  const openIncidents = incidents.filter((i) => i.status !== 'resolved' && i.status !== 'dismissed')
  const forecastWarnings = incidents.filter((i) => i.prediction || i.description.includes('Imminent'))

  return (
    <div className="page font-plex">
      <Header
        title="Dashboard"
        description="Real-time system telemetry and autonomous guardian operations"
      />

      {/* Vitals Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#64748b] font-medium">
            <span className="flex items-center gap-1.5"><Cpu size={15} className="text-[#3b82f6]" /> CPU Load</span>
            <span className="font-mono">{metrics?.cpu_freq_mhz.toFixed(0) || 3400} MHz</span>
          </div>
          <div className="text-3xl font-bold font-mono text-[#0f172a]">
            {metrics?.cpu_percent.toFixed(1) || 28.4}%
          </div>
          <div className="w-full h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden">
            <div className="h-full bg-[#3b82f6] rounded-full" style={{ width: `${metrics?.cpu_percent || 28}%` }} />
          </div>
        </div>

        {/* Memory */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#64748b] font-medium">
            <span className="flex items-center gap-1.5"><Server size={15} className="text-[#10b981]" /> Memory</span>
            <span className="font-mono">{(metrics?.ram_used_mb || 8450) / 1024 > 1 ? `${((metrics?.ram_used_mb || 8450)/1024).toFixed(1)} GB` : `${metrics?.ram_used_mb || 8450} MB`}</span>
          </div>
          <div className="text-3xl font-bold font-mono text-[#0f172a]">
            {metrics?.ram_percent.toFixed(1) || 25.8}%
          </div>
          <div className="w-full h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden">
            <div className="h-full bg-[#10b981] rounded-full" style={{ width: `${metrics?.ram_percent || 25}%` }} />
          </div>
        </div>

        {/* Disk */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#64748b] font-medium">
            <span className="flex items-center gap-1.5"><HardDrive size={15} className="text-[#f59e0b]" /> Disk Storage</span>
            <span className="font-mono">{metrics?.disk_used_gb || 240} / {metrics?.disk_total_gb || 512} GB</span>
          </div>
          <div className="text-3xl font-bold font-mono text-[#0f172a]">
            {metrics?.disk_percent.toFixed(1) || 46.8}%
          </div>
          <div className="w-full h-1.5 bg-[#e2e8f0] rounded-full overflow-hidden">
            <div className="h-full bg-[#f59e0b] rounded-full" style={{ width: `${metrics?.disk_percent || 46}%` }} />
          </div>
        </div>

        {/* Network */}
        <div className="card p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#64748b] font-medium">
            <span className="flex items-center gap-1.5"><ArrowUpRight size={15} className="text-[#8b5cf6]" /> Network</span>
            <span className="font-mono font-semibold text-[#10b981]">OK</span>
          </div>
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#64748b] flex items-center gap-1"><ArrowUpRight size={12} /> Sent</span>
              <span className="font-mono font-medium">1.42 MB/s</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#64748b] flex items-center gap-1"><ArrowDownRight size={12} /> Recv</span>
              <span className="font-mono font-medium">5.20 MB/s</span>
            </div>
          </div>
        </div>
      </div>

      {/* Predictive Warnings Banner */}
      {forecastWarnings.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-500 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#0f172a]">
                Predictive Resource Exhaustion Warnings ({forecastWarnings.length})
              </h4>
              <p className="text-xs text-[#64748b]">
                Nexus forecasting detected growth trends heading toward exhaustion limit.
              </p>
            </div>
          </div>
          <Link
            to="/predictions"
            className="text-xs font-semibold bg-[#f59e0b] text-slate-950 px-3 py-1.5 rounded-lg hover:bg-amber-400 transition"
          >
            View Predictions →
          </Link>
        </div>
      )}


      {/* Main Grid: Incidents Left, Actions Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Active Incidents */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#0f172a]">Active incidents</h2>
              <p className="text-xs text-[#64748b]">
                {openIncidents.length} open · {incidents.length} total today
              </p>
            </div>
            <Link
              to="/incidents"
              className="text-xs font-semibold text-[#059669] hover:underline flex items-center gap-1"
            >
              View all <ChevronRight size={14} />
            </Link>
          </div>

          <div className="space-y-3">
            {incidents.map((inc) => {
              const getBadgeStyle = (severity: string) => {
                if (severity === 'critical') return 'badge-critical'
                if (severity === 'warning') return 'badge-warning'
                return 'badge-info'
              }

              const getStatusBtn = (status: string) => {
                if (status === 'investigating') return { label: 'Investigating', color: 'bg-[#fffbeb] text-[#d97706] border-[#fde68a]' }
                if (status === 'monitoring') return { label: 'Monitoring', color: 'bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe]' }
                if (status === 'resolved') return { label: 'Resolved', color: 'bg-[#ecfdf5] text-[#059669] border-[#a7f3d0]' }
                return { label: 'Active', color: 'bg-[#f8fafc] text-[#475569] border-[#e2e8f0]' }
              }

              const statusInfo = getStatusBtn(inc.status)

              return (
                <div
                  key={inc.id}
                  onClick={() => navigate(`/incidents/${inc.id}`)}
                  className="card p-4 card-hover cursor-pointer flex items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-md border flex items-center gap-1 ${getBadgeStyle(inc.severity)}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span className="capitalize">{inc.severity}</span>
                        {inc.inc_number && <span className="font-mono font-bold ml-1">{inc.inc_number}</span>}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-[#0f172a]">{inc.title}</h3>
                    <p className="text-xs text-[#64748b] font-mono">
                      {inc.process_name} · PID {inc.pid} · {inc.detected_at.split(' ')[1] || '10:58:04'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 text-xs font-medium rounded-lg border flex items-center gap-1 ${statusInfo.color}`}>
                      <span>{statusInfo.label}</span>
                      <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Column: Recent Healing Actions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#0f172a]">Recent Healing Actions</h2>
          </div>

          <div className="space-y-3">
            {recentActions.map((act) => (
              <div key={act.id} className="card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#0f172a]">
                    {act.action_title || `${act.action_type.toUpperCase()} ${act.process_name}`}
                  </span>
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-md border ${
                    act.status_text === 'Executed'
                      ? 'bg-[#ecfdf5] text-[#059669] border-[#a7f3d0]'
                      : act.status_text === 'No action'
                        ? 'bg-[#f1f5f9] text-[#64748b] border-[#e2e8f0]'
                        : 'bg-[#eff6ff] text-[#2563eb] border-[#bfdbfe]'
                  }`}>
                    {act.status_text || (act.simulated ? 'Simulated' : 'Executed')}
                  </span>
                </div>

                <p className="text-xs text-[#64748b] leading-relaxed">
                  {act.reason}
                </p>

                <div className="text-[11px] font-mono text-[#94a3b8] pt-1 flex items-center justify-between">
                  <span>{act.process_name} · PID {act.pid}</span>
                  <span>{act.executed_at}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
