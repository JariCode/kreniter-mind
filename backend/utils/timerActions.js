const ActiveTimer = require('../models/ActiveTimer')
const TimeEntry = require('../models/TimeEntry')

// Single source of truth for all active-timer math and mutations. Used by
// both the activeTimer HTTP routes (the web UI) and the AI Assistant's
// timer tools, so the two can never drift apart.
//
// Every function that needs "the current moment" takes it as an explicit
// `now` argument rather than calling Date.now() itself. The web routes pass
// the timestamp the browser captured at click time (so elapsed-time math
// and rounding are based on the same instant as before this logic moved to
// the server); the AI path passes its own server-side Date.now(), exactly
// as it already did.

// Elapsed time in ms for a running or paused timer, as of `now`. Works
// whether segmentStartedAt is a Date, an ISO string or an epoch-ms number.
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

// Whole minutes, rounded, with a minimum of 1 minute if any time was
// tracked at all.
function elapsedMsToDurationMinutes(elapsedMs) {
  return elapsedMs > 0
    ? Math.max(1, Math.round(elapsedMs / 60000))
    : 0
}

// The user's active timer, or null. Scoped by userId so a request can
// never read another user's row.
async function findActiveTimer(userId) {
  return ActiveTimer.findOne({ userId })
}

// Stops the given (already-fetched, hydrated) timer and saves its tracked
// time as a TimeEntry: whole rounded minutes, minimum 1 if any time was
// tracked. `now` is the caller-supplied stop moment.
async function stopActiveTimerAndSaveEntry(
  userId,
  timer,
  now = Date.now()
) {
  const finalElapsedMs = getElapsedMs(timer, now)
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

// Starts a new timer. Fails if the user already has one active -- callers
// that want to replace an existing timer should use switchActiveTimer.
async function startActiveTimer(
  userId,
  { taskId, projectId, description, startedAt, segmentStartedAt }
) {
  const existingTimer = await findActiveTimer(userId)

  if (existingTimer) {
    return { error: 'ACTIVE_TIMER_EXISTS' }
  }

  const activeTimer = await ActiveTimer.create({
    userId,
    projectId: projectId || null,
    taskId: taskId || null,
    description: description || '',
    startedAt,
    elapsedMs: 0,
    segmentStartedAt,
    status: 'running',
  })

  return { activeTimer }
}

// Starts a timer for a new task. If a different task is currently being
// tracked, that timer is stopped and saved first, exactly like the app's
// own stop button would. If the SAME task is already being tracked,
// nothing changes and an error is returned instead.
async function switchActiveTimer(
  userId,
  {
    taskId,
    projectId,
    description,
    startedAt,
    segmentStartedAt,
    now,
  }
) {
  const existingTimer = await findActiveTimer(userId)

  if (
    existingTimer &&
    String(existingTimer.taskId || '') === String(taskId)
  ) {
    return { error: 'SAME_TASK_ACTIVE' }
  }

  if (existingTimer) {
    await stopActiveTimerAndSaveEntry(
      userId,
      existingTimer,
      now
    )
  }

  const activeTimer = await ActiveTimer.create({
    userId,
    projectId: projectId || null,
    taskId: taskId || null,
    description: description || '',
    startedAt,
    elapsedMs: 0,
    segmentStartedAt,
    status: 'running',
  })

  return { activeTimer }
}

// Pauses the given (already-fetched, hydrated) timer document. `now` is
// the caller-supplied pause moment.
async function pauseActiveTimer(timer, now = Date.now()) {
  if (timer.status !== 'running') {
    return { error: 'NOT_RUNNING' }
  }

  timer.elapsedMs = getElapsedMs(timer, now)
  timer.segmentStartedAt = null
  timer.status = 'paused'

  await timer.save()

  return { activeTimer: timer }
}

// Resumes the given (already-fetched, hydrated) timer document. `now` is
// the caller-supplied resume moment.
async function resumeActiveTimer(timer, now = Date.now()) {
  if (timer.status !== 'paused') {
    return { error: 'NOT_PAUSED' }
  }

  timer.segmentStartedAt = new Date(now)
  timer.status = 'running'

  await timer.save()

  return { activeTimer: timer }
}

module.exports = {
  getElapsedMs,
  elapsedMsToDurationMinutes,
  findActiveTimer,
  stopActiveTimerAndSaveEntry,
  startActiveTimer,
  switchActiveTimer,
  pauseActiveTimer,
  resumeActiveTimer,
}
