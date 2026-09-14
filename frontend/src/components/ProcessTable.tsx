import React, { useState } from 'react'
import { Search, ArrowUpDown, ShieldAlert, AlertTriangle, CheckCircle, Eye } from 'lucide-react'
import { useNexusStore } from '../store'
import type { ProcessSnapshot } from '../types'

export function ProcessTable() {
  const { processes, setSelectedProcess } = useNexusStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'critical' | 'warning' | 'observation' | 'healthy'>('all')

  const counts = {
    all: processes.length,
    critical: processes.filter((p) => p.health_status === 'critical').length,
    warning: processes.filter((p) => p.health_status === 'warning').length,
    observation: processes.filter((p) => p.health_status === 'under_observation').length,
    healthy: processes.filter((p) => p.health_status === 'healthy').length,
  }

  // Filter processes
  const filtered = processes.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.pid.toString().includes(searchTerm) ||
      p.username.toLowerCase().includes(searchTerm.toLowerCase())

    if (!matchesSearch) return false

    if (activeTab === 'critical') return p.health_status === 'critical'
    if (activeTab === 'warning') return p.health_status === 'warning'
    if (activeTab === 'observation') return p.health_status === 'under_observation'
    if (activeTab === 'healthy') return p.health_status === 'healthy'
    return true
  })

  const getStatusBadge = (p: ProcessSnapshot) => {
    if (p.health_status === 'critical') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#dc2626]" /> Critical
        </span>
      )
    }
    if (p.health_status === 'warning') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#fffbeb] text-[#d97706] border border-[#fde68a]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#d97706]" /> Warning
        </span>
      )
    }
    if (p.health_status === 'under_observation') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#f5f3ff] text-[#7c3aed] border border-[#ddd6fe]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#7c3aed]" /> Under observation
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#059669]" /> Healthy
      </span>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search Bar & Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-2.5 text-[#94a3b8]" />
          <input
            type="text"
            placeholder="Search name, PID, or user"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-[#e2e8f0] bg-white focus:outline-none focus:border-[#10b981]"
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-[#f1f5f9] p-1 rounded-xl text-xs font-medium">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'all' ? 'bg-white text-[#0f172a] shadow-xs font-semibold' : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            All <span className="text-[#94a3b8] font-mono ml-1">{counts.all}</span>
          </button>
          <button
            onClick={() => setActiveTab('critical')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'critical' ? 'bg-white text-[#dc2626] shadow-xs font-semibold' : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            Critical <span className="text-[#dc2626] font-mono ml-1">{counts.critical}</span>
          </button>
          <button
            onClick={() => setActiveTab('warning')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'warning' ? 'bg-white text-[#d97706] shadow-xs font-semibold' : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            Warning <span className="text-[#d97706] font-mono ml-1">{counts.warning}</span>
          </button>
          <button
            onClick={() => setActiveTab('observation')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'observation' ? 'bg-white text-[#7c3aed] shadow-xs font-semibold' : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            Observation <span className="text-[#7c3aed] font-mono ml-1">{counts.observation}</span>
          </button>
          <button
            onClick={() => setActiveTab('healthy')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'healthy' ? 'bg-white text-[#059669] shadow-xs font-semibold' : 'text-[#64748b] hover:text-[#0f172a]'
            }`}
          >
            Healthy <span className="text-[#059669] font-mono ml-1">{counts.healthy}</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="nexus-table">
          <thead>
            <tr>
              <th className="flex items-center gap-1">Process <ArrowUpDown size={12} /></th>
              <th>Status</th>
              <th>CPU % <ArrowUpDown size={12} /></th>
              <th>Memory % <ArrowUpDown size={12} /></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-[#94a3b8]">
                  No matching processes found.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr
                  key={p.pid}
                  onClick={() => setSelectedProcess(p)}
                  className="cursor-pointer"
                >
                  <td className="font-semibold text-[#0f172a]">
                    <div className="flex items-center gap-2">
                      <span>{p.name}</span>
                      <span className="text-xs text-[#94a3b8] font-mono font-normal">
                        PID {p.pid} · {p.username}
                      </span>
                    </div>
                  </td>
                  <td>{getStatusBadge(p)}</td>
                  <td className="font-mono text-xs font-semibold text-[#0f172a]">{p.cpu_percent.toFixed(1)}%</td>
                  <td className="font-mono text-xs font-semibold text-[#0f172a]">{p.memory_percent.toFixed(1)}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
