import { useState } from 'react'
import { confirmAction, cancelAction } from '../../api/ai'

const STATUS_LABELS = {
  executed: 'Done',
  cancelled: 'Cancelled',
  expired: 'Expired',
  failed: 'Failed',
}

// Shows one AI-proposed write action with Confirm/Cancel buttons while it
// is pending, then its resolved status once it isn't. Used by both
// Assistant.jsx and the dashboard AI chat in MainContent.jsx.
function ActionConfirmCard({ action, onUpdate }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const isPending = action.status === 'pending'

  async function handleConfirm() {
    if (busy) {
      return
    }

    try {
      setBusy(true)
      setError('')

      const response = await confirmAction(action._id)

      onUpdate({
        ...action,
        status: response.status,
        result: response.result,
      })
    } catch (confirmError) {
      if (confirmError.status === 410) {
        onUpdate({ ...action, status: 'expired' })
        return
      }

      setError(
        confirmError.message || 'Failed to confirm the action.'
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleCancel() {
    if (busy) {
      return
    }

    try {
      setBusy(true)
      setError('')

      const response = await cancelAction(action._id)

      onUpdate({ ...action, status: response.status })
    } catch (cancelError) {
      if (cancelError.status === 410) {
        onUpdate({ ...action, status: 'expired' })
        return
      }

      setError(
        cancelError.message || 'Failed to cancel the action.'
      )
    } finally {
      setBusy(false)
    }
  }

  const statusText = isPending
    ? ''
    : (STATUS_LABELS[action.status] || action.status) +
      (action.status === 'failed' && action.result?.error
        ? `: ${action.result.error}`
        : '')

  return (
    <div className="action-card">
      <p className="action-card-summary">{action.summary}</p>

      {isPending && (
        <div className="action-card-actions">
          <button
            type="button"
            className="action-card-cancel"
            onClick={handleCancel}
            disabled={busy}
          >
            Cancel
          </button>

          <button
            type="button"
            className="action-card-confirm"
            onClick={handleConfirm}
            disabled={busy}
          >
            Confirm
          </button>
        </div>
      )}

      <div className="action-card-status" aria-live="polite">
        {statusText}
      </div>

      {error && (
        <p className="action-card-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export default ActionConfirmCard
