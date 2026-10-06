import { apiRequest } from './api'

// Get active timer
export function getActiveTimer() {
  return apiRequest('/active-timer')
}

// Start a new timer. `now` is the client's own Date.now() at click time,
// so the server's elapsed-time math is based on the same instant the UI
// already reflects, not on whenever the request happens to arrive.
export function startActiveTimerAction({
  taskId,
  projectId,
  description,
  now,
}) {
  return apiRequest('/active-timer/start', {
    method: 'POST',
    body: JSON.stringify({ taskId, projectId, description, now }),
  })
}

// Pause the active timer.
export function pauseActiveTimerAction(now) {
  return apiRequest('/active-timer/pause', {
    method: 'POST',
    body: JSON.stringify({ now }),
  })
}

// Resume the active timer.
export function resumeActiveTimerAction(now) {
  return apiRequest('/active-timer/resume', {
    method: 'POST',
    body: JSON.stringify({ now }),
  })
}

// Stop the active timer and save its tracked time as a time entry.
export function stopActiveTimerAction(now) {
  return apiRequest('/active-timer/stop', {
    method: 'POST',
    body: JSON.stringify({ now }),
  })
}

// Delete active timer (discard without saving a time entry)
export function deleteActiveTimer() {
  return apiRequest('/active-timer', {
    method: 'DELETE',
  })
}
