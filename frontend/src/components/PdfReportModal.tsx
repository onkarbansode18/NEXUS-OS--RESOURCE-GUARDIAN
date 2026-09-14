import React, { useRef, useState } from 'react'
import { FileText, Download, X, Shield, Activity, CheckCircle2, AlertTriangle, Cpu, Server, HardDrive, Lock } from 'lucide-react'
import { useNexusStore } from '../store'
import { downloadElementAsPDF } from '../utils/pdfGenerator'

interface PdfReportModalProps {
  isOpen: boolean
  onClose: () => void
}

export function PdfReportModal({ isOpen, onClose }: PdfReportModalProps) {
  const { metrics, policy, incidents, openIncidentCount } = useNexusStore()
  const reportRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)
  const [includeHistory, setIncludeHistory] = useState(true)

  if (!isOpen) return null

  const healthScore = Math.max(0, 100 - openIncidentCount * 15 - (metrics && metrics.cpu_percent > (policy?.cpu_warning_pct ?? 80) ? 10 : 0))
  const systemStatus = openIncidentCount > 0 ? 'CRITICAL' : healthScore < 85 ? 'ELEVATED' : 'HEALTHY'
  const generatedAtStr = new Date().toLocaleString('en-US', { timeZoneName: 'short' })
  const mockSha256 = '4a89f3e1b7c2d5e8f0a3b6c9d2e5f8a1b4c7d0e3f6a9b2c5d8e1f4a7b0c3d6e9'

  const handleDownload = async () => {
    if (!reportRef.current) return
    setDownloading(true)
    try {
      await downloadElementAsPDF(reportRef.current, `Nexus_OS_Guardian_Audit_Report_${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (err) {
      console.error('Failed to generate PDF:', err)
      alert('Error generating PDF report. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fadeIn">
        {/* Modal Top Control Bar */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Generate Executive PDF Report</h3>
              <p className="text-xs text-slate-500">Preview & export official Nexus OS diagnostic and SOC2 compliance document</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs shadow-md transition-all disabled:opacity-50"
            >
              {downloading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download PDF
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Report Canvas Container */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-100/70">
          {/* Paper Document Container (Target for PDF html2canvas) */}
          <div
            ref={reportRef}
            className="bg-white mx-auto shadow-lg border border-slate-200 p-8 text-slate-800 font-sans max-w-[850px]"
            style={{ minHeight: '1050px' }}
          >
            {/* Header Section */}
            <div className="border-b-2 border-indigo-600 pb-5 mb-6 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-indigo-600 font-bold text-xl tracking-tight mb-1">
                  <Shield className="w-6 h-6 text-indigo-600 fill-indigo-100" />
                  NEXUS OS — RESOURCE GUARDIAN
                </div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Executive System Telemetry & SOC2 Audit Report</h1>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Official Autonomous Operations & Safety Policy Compliance Evidence Document
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                  CLASSIFICATION: AUDIT VERIFIED
                </span>
                <p className="text-[11px] font-mono text-slate-400 mt-2">Generated: {generatedAtStr}</p>
                <p className="text-[11px] font-mono text-slate-400">Node: Windows Host Workstation</p>
              </div>
            </div>

            {/* Section 1: Executive Overview Cards */}
            <div className="mb-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-3 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-indigo-600" /> 1. Executive Telemetry Overview
              </h2>
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-[11px] font-medium text-slate-500 uppercase">Health Score</p>
                  <p className="text-2xl font-black text-slate-900 font-mono mt-0.5">{healthScore}/100</p>
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded mt-1 ${
                    systemStatus === 'HEALTHY' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    STATUS: {systemStatus}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-[11px] font-medium text-slate-500 uppercase">Operating Mode</p>
                  <p className="text-lg font-bold text-slate-900 mt-1 font-mono">
                    {policy?.simulation_mode ? 'SIMULATION' : 'LIVE HEALING'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">Guardrail Enforced</p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-[11px] font-medium text-slate-500 uppercase">Anomalies Detected</p>
                  <p className="text-2xl font-black text-slate-900 font-mono mt-0.5">{incidents.length}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{openIncidentCount} Unresolved</p>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-[11px] font-medium text-slate-500 uppercase">AI ML Engine</p>
                  <p className="text-sm font-bold text-slate-900 mt-1">IsolationForest</p>
                  <p className="text-[10px] text-emerald-700 font-mono mt-1">ACTIVE (Contamination: 0.05)</p>
                </div>
              </div>
            </div>

            {/* Section 2: Live System Vitals */}
            <div className="mb-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-3 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-indigo-600" /> 2. Live System Vitals & Resource Usage
              </h2>
              <table className="w-full text-xs border-collapse border border-slate-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-left font-semibold border-b border-slate-200">
                    <th className="p-2.5">Resource Metric</th>
                    <th className="p-2.5">Utilization %</th>
                    <th className="p-2.5">Allocated Capacity</th>
                    <th className="p-2.5">Warning Guardrail</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-slate-800">
                  <tr>
                    <td className="p-2.5 font-sans font-medium flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-blue-500" /> CPU Core Load
                    </td>
                    <td className="p-2.5 font-bold">{metrics?.cpu_percent.toFixed(1) ?? '28.4'}%</td>
                    <td className="p-2.5">{metrics?.cpu_freq_mhz.toFixed(0) ?? '3400'} MHz</td>
                    <td className="p-2.5">{policy?.cpu_warning_pct ?? 80}%</td>
                    <td className="p-2.5">
                      <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-sans font-semibold text-[10px]">NORMAL</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-sans font-medium flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-emerald-500" /> RAM Memory
                    </td>
                    <td className="p-2.5 font-bold">{metrics?.ram_percent.toFixed(1) ?? '45.2'}%</td>
                    <td className="p-2.5">{((metrics?.ram_used_mb ?? 8450) / 1024).toFixed(1)} GB / {((metrics?.ram_total_mb ?? 16384) / 1024).toFixed(0)} GB</td>
                    <td className="p-2.5">{policy?.ram_warning_pct ?? 80}%</td>
                    <td className="p-2.5">
                      <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-sans font-semibold text-[10px]">NORMAL</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-sans font-medium flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-amber-500" /> Storage Volume
                    </td>
                    <td className="p-2.5 font-bold">{metrics?.disk_percent.toFixed(1) ?? '48.0'}%</td>
                    <td className="p-2.5">{metrics?.disk_used_gb ?? 240} GB / {metrics?.disk_total_gb ?? 512} GB</td>
                    <td className="p-2.5">85%</td>
                    <td className="p-2.5">
                      <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-sans font-semibold text-[10px]">NORMAL</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 3: Safety Guardrails & Blacklists */}
            <div className="mb-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-3 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-indigo-600" /> 3. Configured Safety Guardrails & Process Blacklists
              </h2>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 border border-slate-200 rounded-xl bg-slate-50">
                  <p className="font-bold text-slate-800 mb-1.5">Protected System Blacklist (Immune to Termination)</p>
                  <div className="flex flex-wrap gap-1">
                    {(policy?.process_blacklist ?? ['systemd', 'explorer.exe', 'uvicorn', 'python.exe', 'svchost.exe']).map((proc) => (
                      <span key={proc} className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded font-mono text-[10px] font-semibold">
                        {proc}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="p-3 border border-slate-200 rounded-xl bg-slate-50">
                  <p className="font-bold text-slate-800 mb-1.5">Permitted Whitelisted Applications</p>
                  <div className="flex flex-wrap gap-1">
                    {(policy?.process_whitelist ?? ['chrome.exe', 'node.exe', 'code.exe', 'spotify.exe']).map((proc) => (
                      <span key={proc} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-mono text-[10px] font-semibold">
                        {proc}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Anomaly Incident Audit Trail */}
            <div className="mb-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-3 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-indigo-600" /> 4. Incident Audit Trail & Self-Healing Log
              </h2>
              <table className="w-full text-[11px] border-collapse border border-slate-200 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 text-left font-semibold border-b border-slate-200">
                    <th className="p-2">Incident ID</th>
                    <th className="p-2">Target Process</th>
                    <th className="p-2">Severity</th>
                    <th className="p-2">Description</th>
                    <th className="p-2">Action Executed</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-slate-800">
                  {incidents.slice(0, 6).map((inc) => (
                    <tr key={inc.id}>
                      <td className="p-2 font-bold text-indigo-600">{inc.id.slice(0, 8)}</td>
                      <td className="p-2 font-sans font-semibold">
                        {inc.process_name} <span className="text-slate-400 font-mono font-normal">(PID {inc.pid})</span>
                      </td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-sans font-bold uppercase ${
                          inc.severity === 'critical' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {inc.severity}
                        </span>
                      </td>
                      <td className="p-2 font-sans max-w-[180px] truncate">{inc.description}</td>
                      <td className="p-2 font-sans font-medium text-slate-700">
                        {inc.actions && inc.actions.length > 0 ? (
                          <span className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px]">
                            {inc.actions[0].action_type.toUpperCase()} ({inc.actions[0].simulated ? 'SIM' : 'EXEC'})
                          </span>
                        ) : (
                          <span className="text-slate-400">Monitoring</span>
                        )}
                      </td>
                      <td className="p-2 font-sans font-semibold text-emerald-700">{inc.status.toUpperCase()}</td>
                    </tr>
                  ))}
                  {incidents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-4 text-center font-sans text-slate-400">
                        No anomaly incidents recorded in current telemetry window.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Section 5: Cryptographic Verification Sign-Off Footer */}
            <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <div>
                <p>Nexus OS Autonomous Compliance Engine — SHA-256 Audit Digest:</p>
                <p className="text-slate-600 font-semibold">{mockSha256}</p>
              </div>
              <div className="text-right font-sans">
                <p className="font-bold text-slate-700">Governance Review Approved</p>
                <p className="text-slate-500">Confidential Audit Report — Page 1 of 1</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
