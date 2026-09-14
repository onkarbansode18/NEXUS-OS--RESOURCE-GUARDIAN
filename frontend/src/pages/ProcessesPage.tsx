import React from 'react'
import { Header, ProcessTable } from '../components'

export function ProcessesPage() {
  return (
    <div className="page font-plex">
      <Header
        title="Processes"
        description="Live per-process resource usage with anomaly status and corrective actions"
      />
      <ProcessTable />
    </div>
  )
}
