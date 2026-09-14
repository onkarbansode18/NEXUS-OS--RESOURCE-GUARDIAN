import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { ProcessDrawer } from './components/ProcessDrawer'
import { ActionConfirmationModal } from './components/ActionConfirmationModal'
import { Dashboard, ProcessesPage, IncidentsPage, PolicyPage, SettingsPage, PredictionsPage, MaintenancePage } from './pages'
import { useWebSocket } from './hooks/useWebSocket'

function AppContent() {
  // Activate WebSocket connection to backend orchestrator
  useWebSocket()

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/processes" element={<ProcessesPage />} />
          <Route path="/incidents" element={<IncidentsPage />} />
          <Route path="/incidents/:id" element={<IncidentsPage />} />
          <Route path="/predictions" element={<PredictionsPage />} />
          <Route path="/maintenance" element={<MaintenancePage />} />
          <Route path="/policy" element={<PolicyPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>


      {/* Global Slide-Over Process Drawer */}
      <ProcessDrawer />

      {/* Global Action Confirmation Modal */}
      <ActionConfirmationModal />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}
