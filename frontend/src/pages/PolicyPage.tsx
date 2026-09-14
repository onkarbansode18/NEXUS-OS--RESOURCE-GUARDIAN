import React from 'react'
import { Header, PolicyPanel } from '../components'

export function PolicyPage() {
  return (
    <div className="page font-plex">
      <Header
        title="Safety Policy & Guardrails"
        description="Configure simulation mode, alert thresholds, and protected process blacklists/whitelists"
      />
      <PolicyPanel />
    </div>
  )
}
