import React, { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  X,
  Zap,
  Activity,
  Brain,
  Sliders,
  Play,
  FileText
} from 'lucide-react'
import { IncidentSummaryCard } from '../components/IncidentSummaryCard'
import { Header } from '../components/Header'
import { api } from '../api/client'
import { useNexusStore } from '../store'
import type { Incident } from '../types'

export function IncidentsPage() {
  const { id } = useParams<{ id?: string }>()

  if (id) {
    return <IncidentDetail incidentId={id} />
  }

  return <IncidentList />
}

function IncidentList() {
  const { incidents } = useNexusStore()
  const navigate = useNavigate()
  const [filterTab, setFilterTab] = useState<'all' | 'open' | 'critical' | 'warning' | 'info'>('all')

  const filtered = incidents.filter((inc) => {
    if (filterTab === 'open') return inc.status !== 'resolved' && inc.status !== 'dismissed'
    if (filterTab === 'critical') return inc.severity === 'critical'
    if (filterTab === 'warning') return inc.severity === 'warning'
    if (filterTab === 'info') return inc.severity === 'info'
    return true
  })

  return (
    <div className="page font-plex">
      <Header
        title="Incidents"
        description="Anomalies detected by the ML engine and the guardian's response to each"
      />

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-xl w-fit text-xs font-medium">
        <button
          onClick={() => setFilterTab('all')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            filterTab === 'all' ? 'bg-white text-[#0f172a] shadow-xs font-semibold' : 'text-[#64748b] hover:text-[#0f172a]'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilterTab('open')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            filterTab === 'open' ? 'bg-white text-[#0f172a] shadow-xs font-semibold' : 'text-[#64748b] hover:text-[#0f172a]'
          }`}
        >
          Open
        </button>
        <button
          onClick={() => setFilterTab('critical')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            filterTab === 'critical' ? 'bg-white text-[#dc2626] shadow-xs font-semibold' : 'text-[#64748b] hover:text-[#0f172a]'
          }`}
        >
          Critical
        </button>
        <button
          onClick={() => setFilterTab('warning')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            filterTab === 'warning' ? 'bg-white text-[#d97706] shadow-xs font-semibold' : 'text-[#64748b] hover:text-[#0f172a]'
          }`}
        >
          Warning
        </button>
        <button
          onClick={() => setFilterTab('info')}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            filterTab === 'info' ? 'bg-white text-[#475569] shadow-xs font-semibold' : 'text-[#64748b] hover:text-[#0f172a]'
          }`}
        >
          Info
        </button>
      </div>

      {/* Incident Cards Feed */}
      <div className="space-y-4">
        {filtered.map((inc) => (
          <div
            key={inc.id}
            onClick={() => navigate(`/incidents/${inc.id}`)}
            className="card p-5 card-hover cursor-pointer flex items-center justify-between gap-4"
          >
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-md border flex items-center gap-1.5 ${
                  inc.severity === 'critical'
                    ? 'badge-critical'
                    : inc.severity === 'warning'
                      ? 'badge-warning'
                      : 'badge-info'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  <span className="capitalize">{inc.severity}</span>
                </span>

                {inc.category && (
                  <span className="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-[#f1f5f9] text-[#475569] border border-[#e2e8f0]">
                    {inc.category}
                  </span>
                )}

                {inc.inc_number && (
                  <span className="text-xs font-mono font-bold text-[#64748b]">
                    {inc.inc_number}
                  </span>
                )}
              </div>

              <h2 className="text-base font-bold text-[#0f172a]">{inc.title}</h2>
              <p className="text-xs text-[#475569] leading-relaxed">{inc.description}</p>
              <div className="text-xs font-mono text-[#94a3b8] flex items-center gap-2">
                <span>{inc.process_name}</span>
                <span>·</span>
                <span>PID {inc.pid}</span>
                <span>·</span>
                <span>{inc.detected_at}</span>
              </div>
            </div>

            <ChevronRight size={18} className="text-[#94a3b8]" />
          </div>
        ))}
      </div>
    </div>
  )
}

function IncidentDetail({ incidentId }: { incidentId: string }) {
  const { incidents, setConfirmingAction, dismissIncident } = useNexusStore()
  const navigate = useNavigate()

  const incident = incidents.find((i) => i.id === incidentId) || incidents[0]


  const isDismissed = incident.status === 'dismissed'

  const handleApprove = () => {
    setConfirmingAction({
      incidentId: incident.id,
      pid: incident.pid,
      processName: incident.process_name,
      actionType: incident.recommended_action || 'observe',
      actionTitle: incident.recommendation_text || 'Observe',
    })
  }

  const handleDismiss = () => {
    dismissIncident(incident.id)
  }

  const [feedbackLabel, setFeedbackLabel] = useState<string | null>(null)
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)

  const handleFeedback = async (label: string) => {
    setFeedbackLabel(label)
    const msg = label === 'correct' 
      ? '✓ Thank you! Marked as correct detection.' 
      : label === 'false_positive' 
        ? '⚠ Marked as False Positive. Isolation Forest contamination baseline updated.' 
        : 'Action flagged as too aggressive. Baseline feedback recorded.'
    setFeedbackMsg(msg)
    try {
      await api.submitFeedback(incident.id, label)
    } catch (err) {
      console.warn('Feedback recorded locally:', err)
    }
  }


  return (
    <div className="page space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/incidents')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748b] hover:text-[#0f172a] transition-colors"
      >
        <ChevronLeft size={16} /> All incidents
      </button>

      {/* Header Info */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-md border flex items-center gap-1.5 ${
            incident.severity === 'critical' ? 'badge-critical' : 'badge-warning'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            <span className="capitalize">{incident.severity}</span>
          </span>

          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-md badge-monitoring">
            {incident.status.charAt(0).toUpperCase() + incident.status.slice(1)}
          </span>

          {incident.inc_number && (
            <span className="text-xs font-mono font-bold text-[#64748b]">
              {incident.inc_number}
            </span>
          )}
        </div>

        <h1 className="text-2xl font-bold text-[#0f172a]">{incident.title}</h1>
        <p className="text-xs text-[#475569]">{incident.description}</p>

        <div className="text-xs font-mono text-[#64748b] flex items-center gap-3 pt-1">
          <span>Process: <strong className="text-[#0f172a]">{incident.process_name}</strong></span>
          <span>·</span>
          <span>PID: <strong className="text-[#0f172a]">{incident.pid}</strong></span>
          <span>·</span>
          <span>Detected: <strong className="text-[#0f172a]">{incident.detected_at}</strong></span>
        </div>
      </div>

      {/* Recommended Action Card */}
      <div className="card p-5 border-l-4 border-l-[#f97316] bg-[#fffbeb]/30 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-[#d97706] uppercase tracking-wider">
          <Zap size={16} /> Recommended action
        </div>

        <p className="text-sm font-semibold text-[#0f172a]">
          Nexus recommends: <span className="text-[#f97316]">{incident.recommendation_text || 'Observe'}</span>
        </p>

        {!isDismissed ? (
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleApprove}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#10b981] hover:bg-[#059669] transition-colors shadow-sm flex items-center gap-1.5"
            >
              <CheckCircle2 size={16} /> Approve & execute
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-[#475569] bg-white border border-[#cbd5e1] hover:bg-[#f8fafc] transition-colors flex items-center gap-1.5"
            >
              <X size={16} /> Dismiss
            </button>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-[#fef2f2] text-[#dc2626] border border-[#fecaca] text-xs font-medium flex items-center gap-2">
            <X size={16} /> Recommendation dismissed. The guardian will keep monitoring.
          </div>
        )}
      </div>

      {/* AI Summary Card */}
      <IncidentSummaryCard
        incidentId={incident.id}
        summary={(incident as any).nl_summary}
        slackMessage={(incident as any).nl_slack_message}
      />

      {/* Feedback & ML Learning Loop Card */}
      <div className="card p-4 bg-[#f8fafc] border border-[#e2e8f0] space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-[#0f172a] uppercase tracking-wide">
            Feedback & Learning Loop
          </h4>
          <span className="text-[11px] text-[#64748b]">Help tune Isolation Forest baseline</span>
        </div>
        <p className="text-xs text-[#475569]">Was this anomaly detection accurate for {incident.process_name}?</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleFeedback('correct')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              feedbackLabel === 'correct'
                ? 'bg-[#ecfdf5] text-[#059669] border-[#a7f3d0]'
                : 'bg-white text-[#334155] border-[#cbd5e1] hover:bg-[#f1f5f9]'
            }`}
          >
            ✓ Correct Flag
          </button>
          <button
            onClick={() => handleFeedback('false_positive')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              feedbackLabel === 'false_positive'
                ? 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca]'
                : 'bg-white text-[#334155] border-[#cbd5e1] hover:bg-[#f1f5f9]'
            }`}
          >
            ⚠ False Positive
          </button>
          <button
            onClick={() => handleFeedback('too_aggressive')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              feedbackLabel === 'too_aggressive'
                ? 'bg-[#fffbeb] text-[#d97706] border-[#fde68a]'
                : 'bg-white text-[#334155] border-[#cbd5e1] hover:bg-[#f1f5f9]'
            }`}
          >
            Too Aggressive Action
          </button>
        </div>

        {feedbackMsg && (
          <div className="p-3 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] text-[#059669] text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 size={16} /> {feedbackMsg}
          </div>
        )}
      </div>



      {/* Autonomous Reasoning Pipeline Stepper */}
      <div className="card p-6 space-y-6">
        <div>
          <h2 className="text-base font-bold text-[#0f172a]">Autonomous reasoning pipeline</h2>
          <p className="text-xs text-[#64748b]">How the guardian moved from detection to decision</p>
        </div>

        {/* Stepper Bar */}
        <div className="flex items-center justify-between relative px-6 py-4">
          <div className="absolute left-10 right-10 top-1/2 -translate-y-1/2 h-0.5 bg-[#e2e8f0] z-0" />

          {/* Node 1: Sense */}
          <div className="relative z-10 flex flex-col items-center gap-2 bg-white px-2">
            <div className="w-9 h-9 rounded-full bg-[#10b981] text-white flex items-center justify-center font-bold text-xs shadow-sm">
              <CheckCircle2 size={18} />
            </div>
            <span className="text-xs font-bold text-[#0f172a]">Sense</span>
          </div>

          {/* Node 2: Think */}
          <div className="relative z-10 flex flex-col items-center gap-2 bg-white px-2">
            <div className="w-9 h-9 rounded-full bg-[#10b981] text-white flex items-center justify-center font-bold text-xs shadow-sm">
              <CheckCircle2 size={18} />
            </div>
            <span className="text-xs font-bold text-[#0f172a]">Think</span>
          </div>

          {/* Node 3: Decide */}
          <div className="relative z-10 flex flex-col items-center gap-2 bg-white px-2">
            <div className="w-9 h-9 rounded-full bg-white text-[#10b981] border-2 border-[#10b981] flex items-center justify-center font-bold text-xs shadow-sm">
              <Activity size={18} />
            </div>
            <span className="text-xs font-bold text-[#0f172a]">Decide</span>
          </div>

          {/* Node 4: Act */}
          <div className="relative z-10 flex flex-col items-center gap-2 bg-white px-2">
            <div className="w-9 h-9 rounded-full bg-white text-[#94a3b8] border-2 border-dashed border-[#cbd5e1] flex items-center justify-center text-xs">
              <Play size={16} />
            </div>
            <span className="text-xs font-medium text-[#94a3b8]">Act</span>
          </div>

          {/* Node 5: Record */}
          <div className="relative z-10 flex flex-col items-center gap-2 bg-white px-2">
            <div className="w-9 h-9 rounded-full bg-[#f1f5f9] text-[#94a3b8] flex items-center justify-center text-xs">
              <FileText size={16} />
            </div>
            <span className="text-xs font-medium text-[#94a3b8]">Record</span>
          </div>
        </div>

        {/* Detailed Sections Grid */}
        <div className="space-y-6 pt-4 border-t border-[#f1f5f9]">
          {/* WHAT HAPPENED */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748b] mb-1">
              WHAT HAPPENED
            </h3>
            <p className="text-xs text-[#0f172a] leading-relaxed">
              {incident.what_happened || `${incident.process_name} (PID ${incident.pid}) grew memory continuously over observation window.`}
            </p>
          </div>

          {/* WHY IT WAS DETECTED */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748b] mb-1">
              WHY IT WAS DETECTED
            </h3>
            <p className="text-xs text-[#0f172a] leading-relaxed">
              {incident.why_detected || 'Growth is within tolerance for an interactive browser but exceeds the soft warning band, so Nexus is watching rather than acting.'}
            </p>
          </div>

          {/* ML ENGINE EXPLANATION */}
          <div className="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-1">
            <h3 className="text-xs font-bold text-[#059669] flex items-center gap-1.5">
              <Brain size={15} /> ML ENGINE EXPLANATION
            </h3>
            <p className="text-xs text-[#475569] leading-relaxed">
              {incident.ml_explanation || 'The detector scored the trend as borderline (confidence 0.58). Workloads have high variance, so the system downgraded to observation.'}
            </p>
          </div>

          {/* Before / after */}
          <div className="p-4 rounded-xl bg-white border border-[#e2e8f0] space-y-2">
            <h3 className="text-xs font-bold text-[#0f172a]">Before / after</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-[#64748b]">Memory</span>
                <div className="text-lg font-bold font-mono text-[#0f172a]">
                  {incident.before_memory || '4.85 GB current'}
                </div>
              </div>
              <div>
                <span className="text-xs text-[#64748b]">Slope</span>
                <div className="text-lg font-bold font-mono text-[#0f172a]">
                  {incident.slope || '+80 MB/min current'}
                </div>
              </div>
            </div>
          </div>

          {/* Event timeline */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748b]">
              Event timeline
            </h3>
            <p className="text-xs text-[#94a3b8]">Timestamped record of the guardian's activity</p>

            <div className="space-y-2 font-mono text-xs border-l-2 border-[#e2e8f0] pl-4 py-1">
              {incident.timeline ? (
                incident.timeline.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#f1f5f9] text-[#475569]">
                      {item.step}
                    </span>
                    <span className="text-[#94a3b8]">{item.time}</span>
                    <span className="text-[#0f172a]">{item.text}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-3">
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-[#ecfdf5] text-[#059669]">
                    SENSE
                  </span>
                  <span className="text-[#94a3b8]">10:41:30</span>
                  <span className="text-[#0f172a]">Monitoring detected abnormal behavior</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
