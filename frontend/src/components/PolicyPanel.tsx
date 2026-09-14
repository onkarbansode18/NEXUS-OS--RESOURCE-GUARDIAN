import React, { useState } from 'react'
import { Sliders, Shield, Zap, Plus, Trash2, CheckCircle2 } from 'lucide-react'
import { useNexusStore } from '../store'
import { api } from '../api/client'

export function PolicyPanel() {
  const { policy, setPolicy, toggleSimulationMode } = useNexusStore()
  const [newBlacklist, setNewBlacklist] = useState('')
  const [newWhitelist, setNewWhitelist] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const handleStepChange = (field: string, delta: number, minVal: number, maxVal: number) => {
    if (!policy) return
    const current = (policy as any)[field] ?? 70
    const newVal = Math.min(maxVal, Math.max(minVal, current + delta))
    setPolicy({ [field]: newVal })
  }

  const handleDirectChange = (field: string, valueStr: string, minVal: number, maxVal: number) => {
    const val = parseInt(valueStr, 10)
    if (!isNaN(val)) {
      const clamped = Math.min(maxVal, Math.max(minVal, val))
      setPolicy({ [field]: clamped })
    }
  }

  const handleSavePolicy = async () => {
    setSaving(true)
    try {
      const updated = await api.updatePolicy(policy as unknown as Record<string, unknown>)
      setPolicy(updated as Partial<import('../types').Policy>)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('Failed to update policy:', err)
    } finally {
      setSaving(false)
    }
  }

  const addBlacklist = () => {
    if (!newBlacklist.trim() || !policy) return
    const name = newBlacklist.trim().toLowerCase()
    if (!policy.process_blacklist.includes(name)) {
      const updatedList = [...policy.process_blacklist, name]
      setPolicy({ process_blacklist: updatedList })
      api.updatePolicy({ process_blacklist: updatedList })
    }
    setNewBlacklist('')
  }

  const removeBlacklist = (name: string) => {
    if (!policy) return
    const updatedList = policy.process_blacklist.filter((item) => item !== name)
    setPolicy({ process_blacklist: updatedList })
    api.updatePolicy({ process_blacklist: updatedList })
  }

  const addWhitelist = () => {
    if (!newWhitelist.trim() || !policy) return
    const name = newWhitelist.trim().toLowerCase()
    if (!policy.process_whitelist.includes(name)) {
      const updatedList = [...policy.process_whitelist, name]
      setPolicy({ process_whitelist: updatedList })
      api.updatePolicy({ process_whitelist: updatedList })
    }
    setNewWhitelist('')
  }

  const removeWhitelist = (name: string) => {
    if (!policy) return
    const updatedList = policy.process_whitelist.filter((item) => item !== name)
    setPolicy({ process_whitelist: updatedList })
    api.updatePolicy({ process_whitelist: updatedList })
  }

  return (
    <div className="space-y-6">
      {/* Simulation Mode Toggle Card */}
      <div className={`card p-6 border-l-4 ${policy?.simulation_mode ? 'border-l-[#10b981]' : 'border-l-[#dc2626]'}`}>
        {/* Live Mode Warning Banner */}
        {!policy?.simulation_mode && (
          <div className="mb-4 flex items-center gap-3 p-3 rounded-xl bg-[#fef2f2] border-2 border-[#fca5a5] text-[#dc2626]">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest">Live Healing Mode Active</p>
              <p className="text-[11px] text-[#991b1b] mt-0.5">
                The guardian is executing real OS operations. Restart, Kill, Throttle and Suspend will affect actual processes on this machine.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className={policy?.simulation_mode ? 'text-[#f59e0b]' : 'text-[#dc2626]'} size={20} />
              <h3 className="font-bold text-lg text-[#0f172a]">
                Autonomous Guardian Operating Mode
              </h3>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                policy?.simulation_mode
                  ? 'bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]'
                  : 'bg-[#fef2f2] text-[#dc2626] border border-[#fecaca] animate-pulse'
              }`}>
                {policy?.simulation_mode ? 'SIM' : 'LIVE'}
              </span>
            </div>
            <p className="text-xs text-[#64748b]">
              {policy?.simulation_mode
                ? 'SIMULATION MODE ACTIVE: The agent logs healing decisions (renice, suspend, kill), but does NOT alter real system processes.'
                : 'LIVE HEALING ACTIVE: The agent autonomously throttles, renices, or restarts offending processes if safety guardrails pass.'}
            </p>
          </div>

          <button
            onClick={async () => {
              toggleSimulationMode()
              // Sync to backend immediately
              try {
                await api.updatePolicy({ simulation_mode: policy?.simulation_mode })
              } catch (e) { console.warn('Could not sync simulation_mode to backend:', e) }
            }}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shadow-xs ${
              policy?.simulation_mode
                ? 'bg-[#10b981] text-white hover:bg-[#059669]'
                : 'bg-[#dc2626] text-white hover:bg-[#b91c1c]'
            }`}
          >
            <span>Switch to {policy?.simulation_mode ? '⚡ LIVE HEALING MODE' : '🛡 SIMULATION MODE'}</span>
          </button>
        </div>
      </div>

      {/* Safety Threshold Steppers (No Sliders / Range bars) */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#f1f5f9]">
          <div className="flex items-center gap-2">
            <Sliders size={18} className="text-[#10b981]" />
            <h3 className="font-bold text-base text-[#0f172a]">
              Resource Alert & Healing Thresholds
            </h3>
          </div>
          {saveSuccess && (
            <span className="text-xs text-[#10b981] font-medium flex items-center gap-1 font-mono">
              <CheckCircle2 size={14} /> Thresholds Saved
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* CPU Threshold Steppers */}
          <div className="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-4">
            <h4 className="font-semibold text-xs text-[#0f172a] uppercase tracking-wider">
              CPU Utilization Bounds
            </h4>
            
            {/* Warning Stepper */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-[#64748b]">
                <span>Warning Alert:</span>
                <span className="font-mono text-xs text-[#d97706] font-bold">30% – 95%</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleStepChange('cpu_warning_pct', -5, 30, 95)}
                  className="w-8 h-8 rounded-lg bg-white border border-[#cbd5e1] text-[#0f172a] font-bold text-base hover:bg-[#e2e8f0] flex items-center justify-center transition-colors"
                >
                  -
                </button>
                <div className="flex-1 flex items-center justify-center gap-1 bg-white border border-[#cbd5e1] rounded-lg py-1 px-3">
                  <input
                    type="number"
                    value={policy?.cpu_warning_pct ?? 70}
                    onChange={(e) => handleDirectChange('cpu_warning_pct', e.target.value, 30, 95)}
                    className="w-12 text-center font-mono font-bold text-sm text-[#d97706] focus:outline-none"
                  />
                  <span className="font-mono font-bold text-sm text-[#d97706]">%</span>
                </div>
                <button
                  onClick={() => handleStepChange('cpu_warning_pct', 5, 30, 95)}
                  className="w-8 h-8 rounded-lg bg-white border border-[#cbd5e1] text-[#0f172a] font-bold text-base hover:bg-[#e2e8f0] flex items-center justify-center transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Critical Stepper */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-[#64748b]">
                <span>Critical Action:</span>
                <span className="font-mono text-xs text-[#dc2626] font-bold">50% – 100%</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleStepChange('cpu_critical_pct', -5, 50, 100)}
                  className="w-8 h-8 rounded-lg bg-white border border-[#cbd5e1] text-[#0f172a] font-bold text-base hover:bg-[#e2e8f0] flex items-center justify-center transition-colors"
                >
                  -
                </button>
                <div className="flex-1 flex items-center justify-center gap-1 bg-white border border-[#cbd5e1] rounded-lg py-1 px-3">
                  <input
                    type="number"
                    value={policy?.cpu_critical_pct ?? 90}
                    onChange={(e) => handleDirectChange('cpu_critical_pct', e.target.value, 50, 100)}
                    className="w-12 text-center font-mono font-bold text-sm text-[#dc2626] focus:outline-none"
                  />
                  <span className="font-mono font-bold text-sm text-[#dc2626]">%</span>
                </div>
                <button
                  onClick={() => handleStepChange('cpu_critical_pct', 5, 50, 100)}
                  className="w-8 h-8 rounded-lg bg-white border border-[#cbd5e1] text-[#0f172a] font-bold text-base hover:bg-[#e2e8f0] flex items-center justify-center transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* RAM Threshold Steppers */}
          <div className="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-4">
            <h4 className="font-semibold text-xs text-[#0f172a] uppercase tracking-wider">
              RAM Memory Bounds
            </h4>
            
            {/* Warning Stepper */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-[#64748b]">
                <span>Warning Alert:</span>
                <span className="font-mono text-xs text-[#d97706] font-bold">40% – 95%</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleStepChange('ram_warning_pct', -5, 40, 95)}
                  className="w-8 h-8 rounded-lg bg-white border border-[#cbd5e1] text-[#0f172a] font-bold text-base hover:bg-[#e2e8f0] flex items-center justify-center transition-colors"
                >
                  -
                </button>
                <div className="flex-1 flex items-center justify-center gap-1 bg-white border border-[#cbd5e1] rounded-lg py-1 px-3">
                  <input
                    type="number"
                    value={policy?.ram_warning_pct ?? 80}
                    onChange={(e) => handleDirectChange('ram_warning_pct', e.target.value, 40, 95)}
                    className="w-12 text-center font-mono font-bold text-sm text-[#d97706] focus:outline-none"
                  />
                  <span className="font-mono font-bold text-sm text-[#d97706]">%</span>
                </div>
                <button
                  onClick={() => handleStepChange('ram_warning_pct', 5, 40, 95)}
                  className="w-8 h-8 rounded-lg bg-white border border-[#cbd5e1] text-[#0f172a] font-bold text-base hover:bg-[#e2e8f0] flex items-center justify-center transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Critical Stepper */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-[#64748b]">
                <span>Critical Action:</span>
                <span className="font-mono text-xs text-[#dc2626] font-bold">60% – 100%</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleStepChange('ram_critical_pct', -5, 60, 100)}
                  className="w-8 h-8 rounded-lg bg-white border border-[#cbd5e1] text-[#0f172a] font-bold text-base hover:bg-[#e2e8f0] flex items-center justify-center transition-colors"
                >
                  -
                </button>
                <div className="flex-1 flex items-center justify-center gap-1 bg-white border border-[#cbd5e1] rounded-lg py-1 px-3">
                  <input
                    type="number"
                    value={policy?.ram_critical_pct ?? 95}
                    onChange={(e) => handleDirectChange('ram_critical_pct', e.target.value, 60, 100)}
                    className="w-12 text-center font-mono font-bold text-sm text-[#dc2626] focus:outline-none"
                  />
                  <span className="font-mono font-bold text-sm text-[#dc2626]">%</span>
                </div>
                <button
                  onClick={() => handleStepChange('ram_critical_pct', 5, 60, 100)}
                  className="w-8 h-8 rounded-lg bg-white border border-[#cbd5e1] text-[#0f172a] font-bold text-base hover:bg-[#e2e8f0] flex items-center justify-center transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Disk Threshold Steppers */}
          <div className="p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] space-y-4">
            <h4 className="font-semibold text-xs text-[#0f172a] uppercase tracking-wider">
              Disk Usage Bounds
            </h4>
            
            {/* Warning Stepper */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-[#64748b]">
                <span>Warning Alert:</span>
                <span className="font-mono text-xs text-[#d97706] font-bold">50% – 95%</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleStepChange('disk_warning_pct', -5, 50, 95)}
                  className="w-8 h-8 rounded-lg bg-white border border-[#cbd5e1] text-[#0f172a] font-bold text-base hover:bg-[#e2e8f0] flex items-center justify-center transition-colors"
                >
                  -
                </button>
                <div className="flex-1 flex items-center justify-center gap-1 bg-white border border-[#cbd5e1] rounded-lg py-1 px-3">
                  <input
                    type="number"
                    value={policy?.disk_warning_pct ?? 85}
                    onChange={(e) => handleDirectChange('disk_warning_pct', e.target.value, 50, 95)}
                    className="w-12 text-center font-mono font-bold text-sm text-[#d97706] focus:outline-none"
                  />
                  <span className="font-mono font-bold text-sm text-[#d97706]">%</span>
                </div>
                <button
                  onClick={() => handleStepChange('disk_warning_pct', 5, 50, 95)}
                  className="w-8 h-8 rounded-lg bg-white border border-[#cbd5e1] text-[#0f172a] font-bold text-base hover:bg-[#e2e8f0] flex items-center justify-center transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Critical Stepper */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-[#64748b]">
                <span>Critical Action:</span>
                <span className="font-mono text-xs text-[#dc2626] font-bold">70% – 100%</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleStepChange('disk_critical_pct', -5, 70, 100)}
                  className="w-8 h-8 rounded-lg bg-white border border-[#cbd5e1] text-[#0f172a] font-bold text-base hover:bg-[#e2e8f0] flex items-center justify-center transition-colors"
                >
                  -
                </button>
                <div className="flex-1 flex items-center justify-center gap-1 bg-white border border-[#cbd5e1] rounded-lg py-1 px-3">
                  <input
                    type="number"
                    value={policy?.disk_critical_pct ?? 95}
                    onChange={(e) => handleDirectChange('disk_critical_pct', e.target.value, 70, 100)}
                    className="w-12 text-center font-mono font-bold text-sm text-[#dc2626] focus:outline-none"
                  />
                  <span className="font-mono font-bold text-sm text-[#dc2626]">%</span>
                </div>
                <button
                  onClick={() => handleStepChange('disk_critical_pct', 5, 70, 100)}
                  className="w-8 h-8 rounded-lg bg-white border border-[#cbd5e1] text-[#0f172a] font-bold text-base hover:bg-[#e2e8f0] flex items-center justify-center transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 text-right">
          <button
            onClick={handleSavePolicy}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#10b981] hover:bg-[#059669] transition-colors shadow-sm"
          >
            {saving ? 'Saving...' : 'Save Policy Thresholds'}
          </button>
        </div>
      </div>

      {/* Whitelist / Blacklist */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Blacklist Card */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#f1f5f9]">
            <Shield size={18} className="text-[#dc2626]" />
            <div>
              <h3 className="font-bold text-base text-[#0f172a]">Protected Blacklist</h3>
              <p className="text-xs text-[#64748b]">
                Processes in this list will NEVER be reniced, suspended, or killed by Nexus.
              </p>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="e.g. systemd, explorer.exe..."
              value={newBlacklist}
              onChange={(e) => setNewBlacklist(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-[#e2e8f0] bg-[#f8fafc] font-mono"
            />
            <button onClick={addBlacklist} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#f1f5f9] text-[#0f172a] hover:bg-[#e2e8f0]">
              <Plus size={14} /> Add
            </button>
          </div>

          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
            {policy?.process_blacklist?.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]"
              >
                <span>{item}</span>
                <button onClick={() => removeBlacklist(item)} className="hover:text-[#991b1b]">
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Whitelist Card */}
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#f1f5f9]">
            <Shield size={18} className="text-[#10b981]" />
            <div>
              <h3 className="font-bold text-base text-[#0f172a]">Permitted Whitelist</h3>
              <p className="text-xs text-[#64748b]">
                Processes safe for automatic live healing actions.
              </p>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="e.g. node, python, chrome..."
              value={newWhitelist}
              onChange={(e) => setNewWhitelist(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-[#e2e8f0] bg-[#f8fafc] font-mono"
            />
            <button onClick={addWhitelist} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#f1f5f9] text-[#0f172a] hover:bg-[#e2e8f0]">
              <Plus size={14} /> Add
            </button>
          </div>

          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
            {policy?.process_whitelist?.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]"
              >
                <span>{item}</span>
                <button onClick={() => removeWhitelist(item)} className="hover:text-[#065f46]">
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
