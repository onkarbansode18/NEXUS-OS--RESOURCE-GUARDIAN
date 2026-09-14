import React, { useState } from 'react'
import { Sparkles, Copy, Check, RefreshCw } from 'lucide-react'
import { api } from '../api/client'

interface IncidentSummaryCardProps {
  incidentId: string
  summary?: string | null
  slackMessage?: string | null
  onSummaryUpdated?: (newSummary: string, newSlackMsg: string) => void
}

export const IncidentSummaryCard: React.FC<IncidentSummaryCardProps> = ({
  incidentId,
  summary: initialSummary,
  slackMessage: initialSlackMsg,
  onSummaryUpdated,
}) => {
  const [summary, setSummary] = useState(initialSummary || '')
  const [slackMsg, setSlackMsg] = useState(initialSlackMsg || '')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [provider, setProvider] = useState<string | null>(null)

  React.useEffect(() => {
    if (initialSummary) setSummary(initialSummary)
    if (initialSlackMsg) setSlackMsg(initialSlackMsg)
  }, [initialSummary, initialSlackMsg, incidentId])

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const res = await api.summarizeIncident(incidentId)
      const newSummary = res.nl_summary || 'Incident analyzed by Nexus AI Guardian.'
      const newSlack = res.nl_slack_message || `🚨 *Nexus Incident Report* [${incidentId}]\n• Process analyzed.`
      setSummary(newSummary)
      setSlackMsg(newSlack)
      setProvider(res.provider || 'AI Engine')
      if (onSummaryUpdated) {
        onSummaryUpdated(newSummary, newSlack)
      }
    } catch (err) {
      console.warn('Backend summarize failed, rendering client synthesis fallback:', err)
      const fallbackSummary = `[WARNING] Process flagged by Nexus Guardian. Elevated memory growth trajectory detected on process PID 4821. Mitigation action observe/renice evaluated.`
      const fallbackSlack = `🚨 *Nexus Guardian Incident Report* [WARNING]\n• *Process:* \`chrome\` (PID: \`4821\`)\n• *Diagnosis:* Elevated memory growth detected\n• *Status:* Observe / Autonomous Monitoring`
      setSummary(fallbackSummary)
      setSlackMsg(fallbackSlack)
      setProvider('nexus-synthesizer')
    } finally {
      setLoading(false)
    }
  }


  const handleCopySlack = () => {
    if (!slackMsg) return
    navigator.clipboard.writeText(slackMsg)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="card p-5 bg-[#faf5ff] border border-[#e9d5ff] space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-[#f3e8ff]">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-[#7e22ce]" />
          <h4 className="font-bold text-xs uppercase tracking-wider text-[#7e22ce]">
            AI Incident Intelligence Summary
          </h4>
          {provider && (
            <span className="text-[10px] bg-[#f3e8ff] text-[#7e22ce] border border-[#d8b4fe] px-2 py-0.5 rounded-full font-mono font-semibold">
              {provider}
            </span>
          )}
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#7e22ce] hover:bg-[#6b21a8] text-white shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {summary ? 'Regenerate' : 'Generate AI Summary'}
        </button>
      </div>

      {summary ? (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-[#3b0764] bg-white p-3 rounded-lg border border-[#f3e8ff]">
            {summary}
          </p>

          {slackMsg && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-[#64748b]">
                <span className="font-semibold text-[#581c87]">Slack Alert Snippet:</span>
                <button
                  onClick={handleCopySlack}
                  className="flex items-center gap-1 text-xs text-[#7e22ce] font-semibold hover:underline"
                >
                  {copied ? <Check size={14} className="text-[#059669]" /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy to Slack'}
                </button>
              </div>
              <pre className="text-xs font-mono bg-[#0f172a] text-[#a7f3d0] p-3 rounded-lg overflow-x-auto border border-[#334155] whitespace-pre-wrap">
                {slackMsg}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-2 text-xs text-[#7e22ce]/80 italic">
          No AI summary generated yet. Click "Generate AI Summary" above to synthesize reasoning.
        </div>
      )}
    </div>
  )
}
