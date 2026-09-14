import React from 'react'
import { AlertOctagon, CheckCircle2, ShieldAlert, Zap, Clock, ArrowRight, Check } from 'lucide-react'
import { useNexusStore } from '../store'
import { api } from '../api/client'

export function IncidentStream({ limit }: { limit?: number }) {
  const { incidents, resolveIncident, policy } = useNexusStore()

  let displayedIncidents = [...incidents]
  if (limit) {
    displayedIncidents = displayedIncidents.slice(0, limit)
  }

  const handleResolve = async (incidentId: string) => {
    try {
      await api.resolveIncident(incidentId)
      resolveIncident(incidentId)
    } catch (err) {
      console.error('Failed to resolve incident:', err)
      resolveIncident(incidentId) // optimistic update
    }
  }

  if (incidents.length === 0) {
    return (
      <div className="glass-card p-8 text-center text-[var(--text-muted)] border border-white/10 shadow-2xl">
        <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400 animate-pulse" />
        <h3 className="font-bold text-lg text-white">All OS Telemetry Optimal</h3>
        <p className="text-xs mt-1 text-[var(--text-muted)]">No active incidents or resource anomalies detected by ML Guardian.</p>
      </div>
    )
  }

  return (
    <div className="glass-card overflow-hidden border border-white/10 shadow-2xl">
      <div className="p-5 border-b border-white/10 flex items-center justify-between bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-base text-white">
            Incident Stream & Healing Audit Log
          </h3>
        </div>
        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
          {incidents.filter((i) => i.status === 'open').length} Open Anomalies
        </span>
      </div>

      <div className="divide-y divide-white/5">
        {displayedIncidents.map((incident) => {
          const isResolved = incident.status === 'resolved'

          return (
            <div key={incident.id} className="p-5 hover:bg-indigo-500/5 transition-colors">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
                <div className="flex items-start gap-3.5">
                  <div className={`p-2.5 rounded-xl mt-0.5 border shadow-md ${
                    incident.severity === 'critical' 
                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' 
                      : incident.severity === 'warning'
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                  }`}>
                    <AlertOctagon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono font-extrabold text-sm text-white">
                        {incident.process_name} <span className="text-cyan-400">(PID {incident.pid})</span>
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-md uppercase border ${
                        incident.severity === 'critical' 
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}>
                        {incident.severity}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-md capitalize border ${
                        isResolved 
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                      }`}>
                        State: {incident.status}
                      </span>
                    </div>

                    {/* Description & Forecast */}
                    <p className="text-xs font-medium text-slate-200 mt-1">
                      {incident.description}
                    </p>
                    {incident.prediction && (
                      <p className="text-xs text-rose-300 font-mono mt-1 flex items-center gap-1.5 font-semibold">
                        <Clock className="w-3.5 h-3.5 text-rose-400" /> ML Forecast: {incident.prediction}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right side status / resolve button */}
                <div className="flex items-center gap-3 self-end md:self-auto">
                  {!isResolved ? (
                    <button
                      onClick={() => handleResolve(incident.id)}
                      className="btn btn-secondary text-xs"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-400" /> Resolve Incident
                    </button>
                  ) : (
                    <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> RESOLVED
                    </span>
                  )}
                </div>
              </div>

              {/* Healing Actions Audit Sub-card */}
              {incident.actions && incident.actions.length > 0 && (
                <div className="mt-3.5 ml-0 md:ml-12 p-3.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-2">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between border-b border-white/5 pb-2">
                    <span>AUTONOMOUS HEALING ACTIONS AUDIT</span>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border ${
                      policy?.simulation_mode ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    }`}>
                      {policy?.simulation_mode ? 'SIMULATION MODE' : 'LIVE OS EXECUTED'}
                    </span>
                  </div>

                  <div className="space-y-2 pt-1">
                    {incident.actions.map((act) => (
                      <div key={act.id} className="text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Zap className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="font-mono font-bold capitalize text-white">{act.action_type}</span>
                          <span className="text-[var(--text-muted)]">— {act.reason}</span>
                        </div>

                        <div className="font-mono text-[11px] text-slate-300 flex items-center gap-2">
                          <span>CPU {act.before_cpu.toFixed(1)}%</span>
                          <span className="text-slate-600">|</span>
                          <span>RAM {act.before_memory_mb.toFixed(0)}MB</span>
                          {act.after_memory_mb !== undefined && (
                            <>
                              <ArrowRight className="w-3 h-3 text-cyan-400" />
                              <span className="text-emerald-400 font-bold">
                                {act.after_memory_mb.toFixed(0)}MB
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
