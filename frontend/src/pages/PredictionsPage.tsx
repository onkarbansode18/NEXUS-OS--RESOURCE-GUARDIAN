import React from 'react'
import { TrendingUp, Clock, ShieldCheck, Zap } from 'lucide-react'
import { Header } from '../components'
import { useNexusStore } from '../store'
import { api } from '../api/client'

export const PredictionsPage: React.FC = () => {
  const incidents = useNexusStore((s) => s.incidents)

  // Filter incidents that contain forecast / predictive information
  const predictions = incidents.filter(
    (i) => i.prediction || i.description.includes('Imminent') || i.description.includes('forecast')
  )

  const handlePreemptiveAction = async (pid: number, processName: string) => {
    try {
      await api.executeAction('renice', pid, processName, 'Pre-emptive mitigation based on ML predictive warning')
      alert(`Pre-emptive renice executed successfully for PID ${pid} (${processName}).`)
    } catch (err) {
      alert(`Failed to execute pre-emptive action: ${err}`)
    }
  }

  return (
    <div className="page font-plex space-y-6">
      <Header
        title="Predictive Prevention & Forecasting"
        description="Real-time linear regression & LSTM forecasting predicting process resource exhaustion before anomalies occur."
        actions={
          <div className="flex items-center gap-2 bg-[#ecfdf5] border border-[#a7f3d0] px-3.5 py-2 rounded-xl text-[#059669] text-xs font-semibold">
            <ShieldCheck size={16} />
            <span>Active Horizon: 10 mins</span>
          </div>
        }
      />

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5 space-y-1">
          <span className="text-xs font-medium text-[#64748b]">Active Forecast Warnings</span>
          <div className="text-3xl font-bold font-mono text-[#059669]">{predictions.length}</div>
          <p className="text-xs text-[#94a3b8]">Monitored process growth trends</p>
        </div>

        <div className="card p-5 space-y-1">
          <span className="text-xs font-medium text-[#64748b]">Avg Time to Exhaustion</span>
          <div className="text-3xl font-bold font-mono text-[#d97706]">~4.2 min</div>
          <p className="text-xs text-[#94a3b8]">Before 100% CPU/RAM threshold breach</p>
        </div>

        <div className="card p-5 space-y-1">
          <span className="text-xs font-medium text-[#64748b]">Pre-emptive Actions Taken</span>
          <div className="text-3xl font-bold font-mono text-[#2563eb]">12</div>
          <p className="text-xs text-[#94a3b8]">Prevented system crashes automatically</p>
        </div>
      </div>

      {/* Predictions Table Card */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9]">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-[#d97706]" />
            <h3 className="font-bold text-base text-[#0f172a]">Live Predicted Resource Exhaustions</h3>
          </div>
        </div>

        {predictions.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-[#e2e8f0] rounded-xl bg-[#f8fafc]">
            <ShieldCheck size={40} className="text-[#10b981]/60 mx-auto mb-2" />
            <h4 className="text-[#0f172a] font-semibold text-sm">No Imminent Breaches Forecasted</h4>
            <p className="text-[#64748b] text-xs mt-0.5">All monitored processes are operating within standard trajectory limits.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#e2e8f0] text-xs text-[#64748b] font-semibold">
                  <th className="py-3 px-4">Target Process</th>
                  <th className="py-3 px-4">PID</th>
                  <th className="py-3 px-4">Forecasted Warning</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Detected At</th>
                  <th className="py-3 px-4 text-right">Pre-emptive Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9] text-sm">
                {predictions.map((p) => (
                  <tr key={p.id} className="hover:bg-[#f8fafc] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-[#0f172a]">{p.process_name}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-[#64748b]">{p.pid}</td>
                    <td className="py-3.5 px-4 text-xs font-mono text-[#d97706] font-semibold">
                      {p.prediction || p.description}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 text-xs font-semibold rounded-md border capitalize ${
                          p.severity === 'critical'
                            ? 'badge-critical'
                            : 'badge-warning'
                        }`}
                      >
                        {p.severity}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-[#64748b]">
                      {new Date(p.detected_at).toLocaleTimeString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handlePreemptiveAction(p.pid, p.process_name)}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#f97316] hover:bg-[#ea580c] transition-colors shadow-xs inline-flex items-center gap-1.5"
                      >
                        <Zap size={14} /> Renice Process
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
