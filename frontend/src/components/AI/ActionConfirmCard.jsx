import { useState } from 'react'
import { confirmAction, cancelAction } from '../../api/ai'

const STATUS_LABELS = {
  executed: 'Done',
  cancelled: 'Cancelled',
  expired: 'Expired',
  failed: 'Failed',
}

const CALENDAR_ACTION_TYPES = new Set([
  'create_calendar_event',
  'update_calendar_event',
  'delete_calendar_event',
])

// Shows one AI-proposed write action with Confirm/Cancel buttons while it
// is pending, then its resolved status once it isn't. Used by both
// Assistant.jsx and the dashboard AI chat in MainContent.jsx.
//
// onUpdate(updatedAction, message) is called once the server has resolved
// the action: message is the assistant message the server saved to the
// conversation ("Done: ...", "Failed: ...", etc.), for the caller to add
// to its own message list immediately, the same way a new message would
// be. message is omitted if the request itself failed before the server
// could resolve anything (network/server error) — the card then just
// shows the error locally and keeps its buttons enabled.
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

      if (
        response.status === 'executed' &&
        CALENDAR_ACTION_TYPES.has(action.type)
      ) {
        // Lets the Calendar page and dashboard widget refresh themselves
        // immediately if they happen to be open right now.
        window.dispatchEvent(new Event('calendar-events-changed'))
      }

      onUpdate(
        {
          ...action,
          status: response.status,
          result: response.result,
        },
        response.message
      )
    } catch (confirmError) {
      if (confirmError.status === 410) {
        onUpdate(
          { ...action, status: 'expired' },
          confirmError.data?.message
        )
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

      onUpdate(
        { ...action, status: response.status },
        response.message
      )
    } catch (cancelError) {
      if (cancelError.status === 410) {
        onUpdate(
          { ...action, status: 'expired' },
          cancelError.data?.message
        )
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

  const statusModifierClass =
    action.status === 'executed'
      ? ' action-card-status-success'
      : action.status === 'failed'
        ? ' action-card-status-danger'
        : ''

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

      <div
        className={`action-card-status${statusModifierClass}`}
        aria-live="polite"
      >
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
