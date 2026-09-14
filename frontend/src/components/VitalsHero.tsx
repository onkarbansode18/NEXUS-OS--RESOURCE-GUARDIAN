import React from 'react'
import { Cpu, HardDrive, ArrowUpRight, ArrowDownRight, Server, Activity } from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, Tooltip,
} from 'recharts'
import { useNexusStore } from '../store'

export function VitalsHero() {
  const { metrics, metricsHistory, policy } = useNexusStore()

  if (!metrics) {
    return (
      <div className="glass-card p-8 flex flex-col items-center justify-center h-48 text-[var(--text-muted)] mb-8 glow-indigo">
        <div className="flex items-center gap-3">
          <span className="live-dot" />
          <span className="font-mono text-xs">INITIALIZING TELEMETRY STREAM...</span>
        </div>
      </div>
    )
  }

  const chartData = metricsHistory.map((m) => ({
    time: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    cpu: parseFloat(m.cpu_percent.toFixed(1)),
    ram: parseFloat(m.ram_percent.toFixed(1)),
    disk: parseFloat(m.disk_percent.toFixed(1)),
  }))

  const getStatusColor = (val: number, warn: number, crit: number) => {
    if (val >= crit) return 'text-rose-400'
    if (val >= warn) return 'text-amber-400'
    return 'text-emerald-400'
  }

  const getBarGradient = (val: number, warn: number, crit: number) => {
    if (val >= crit) return 'linear-gradient(90deg, #f43f5e, #e11d48)'
    if (val >= warn) return 'linear-gradient(90deg, #f59e0b, #d97706)'
    return 'linear-gradient(90deg, #10b981, #06b6d4)'
  }

  const fmtBytes = (b: number) => {
    if (b >= 1e9) return `${(b / 1e9).toFixed(2)} GB/s`
    if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB/s`
    return `${(b / 1e3).toFixed(0)} KB/s`
  }

  return (
    <section className="glass-card p-6 mb-8 shadow-2xl relative overflow-hidden border border-white/10">
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 pb-4 border-b border-white/10 gap-2">
        <div>
          <div className="flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h2 className="text-lg font-bold tracking-tight text-white">System Vitals Overview</h2>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">Real-time kernel telemetry · {metricsHistory.length} continuous samples</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-white/10">
            <span className="live-dot" />
            <span className="font-mono text-cyan-300 font-semibold">{new Date(metrics.timestamp).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* CPU */}
        <VitalCard
          label="CPU Load"
          icon={<Cpu className="w-4 h-4 text-cyan-400" />}
          value={`${metrics.cpu_percent.toFixed(1)}%`}
          sub={`${metrics.cpu_freq_mhz.toFixed(0)} MHz`}
          bar={metrics.cpu_percent}
          barGradient={getBarGradient(metrics.cpu_percent, policy?.cpu_warning_pct ?? 80, policy?.cpu_critical_pct ?? 90)}
          valueClass={getStatusColor(metrics.cpu_percent, policy?.cpu_warning_pct ?? 80, policy?.cpu_critical_pct ?? 90)}
          chartData={chartData}
          chartKey="cpu"
          chartColor="#06b6d4"
        />

        {/* RAM */}
        <VitalCard
          label="Memory (RAM)"
          icon={<Server className="w-4 h-4 text-indigo-400" />}
          value={`${metrics.ram_percent.toFixed(1)}%`}
          sub={`${(metrics.ram_used_mb / 1024).toFixed(1)} / ${(metrics.ram_total_mb / 1024).toFixed(1)} GB`}
          bar={metrics.ram_percent}
          barGradient={getBarGradient(metrics.ram_percent, policy?.ram_warning_pct ?? 80, policy?.ram_critical_pct ?? 90)}
          valueClass={getStatusColor(metrics.ram_percent, policy?.ram_warning_pct ?? 80, policy?.ram_critical_pct ?? 90)}
          chartData={chartData}
          chartKey="ram"
          chartColor="#6366f1"
        />

        {/* Disk */}
        <VitalCard
          label="Disk Storage"
          icon={<HardDrive className="w-4 h-4 text-emerald-400" />}
          value={`${metrics.disk_percent.toFixed(1)}%`}
          sub={`${metrics.disk_used_gb.toFixed(0)} / ${metrics.disk_total_gb.toFixed(0)} GB`}
          bar={metrics.disk_percent}
          barGradient={getBarGradient(metrics.disk_percent, policy?.disk_warning_pct ?? 85, policy?.disk_critical_pct ?? 95)}
          valueClass={getStatusColor(metrics.disk_percent, policy?.disk_warning_pct ?? 85, policy?.disk_critical_pct ?? 95)}
          chartData={chartData}
          chartKey="disk"
          chartColor="#10b981"
        />

        {/* Network */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 flex flex-col justify-between hover:border-indigo-500/40 transition-colors">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" /> Network IO
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">DUPLEX</span>
            </div>
            <div className="space-y-2.5 my-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)] flex items-center gap-1.5 font-medium">
                  <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400" /> Tx Rate
                </span>
                <span className="font-mono font-bold text-white">{fmtBytes(metrics.net_bytes_sent)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)] flex items-center gap-1.5 font-medium">
                  <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" /> Rx Rate
                </span>
                <span className="font-mono font-bold text-white">{fmtBytes(metrics.net_bytes_recv)}</span>
              </div>
            </div>
          </div>
          <div className="pt-2.5 border-t border-white/5 text-[11px] text-[var(--text-muted)] flex justify-between">
            <span>Adapter: Auto</span>
            <span className="font-mono font-bold text-emerald-400">OPTIMAL</span>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Inner sparkline card ──────────────────────────────────────────────────────

interface VitalCardProps {
  label: string
  icon: React.ReactNode
  value: string
  sub: string
  bar: number
  barGradient: string
  valueClass: string
  chartData: any[]
  chartKey: string
  chartColor: string
}

function VitalCard({ label, icon, value, sub, bar, barGradient, valueClass, chartData, chartKey, chartColor }: VitalCardProps) {
  return (
    <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 flex flex-col justify-between hover:border-indigo-500/40 transition-all duration-200">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
            {icon} {label}
          </span>
          <span className="text-[10px] font-mono text-[var(--text-muted)]">{sub}</span>
        </div>
        <div className={`text-3xl font-extrabold font-mono mb-2 tracking-tight ${valueClass}`}>{value}</div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden p-0.5">
          <div
            className="h-full transition-all duration-500 rounded-full"
            style={{ width: `${Math.min(bar, 100)}%`, background: barGradient }}
          />
        </div>
      </div>
      <div className="h-12 mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <Area type="monotone" dataKey={chartKey} stroke={chartColor} fill={chartColor} fillOpacity={0.15} strokeWidth={2} dot={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#090d16',
                borderColor: 'rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                fontSize: '11px',
                color: '#fff',
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
