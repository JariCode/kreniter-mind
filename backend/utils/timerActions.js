const ActiveTimer = require('../models/ActiveTimer')
const TimeEntry = require('../models/TimeEntry')

// The actual timer math (elapsed time, pause/resume/stop semantics) lives
// in the frontend's TimeTracker.jsx context — the backend's activeTimer
// and timeEntry routes are plain CRUD with no domain logic of their own.
// This module mirrors that same math on the server, so the AI Assistant's
// timer tools behave identically without duplicating it a second time.

// Mirrors TimeTracker.jsx's getElapsedMs: elapsed time in ms for a running
// or paused timer, as of "now". Works whether segmentStartedAt is a Date,
// an ISO string or an epoch-ms number.
function getElapsedMs(timer, now = Date.now()) {
  if (!timer) {
    return 0
  }

  if (timer.status === 'paused') {
    return timer.elapsedMs
  }

  if (!timer.segmentStartedAt) {
    return timer.elapsedMs
  }

  const segmentStartedAtMs = new Date(
    timer.segmentStartedAt
  ).getTime()

  return timer.elapsedMs + (now - segmentStartedAtMs)
}

// Mirrors TimeTracker.jsx's stopTimer duration calculation: whole minutes,
// rounded, with a minimum of 1 minute if any time was tracked at all.
function elapsedMsToDurationMinutes(elapsedMs) {
  return elapsedMs > 0
    ? Math.max(1, Math.round(elapsedMs / 60000))
    : 0
}

// Mirrors TimeTracker.jsx's stopTimer: saves a TimeEntry for the given
// active timer, then deletes the active timer. Scoped to userId, and to
// this specific timer's _id so it can't race a newer one for the same user.
async function stopActiveTimerAndSaveEntry(userId, timer) {
  const finalElapsedMs = getElapsedMs(timer, Date.now())
  const durationInMinutes =
    elapsedMsToDurationMinutes(finalElapsedMs)

  const timeEntry = await TimeEntry.create({
    userId,
    projectId: timer.projectId,
    taskId: timer.taskId,
    description: timer.description,
    duration: durationInMinutes,
    startedAt: timer.startedAt,
  })

  await ActiveTimer.deleteOne({ _id: timer._id })

  return timeEntry
}

module.exports = {
  getElapsedMs,
  elapsedMsToDurationMinutes,
  stopActiveTimerAndSaveEntry,
}
