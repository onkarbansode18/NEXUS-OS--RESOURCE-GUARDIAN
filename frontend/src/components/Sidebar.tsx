import React from 'react'
import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Layers, 
  AlertTriangle, 
  Sliders, 
  Settings,
  Shield,
  TrendingUp,
  Clock
} from 'lucide-react'
import { useNexusStore } from '../store'

export function Sidebar() {
  const { policy, openIncidentCount, toggleSimulationMode } = useNexusStore()

  const isSimulation = policy?.simulation_mode ?? true

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/processes', label: 'Processes', icon: Layers },
    { 
      to: '/incidents', 
      label: 'Incidents', 
      icon: AlertTriangle, 
      badge: openIncidentCount > 0 ? openIncidentCount : null 
    },
    { to: '/predictions', label: 'Predictions', icon: TrendingUp },
    { to: '/maintenance', label: 'Maintenance', icon: Clock },
    { to: '/policy', label: 'Policies', icon: Sliders },
    { to: '/settings', label: 'Settings', icon: Settings },
  ]


  return (
    <aside className="sidebar">
      {/* Brand header */}
      <div className="p-5 flex items-center gap-3 border-b border-[#f1f5f9]">
        <div className="w-8 h-8 rounded-lg bg-[#ecfdf5] border border-[#a7f3d0] flex items-center justify-center text-[#059669]">
          <Shield size={18} />
        </div>
        <div>
          <h2 className="font-bold text-base tracking-tight text-[#0f172a]">Nexus</h2>
          <p className="text-xs text-[#64748b]">Resource Guardian</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#ecfdf5] text-[#059669] font-semibold'
                    : 'text-[#475569] hover:bg-[#f8fafc] hover:text-[#0f172a]'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon size={18} />
                <span>{item.label}</span>
              </div>
              {item.badge !== null && item.badge !== undefined && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]">
                  {item.badge}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-[#f1f5f9] space-y-3 bg-[#fafafa]">
        {/* Simulation Mode Switch Card */}
        <div className="p-3 rounded-lg bg-white border border-[#e2e8f0] shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#334155]">Simulation Mode</span>
          </div>
          <button
            onClick={toggleSimulationMode}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              isSimulation ? 'bg-[#10b981]' : 'bg-[#cbd5e1]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isSimulation ? 'translate-x-4' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* System Host Pill */}
        <div className="flex items-center justify-between text-xs px-1 text-[#64748b]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
            <span className="font-semibold text-[#0f172a]">System operational</span>
          </div>
          <span className="font-mono text-[11px]">atlas-w-04</span>
        </div>
      </div>
    </aside>
  )
}
