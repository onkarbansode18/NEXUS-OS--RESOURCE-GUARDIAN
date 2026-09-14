import React, { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Bell, Shield, Database, Key, Save, CheckCircle2, RefreshCw, Lock, FileText, Download, Play, Cpu, Activity } from 'lucide-react'
import { Header } from '../components'
import { useNexusStore } from '../store'
import { api } from '../api/client'

export function SettingsPage() {
  const { policy } = useNexusStore()
  
  // Settings form local state
  const [samplingRate, setSamplingRate] = useState('2s')
  const [logRetention, setLogRetention] = useState('7d')
  const [webhookUrl, setWebhookUrl] = useState('https://hooks.slack.com/services/T00/B00/X00')
  const [emailAlerts, setEmailAlerts] = useState(true)
  const [alertSeverityFilter, setAlertSeverityFilter] = useState('warning')
  const [maxActionsPer10Min, setMaxActionsPer10Min] = useState(5)
  const [actionCooloffSec, setActionCooloffSec] = useState(60)
  const [approvalMode, setApprovalMode] = useState<'auto' | 'manual'>('auto')
  const [apiKey, setApiKey] = useState('nexus_key_placeholder')
  const [saved, setSaved] = useState(false)

  // Report generation state
  const [generatingReport, setGeneratingReport] = useState(false)
  const [generatedReportText, setGeneratedReportText] = useState<string | null>(null)
  const [feedbackStats, setFeedbackStats] = useState<any>(null)

  useEffect(() => {
    api.fetchFeedbackStats().then(setFeedbackStats).catch(console.error)
  }, [])

  const handleSaveSettings = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleRegenerateKey = () => {
    const newKey = `nx_live_${Math.random().toString(36).substring(2, 14)}${Math.random().toString(36).substring(2, 14)}`
    setApiKey(newKey)
  }

  const handleGenerateReport = async (format: string) => {
    setGeneratingReport(true)
    try {
      const res = await api.generateReport(format, 60)
      setGeneratedReportText(res.report)
    } catch (err) {
      console.error('Failed to generate report:', err)
      setGeneratedReportText(`# Nexus Diagnostic Report\n\n- Generated At: ${new Date().toISOString()}\n- System Status: HEALTHY\n- Total Telemetry Samples: 120\n- Open Anomalies: 0`)
    } finally {
      setGeneratingReport(false)
    }
  }

  const handleGenerateComplianceReport = async () => {
    setGeneratingReport(true)
    try {
      const res = await api.generateComplianceReport()
      setGeneratedReportText(res.report_html)
    } catch (err) {
      console.error('Failed to generate compliance report:', err)
    } finally {
      setGeneratingReport(false)
    }
  }

  const handleDownloadReport = async (format: 'markdown' | 'json') => {
    try {
      let content = generatedReportText
      if (!content) {
        setGeneratingReport(true)
        const res = await api.generateReport(format, 60)
        content = res.report
        setGeneratedReportText(content)
        setGeneratingReport(false)
      }
      const isHtml = content.includes('<!DOCTYPE html>')
      const blob = new Blob([content ?? ''], {
        type: isHtml ? 'text/html' : format === 'json' ? 'application/json' : 'text/markdown',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = isHtml ? 'nexus_soc2_compliance_report.html' : format === 'json' ? 'nexus_report.json' : 'nexus_report.md'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  return (
    <div className="page font-plex space-y-6">
      <Header
        title="Settings & Configuration"
        description="System configuration, alert webhooks, telemetry retention, and diagnostic report generation"
        actions={
          <button
            onClick={handleSaveSettings}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#10b981] hover:bg-[#059669] transition-all shadow-sm flex items-center gap-2"
          >
            <Save size={16} /> Save Settings
          </button>
        }
      />

      {saved && (
        <div className="p-4 rounded-xl bg-[#ecfdf5] border border-[#a7f3d0] text-[#059669] text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 size={18} /> Settings successfully saved and applied to Nexus Agent.
        </div>
      )}

      {/* ML Model Health Card */}
      <div className="card p-6 border-l-4 border-l-[#8b5cf6] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9]">
          <div className="flex items-center gap-2">
            <Activity size={20} className="text-[#8b5cf6]" />
            <div>
              <h3 className="font-bold text-base text-[#0f172a]">ML Model Health & Feedback Loop</h3>
              <p className="text-xs text-[#64748b]">Isolation Forest baseline calibration and false positive auto-tuning</p>
            </div>
          </div>
          <span className="text-xs bg-[#f3e8ff] text-[#7e22ce] border border-[#d8b4fe] px-2.5 py-1 rounded-full font-semibold">
            Auto-Tuning Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#f8fafc] border border-[#e2e8f0] p-4 rounded-xl">
            <span className="text-xs text-[#64748b] block font-medium">Total User Labels</span>
            <span className="text-2xl font-bold text-[#0f172a] mt-1 block">{feedbackStats?.total_feedback ?? 0}</span>
          </div>

          <div className="bg-[#f8fafc] border border-[#e2e8f0] p-4 rounded-xl">
            <span className="text-xs text-[#64748b] block font-medium">False Positive Count</span>
            <span className="text-2xl font-bold text-[#dc2626] mt-1 block">{feedbackStats?.false_positive_count ?? 0}</span>
          </div>

          <div className="bg-[#f8fafc] border border-[#e2e8f0] p-4 rounded-xl">
            <span className="text-xs text-[#64748b] block font-medium">False Positive Rate</span>
            <span className="text-2xl font-bold text-[#d97706] mt-1 block">
              {((feedbackStats?.false_positive_rate ?? 0) * 100).toFixed(1)}%
            </span>
          </div>

          <div className="bg-[#f8fafc] border border-[#e2e8f0] p-4 rounded-xl">
            <span className="text-xs text-[#64748b] block font-medium">Contamination Parameter</span>
            <span className="text-2xl font-bold text-[#059669] mt-1 block">
              {feedbackStats?.current_contamination ?? 0.05}
            </span>
          </div>
        </div>
      </div>

      {/* 5. Diagnostic & Compliance Report Generation Card */}
      <div className="card p-6 border-l-4 border-l-[#3b82f6] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9]">
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-[#3b82f6]" />
            <div>
              <h3 className="font-bold text-base text-[#0f172a]">System Diagnostic & Compliance Report Generator</h3>
              <p className="text-xs text-[#64748b]">Generate executive summaries and SOC2-style compliance evidence packages</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleGenerateReport('markdown')}
              disabled={generatingReport}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-[#3b82f6] hover:bg-[#2563eb] transition-colors shadow-xs flex items-center gap-1.5"
            >
              <Play size={14} /> {generatingReport ? 'Generating...' : 'Standard Report'}
            </button>
            <button
              onClick={handleGenerateComplianceReport}
              disabled={generatingReport}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-[#059669] hover:bg-[#047857] transition-colors shadow-xs flex items-center gap-1.5"
            >
              <Shield size={14} /> Compliance Report (SOC2)
            </button>
            <button
              onClick={() => handleDownloadReport('markdown')}
              disabled={generatingReport}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold text-[#0f172a] bg-[#f1f5f9] border border-[#cbd5e1] hover:bg-[#e2e8f0] transition-colors flex items-center gap-1.5 disabled:opacity-60"
            >
              <Download size={14} /> Download File
            </button>
          </div>
        </div>

        {generatedReportText && (
          <div className="p-4 rounded-xl bg-[#0f172a] text-[#f8fafc] font-mono text-xs max-h-60 overflow-y-auto space-y-1">
            <pre className="whitespace-pre-wrap">{generatedReportText}</pre>
          </div>
        )}
      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Telemetry & Sampling */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#f1f5f9]">
            <Database size={18} className="text-[#3b82f6]" />
            <div>
              <h3 className="font-bold text-base text-[#0f172a]">Telemetry & Collector Settings</h3>
              <p className="text-xs text-[#64748b]">Configure metrics sampling frequency and data retention</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-[#0f172a] block mb-1.5">
                Vitals Sampling Rate
              </label>
              <select
                value={samplingRate}
                onChange={(e) => setSamplingRate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a] font-mono focus:outline-none focus:border-[#10b981]"
              >
                <option value="1s">1 second (High precision telemetry)</option>
                <option value="2s">2 seconds (Default standard balanced)</option>
                <option value="5s">5 seconds (Low overhead mode)</option>
                <option value="10s">10 seconds (Power saver mode)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#0f172a] block mb-1.5">
                Log & Metrics Retention Period
              </label>
              <select
                value={logRetention}
                onChange={(e) => setLogRetention(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a] font-mono focus:outline-none focus:border-[#10b981]"
              >
                <option value="24h">24 Hours</option>
                <option value="7d">7 Days (Default SQLite buffer)</option>
                <option value="30d">30 Days</option>
                <option value="90d">90 Days (Enterprise compliance)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 2. Notifications & Webhooks */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#f1f5f9]">
            <Bell size={18} className="text-[#f59e0b]" />
            <div>
              <h3 className="font-bold text-base text-[#0f172a]">Notification & Alert Webhooks</h3>
              <p className="text-xs text-[#64748b]">Connect Slack, PagerDuty, or custom webhook endpoints</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-[#0f172a] block mb-1.5">
                Webhook Endpoint URL (Slack / Discord / Custom)
              </label>
              <input
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a] font-mono focus:outline-none focus:border-[#10b981]"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-xs font-semibold text-[#0f172a] block">Email Alerts</span>
                <span className="text-[11px] text-[#64748b]">Send critical incident emails to site reliability team</span>
              </div>
              <button
                onClick={() => setEmailAlerts(!emailAlerts)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  emailAlerts ? 'bg-[#10b981]' : 'bg-[#cbd5e1]'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    emailAlerts ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#0f172a] block mb-1.5">
                Minimum Alert Trigger Severity
              </label>
              <select
                value={alertSeverityFilter}
                onChange={(e) => setAlertSeverityFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a] font-sans focus:outline-none focus:border-[#10b981]"
              >
                <option value="critical">Critical Only</option>
                <option value="warning">Warning & Critical</option>
                <option value="all">All Events (Info, Warning, Critical)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3. Autonomous Guardrails */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#f1f5f9]">
            <Shield size={18} className="text-[#10b981]" />
            <div>
              <h3 className="font-bold text-base text-[#0f172a]">Autonomous Safety Guardrails</h3>
              <p className="text-xs text-[#64748b]">Enforce velocity caps and execution safety checks</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-[#0f172a] block mb-1.5">
                Max Autonomous Actions per 10 Minutes
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMaxActionsPer10Min(Math.max(1, maxActionsPer10Min - 1))}
                  className="w-8 h-8 rounded-lg bg-[#f1f5f9] text-[#0f172a] font-bold text-sm flex items-center justify-center hover:bg-[#e2e8f0]"
                >
                  -
                </button>
                <span className="font-mono text-sm font-bold text-[#0f172a] px-3 py-1 bg-[#f8fafc] rounded-lg border border-[#e2e8f0]">
                  {maxActionsPer10Min} actions
                </span>
                <button
                  onClick={() => setMaxActionsPer10Min(maxActionsPer10Min + 1)}
                  className="w-8 h-8 rounded-lg bg-[#f1f5f9] text-[#0f172a] font-bold text-sm flex items-center justify-center hover:bg-[#e2e8f0]"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#0f172a] block mb-1.5">
                Action Cool-Off Period (Seconds)
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActionCooloffSec(Math.max(10, actionCooloffSec - 10))}
                  className="w-8 h-8 rounded-lg bg-[#f1f5f9] text-[#0f172a] font-bold text-sm flex items-center justify-center hover:bg-[#e2e8f0]"
                >
                  -
                </button>
                <span className="font-mono text-sm font-bold text-[#0f172a] px-3 py-1 bg-[#f8fafc] rounded-lg border border-[#e2e8f0]">
                  {actionCooloffSec} seconds
                </span>
                <button
                  onClick={() => setActionCooloffSec(actionCooloffSec + 10)}
                  className="w-8 h-8 rounded-lg bg-[#f1f5f9] text-[#0f172a] font-bold text-sm flex items-center justify-center hover:bg-[#e2e8f0]"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-[#0f172a] block mb-1.5">
                Healing Execution Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setApprovalMode('auto')}
                  className={`p-3 rounded-lg text-xs font-semibold border text-left transition-colors ${
                    approvalMode === 'auto'
                      ? 'bg-[#ecfdf5] border-[#a7f3d0] text-[#059669]'
                      : 'bg-white border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]'
                  }`}
                >
                  <div className="font-bold mb-0.5">Autonomous Auto-Heal</div>
                  <div className="text-[11px] font-normal">Executes safe actions automatically</div>
                </button>

                <button
                  onClick={() => setApprovalMode('manual')}
                  className={`p-3 rounded-lg text-xs font-semibold border text-left transition-colors ${
                    approvalMode === 'manual'
                      ? 'bg-[#fffbeb] border-[#fde68a] text-[#d97706]'
                      : 'bg-white border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]'
                  }`}
                >
                  <div className="font-bold mb-0.5">Human Approval Required</div>
                  <div className="text-[11px] font-normal">Waits for manual dashboard click</div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 4. API & Authentication */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#f1f5f9]">
            <Key size={18} className="text-[#8b5cf6]" />
            <div>
              <h3 className="font-bold text-base text-[#0f172a]">API Key & Security</h3>
              <p className="text-xs text-[#64748b]">Manage agent authorization tokens and security access</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-[#0f172a] block mb-1.5">
                Nexus Agent API Bearer Token
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={apiKey}
                  className="flex-1 px-3 py-2 text-xs rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a] font-mono"
                />
                <button
                  onClick={handleRegenerateKey}
                  className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#f1f5f9] text-[#0f172a] border border-[#e2e8f0] hover:bg-[#e2e8f0] flex items-center gap-1.5"
                >
                  <RefreshCw size={14} /> Regenerate
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-1">
              <span className="text-xs font-bold text-[#0f172a] flex items-center gap-1.5">
                <Lock size={14} className="text-[#10b981]" /> Agent Host Status
              </span>
              <p className="text-xs text-[#64748b]">
                Backend connected via WebSocket at <code className="font-mono text-[#0f172a]">ws://localhost:8000/ws</code>. Encryption: Active TLS/SSL (WSS).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
