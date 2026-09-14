import React, { useState } from 'react'
import { ShieldCheck, ShieldAlert, Zap, Activity, FileText, Download } from 'lucide-react'
import { useNexusStore } from '../store'
import { PdfReportModal } from './PdfReportModal'

interface HeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export function Header({ title, description, actions }: HeaderProps) {
  const { metrics, policy, openIncidentCount, toggleSimulationMode } = useNexusStore()
  const [showPdfModal, setShowPdfModal] = useState(false)

  const systemHealth =
    openIncidentCount > 0
      ? 'CRITICAL'
      : metrics && (metrics.cpu_percent > (policy?.cpu_warning_pct ?? 80) || metrics.ram_percent > (policy?.ram_warning_pct ?? 80))
        ? 'ELEVATED'
        : 'HEALTHY'

  return (
    <>
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 mb-8 border-b border-slate-200">
        {/* Left Side: Title & Subtitle + AI Badge */}
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#0f172a]">
              {title}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              AI GUARDIAN ACTIVE
            </span>
          </div>
          {description && (
            <p className="text-xs md:text-sm text-slate-500 font-medium">
              {description}
            </p>
          )}
        </div>

        {/* Right Side: Status Pills & Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Custom actions passed per page */}
          {actions}

          {/* System Health Status Badge */}
          <div
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border shadow-xs transition-all ${
              systemHealth === 'HEALTHY'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : systemHealth === 'ELEVATED'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
            }`}
          >
            {systemHealth === 'HEALTHY' ? (
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-rose-600" />
            )}
            <span className="font-mono tracking-wide">SYSTEM: {systemHealth}</span>
          </div>

          {/* Operating Mode Switcher */}
          <button
            onClick={toggleSimulationMode}
            title="Click to toggle Simulation / Live Mode"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all shadow-xs ${
              policy?.simulation_mode
                ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
            }`}
          >
            <Zap className={`w-4 h-4 ${policy?.simulation_mode ? 'text-amber-600' : 'text-rose-600'}`} />
            <span>{policy?.simulation_mode ? '🛡 SIMULATION ON' : '⚡ LIVE MODE'}</span>
          </button>

          {/* Primary Export PDF Report Button */}
          <button
            onClick={() => setShowPdfModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs shadow-md transition-all duration-150"
          >
            <FileText className="w-4 h-4" />
            <span>Export PDF Report</span>
          </button>
        </div>
      </header>

      {/* PDF Export Modal */}
      <PdfReportModal isOpen={showPdfModal} onClose={() => setShowPdfModal(false)} />
    </>
  )
}
