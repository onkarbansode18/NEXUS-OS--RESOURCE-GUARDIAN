import React from 'react'
import { X, Cpu, HardDrive, RefreshCw, Gauge, Sliders, Eye, AlertTriangle } from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area } from 'recharts'
import { useNexusStore } from '../store'

export function ProcessDrawer() {
  const { selectedProcess, setSelectedProcess, setConfirmingAction } = useNexusStore()

  if (!selectedProcess) return null

  const chartData = selectedProcess.memory_trend
    ? selectedProcess.memory_trend.map((val, idx) => ({ idx, val }))
    : [
        { idx: 0, val: selectedProcess.memory_mb * 0.7 },
        { idx: 1, val: selectedProcess.memory_mb * 0.8 },
        { idx: 2, val: selectedProcess.memory_mb * 0.88 },
        { idx: 3, val: selectedProcess.memory_mb * 0.94 },
        { idx: 4, val: selectedProcess.memory_mb },
      ]

  const handleActionClick = (actionType: string, actionTitle: string) => {
    setConfirmingAction({
      pid: selectedProcess.pid,
      processName: selectedProcess.name,
      actionType,
      actionTitle,
    })
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity"
        onClick={() => setSelectedProcess(null)}
      />

      {/* Slide-over panel */}
      <div className="relative w-full max-w-md bg-white shadow-2xl h-full flex flex-col z-10 border-l border-[#e2e8f0]">
        {/* Header */}
        <div className="p-6 border-b border-[#e2e8f0] flex items-start justify-between bg-[#f8fafc]">
          <div>
            <h2 className="text-xl font-bold text-[#0f172a]">{selectedProcess.name}</h2>
            <p className="text-xs font-mono text-[#64748b] mt-0.5">
              PID {selectedProcess.pid} · {selectedProcess.username} · {selectedProcess.uptime || 'up 2h 15m'}
            </p>
            {selectedProcess.health_status !== 'healthy' && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[#fffbeb] text-[#d97706] border border-[#fde68a]">
                <AlertTriangle size={14} />
                <span>Warning · Memory growth 10m ago</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setSelectedProcess(null)}
            className="p-1.5 rounded-lg text-[#64748b] hover:bg-[#e2e8f0] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Command Line Box */}
          <div>
            <label className="text-xs font-semibold text-[#64748b] uppercase tracking-wider block mb-1.5">
              Command
            </label>
            <div className="p-3 rounded-lg bg-[#0f172a] text-[#f8fafc] font-mono text-xs break-all">
              {selectedProcess.cmdline || `/opt/google/${selectedProcess.name}/${selectedProcess.name} --type=renderer`}
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
              <div className="flex items-center gap-1.5 text-xs text-[#64748b] font-medium mb-1">
                <Cpu size={14} className="text-[#3b82f6]" /> CPU
              </div>
              <div className="text-2xl font-bold font-mono text-[#0f172a]">
                {selectedProcess.cpu_percent.toFixed(1)}%
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
              <div className="flex items-center gap-1.5 text-xs text-[#64748b] font-medium mb-1">
                <HardDrive size={14} className="text-[#10b981]" /> Memory
              </div>
              <div className="text-2xl font-bold font-mono text-[#0f172a]">
                {selectedProcess.memory_percent.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Sparkline Chart */}
          <div className="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[#64748b]">Memory trend (resident)</span>
              <span className="text-xs font-mono font-bold text-[#0f172a]">
                {(selectedProcess.memory_mb / 1024).toFixed(2)} GB
              </span>
            </div>
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <Area
                    type="monotone"
                    dataKey="val"
                    stroke="#f97316"
                    fill="#ffedd5"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Additional details */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <span className="text-xs text-[#64748b] font-medium block">Threads</span>
              <span className="text-lg font-bold font-mono text-[#0f172a]">
                {selectedProcess.threads || 48}
              </span>
            </div>
            <div>
              <span className="text-xs text-[#64748b] font-medium block">Memory (MB)</span>
              <span className="text-lg font-bold font-mono text-[#0f172a]">
                {selectedProcess.memory_mb.toFixed(0)}
              </span>
            </div>
          </div>

          {/* Corrective Actions */}
          <div className="pt-4 border-t border-[#e2e8f0]">
            <label className="text-xs font-semibold text-[#64748b] uppercase tracking-wider block mb-3">
              Corrective actions
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleActionClick('restart', 'Restart')}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#ef4444] text-white hover:bg-[#dc2626] transition-colors"
              >
                <RefreshCw size={14} /> Restart
              </button>

              <button
                onClick={() => handleActionClick('throttle', 'Throttle')}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#ea580c] text-white hover:bg-[#c2410c] transition-colors"
              >
                <Gauge size={14} /> Throttle
              </button>

              <button
                onClick={() => handleActionClick('renice', 'Renice')}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#f1f5f9] text-[#0f172a] border border-[#cbd5e1] hover:bg-[#e2e8f0] transition-colors"
              >
                <Sliders size={14} /> Renice
              </button>

              <button
                onClick={() => handleActionClick('observe', 'Observe')}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-[#f1f5f9] text-[#0f172a] border border-[#cbd5e1] hover:bg-[#e2e8f0] transition-colors"
              >
                <Eye size={14} /> Observe
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
