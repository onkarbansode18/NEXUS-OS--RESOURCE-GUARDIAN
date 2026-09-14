import React, { useState, useEffect } from 'react'
import { Clock, Plus, Trash2, CheckCircle2, ShieldAlert, Calendar } from 'lucide-react'
import { Header } from '../components'
import { api } from '../api/client'

interface MaintenanceWindow {
  id: number
  name: string
  process_pattern: string
  allowed_actions: string[]
  schedule_type: string
  start_hour: number
  end_hour: number
  days_of_week: number[]
  active: boolean
  created_at: string
}

export const MaintenancePage: React.FC = () => {
  const [windows, setWindows] = useState<MaintenanceWindow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeInfo, setActiveInfo] = useState<{ is_active: boolean; active_windows: any[] }>({
    is_active: true,
    active_windows: [],
  })

  // Modal / Form state
  const [showModal, setShowModal] = useState(false)
  const [name, setName] = useState('')
  const [pattern, setPattern] = useState('*')
  const [startHour, setStartHour] = useState(0)
  const [endHour, setEndHour] = useState(23)
  const [scheduleType, setScheduleType] = useState('daily')

  const loadData = async () => {
    setLoading(true)
    try {
      const list = await api.fetchMaintenanceWindows()
      setWindows(list)
      const activeRes = await api.checkMaintenanceActive()
      setActiveInfo(activeRes)
    } catch (err) {
      console.error('Failed to load maintenance windows:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.createMaintenanceWindow({
        name,
        process_pattern: pattern,
        start_hour: startHour,
        end_hour: endHour,
        schedule_type: scheduleType,
        allowed_actions: ['renice', 'restart', 'kill', 'throttle'],
        active: true,
      })
      setShowModal(false)
      setName('')
      loadData()
    } catch (err) {
      alert(`Failed to create window: ${err}`)
    }
  }

  const handleToggle = async (w: MaintenanceWindow) => {
    try {
      await api.updateMaintenanceWindow(w.id, { active: !w.active })
      loadData()
    } catch (err) {
      alert(`Failed to update window: ${err}`)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this maintenance window?')) return
    try {
      await api.deleteMaintenanceWindow(id)
      loadData()
    } catch (err) {
      alert(`Failed to delete window: ${err}`)
    }
  }

  return (
    <div className="page font-plex space-y-6">
      <Header
        title="Scheduled Maintenance Windows"
        description="Configure schedule policies governing when autonomous healing operations are permitted to execute."
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#059669] hover:bg-[#047857] transition-all shadow-sm flex items-center gap-2"
          >
            <Plus size={16} />
            Add Schedule Window
          </button>
        }
      />

      {/* Active Status Banner */}
      <div className="card p-5">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl border ${
              activeInfo.is_active
                ? 'bg-[#ecfdf5] text-[#059669] border-[#a7f3d0]'
                : 'bg-[#fffbeb] text-[#d97706] border-[#fde68a]'
            }`}
          >
            {activeInfo.is_active ? <CheckCircle2 size={22} /> : <ShieldAlert size={22} />}
          </div>
          <div>
            <h4 className="text-[#0f172a] font-bold text-sm">
              Current Maintenance Window Status:{' '}
              <span className={activeInfo.is_active ? 'text-[#059669]' : 'text-[#d97706]'}>
                {activeInfo.is_active ? 'WINDOW ACTIVE (Healing Permitted)' : 'OUTSIDE WINDOW (Alert Only Mode)'}
              </span>
            </h4>
            <p className="text-[#64748b] text-xs mt-0.5">
              {activeInfo.is_active
                ? 'Autonomous actions will be applied automatically for anomalous processes.'
                : 'All corrective actions will be downgraded to alert-only notifications outside scheduled windows.'}
            </p>
          </div>
        </div>
      </div>

      {/* Windows List Card */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#f1f5f9]">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-[#059669]" />
            <h3 className="font-bold text-base text-[#0f172a]">Configured Schedule Windows</h3>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-[#64748b] text-xs">Loading schedule policies...</div>
        ) : windows.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-[#e2e8f0] rounded-xl bg-[#f8fafc]">
            <Clock size={36} className="text-[#94a3b8] mx-auto mb-2" />
            <p className="text-[#0f172a] font-semibold text-xs">No custom maintenance windows defined.</p>
            <p className="text-[#64748b] text-xs mt-0.5">Default 24/7 window applies to all processes.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {windows.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between p-4 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] hover:border-[#cbd5e1] transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h4 className="font-bold text-[#0f172a] text-sm">{w.name}</h4>
                    <span
                      className={`px-2.5 py-0.5 text-xs font-semibold rounded-md border ${
                        w.active
                          ? 'badge-monitoring'
                          : 'bg-[#f1f5f9] text-[#64748b] border-[#e2e8f0]'
                      }`}
                    >
                      {w.active ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#64748b] font-mono">
                    <span>Pattern: <strong className="text-[#059669]">{w.process_pattern}</strong></span>
                    <span>Schedule: <strong className="text-[#0f172a]">{w.schedule_type} ({w.start_hour}:00 - {w.end_hour}:00)</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggle(w)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-[#cbd5e1] text-[#334155] hover:bg-[#f1f5f9] transition-colors"
                  >
                    {w.active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => handleDelete(w.id)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#fef2f2] border border-[#fecaca] text-[#dc2626] hover:bg-[#fee2e2] transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 bg-[#0f172a]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[#0f172a]">Create Schedule Window</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0f172a] mb-1">Window Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Off-Peak Night Healing"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a] focus:outline-none focus:border-[#10b981]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0f172a] mb-1">Process Pattern</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ffmpeg, chrome, *"
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a] font-mono focus:outline-none focus:border-[#10b981]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#0f172a] mb-1">Start Hour (0-23)</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={startHour}
                    onChange={(e) => setStartHour(parseInt(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a] focus:outline-none focus:border-[#10b981]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0f172a] mb-1">End Hour (0-23)</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={endHour}
                    onChange={(e) => setEndHour(parseInt(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#e2e8f0] bg-[#f8fafc] text-[#0f172a] focus:outline-none focus:border-[#10b981]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#f1f5f9]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-[#64748b] bg-[#f1f5f9] hover:bg-[#e2e8f0] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#059669] hover:bg-[#047857] transition-colors shadow-sm"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
