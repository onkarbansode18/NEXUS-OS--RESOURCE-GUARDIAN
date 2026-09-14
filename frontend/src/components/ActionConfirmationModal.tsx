import React, { useEffect } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Zap, ShieldOff, Shield, XCircle } from 'lucide-react'
import { useNexusStore } from '../store'

export function ActionConfirmationModal() {
  const {
    confirmingAction,
    setConfirmingAction,
    executeAction,
    executingAction,
    lastActionResult,
    clearLastActionResult,
    policy,
  } = useNexusStore()

  const isLiveMode = !policy.simulation_mode

  // Auto-dismiss the result banner after 5 seconds
  useEffect(() => {
    if (lastActionResult) {
      const timer = setTimeout(() => clearLastActionResult(), 5000)
      return () => clearTimeout(timer)
    }
  }, [lastActionResult, clearLastActionResult])

  // Show success/error banner even after modal closes
  if (!confirmingAction && !lastActionResult) return null

  // Result feedback panel (shown after modal closes)
  if (!confirmingAction && lastActionResult) {
    return (
      <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full animate-slideInUp">
        <div
          className={`flex items-start gap-3 p-4 rounded-2xl shadow-2xl border ${
            !lastActionResult.success
              ? 'bg-[#fef2f2] border-[#fecaca] text-[#991b1b]'
              : lastActionResult.simulated
              ? 'bg-[#fffbeb] border-[#fde68a] text-[#92400e]'
              : 'bg-[#ecfdf5] border-[#a7f3d0] text-[#065f46]'
          }`}
        >
          {lastActionResult.success ? (
            <CheckCircle2 size={20} className="flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle size={20} className="flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className="text-sm font-semibold">{lastActionResult.message}</p>
            <p className="text-xs mt-0.5 opacity-70">
              {lastActionResult.simulated
                ? '🛡 Simulation mode — no OS change was made'
                : '⚡ Live mode — action executed directly on host process'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!confirmingAction) return null

  const { actionType, actionTitle, pid, processName, incidentId } = confirmingAction

  const handleApprove = () => {
    executeAction(actionType, pid || 0, processName || 'process', incidentId)
  }

  const isDestructive = ['kill', 'restart', 'suspend'].includes(actionType)

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={() => !executingAction && setConfirmingAction(null)}
      />

      {/* Modal Dialog */}
      <div className="relative bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl z-10 border border-[#e2e8f0] space-y-5">

        {/* Live Mode Warning Banner */}
        {isLiveMode ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#fef2f2] border-2 border-[#fca5a5] text-[#dc2626]">
            <ShieldOff size={20} className="flex-shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wide">⚠ Live Mode Active</p>
              <p className="text-[11px] mt-0.5 text-[#991b1b]">
                This action will be <strong>executed immediately</strong> on the real host process. There is no undo.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#f0fdf4] border border-[#86efac] text-[#15803d]">
            <Shield size={18} className="flex-shrink-0" />
            <p className="text-xs font-semibold">
              Simulation mode — action will be <strong>logged only</strong>, no OS change will be made.
            </p>
          </div>
        )}

        {/* Icon + Title */}
        <div className="flex items-start gap-4">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isDestructive
                ? 'bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]'
                : 'bg-[#fffbeb] text-[#d97706] border border-[#fde68a]'
            }`}
          >
            {isDestructive ? <AlertTriangle size={20} /> : <Zap size={20} />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#0f172a]">
              Confirm: {actionTitle}
            </h3>
            <p className="text-xs text-[#475569] mt-1 leading-relaxed">
              Apply <strong className="text-[#0f172a]">{actionTitle}</strong> to{' '}
              <strong className="text-[#0f172a]">{processName}</strong> (PID {pid}).
            </p>
          </div>
        </div>

        {/* Action summary row */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-[#f8fafc] border border-[#e2e8f0] text-xs font-mono">
          <span
            className={`px-2 py-0.5 rounded font-bold uppercase text-white ${
              isDestructive ? 'bg-[#dc2626]' : 'bg-[#0f172a]'
            }`}
          >
            {actionType}
          </span>
          <span className="text-[#64748b]">→</span>
          <span className="text-[#0f172a] font-semibold">{processName}</span>
          <span className="text-[#94a3b8]">PID {pid}</span>
          {isLiveMode && (
            <span className="ml-auto px-2 py-0.5 rounded bg-[#fee2e2] text-[#dc2626] text-[10px] font-bold uppercase">
              LIVE
            </span>
          )}
        </div>

        {/* Action-specific warnings */}
        {isLiveMode && actionType === 'restart' && (
          <div className="p-3 rounded-lg bg-[#fffbeb] border border-[#fde68a] text-xs text-[#92400e]">
            <strong>Restart:</strong> The process will be killed and relaunched with its original command-line arguments.
            If the process was started by a supervisor (systemd, launchd), the supervisor will handle the relaunch.
          </div>
        )}
        {isLiveMode && actionType === 'kill' && (
          <div className="p-3 rounded-lg bg-[#fef2f2] border border-[#fecaca] text-xs text-[#991b1b]">
            <strong>Kill:</strong> The process will receive SIGKILL / TerminateProcess and will be terminated immediately.
            Any unsaved data in the process may be lost.
          </div>
        )}
        {isLiveMode && actionType === 'suspend' && (
          <div className="p-3 rounded-lg bg-[#fffbeb] border border-[#fde68a] text-xs text-[#92400e]">
            <strong>Suspend:</strong> The process will be paused (SIGSTOP / NtSuspendProcess). Use Resume to unpause it.
          </div>
        )}
        {isLiveMode && actionType === 'throttle' && (
          <div className="p-3 rounded-lg bg-[#f0f9ff] border border-[#bae6fd] text-xs text-[#0369a1]">
            <strong>Throttle:</strong> Sets the process to lowest CPU scheduling priority.
            On Windows: IDLE_PRIORITY_CLASS. On Linux: nice=19.
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#f1f5f9]">
          <button
            onClick={() => setConfirmingAction(null)}
            disabled={executingAction}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-[#475569] bg-[#f1f5f9] hover:bg-[#e2e8f0] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleApprove}
            disabled={executingAction}
            className={`px-5 py-2 rounded-lg text-xs font-semibold text-white transition-colors shadow-sm flex items-center gap-2 disabled:opacity-70 ${
              isLiveMode && isDestructive
                ? 'bg-[#dc2626] hover:bg-[#b91c1c] ring-2 ring-[#dc2626]/30'
                : isDestructive
                ? 'bg-[#dc2626] hover:bg-[#b91c1c]'
                : 'bg-[#10b981] hover:bg-[#059669]'
            }`}
          >
            {executingAction ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                {isLiveMode ? 'Executing on host…' : 'Simulating…'}
              </>
            ) : (
              <>
                <CheckCircle2 size={15} />
                {isLiveMode ? `⚡ Execute Live: ${actionTitle}` : `Simulate: ${actionTitle}`}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
