const express = require('express')
const ActiveTimer = require('../models/ActiveTimer')
const Project = require('../models/Project')
const Task = require('../models/Task')
const {
  startActiveTimer,
  switchActiveTimer,
  pauseActiveTimer,
  resumeActiveTimer,
  stopActiveTimerAndSaveEntry,
} = require('../utils/timerActions')

const router = express.Router()

// Checks that projectId/taskId (when given) belong to this user, and that
// a given task actually belongs to a given project.
async function checkTimerOwnership(userId, { projectId, taskId }) {
  if (projectId) {
    const project = await Project.findOne({
      _id: projectId,
      userId,
    })

    if (!project) {
      return { error: 'Project not found' }
    }
  }

  if (taskId) {
    const task = await Task.findOne({
      _id: taskId,
      userId,
    })

    if (!task) {
      return { error: 'Task not found' }
    }

    if (
      projectId &&
      task.projectId &&
      String(task.projectId) !== String(projectId)
    ) {
      return {
        error: 'Task must belong to the selected project',
      }
    }
  }

  return {}
}

// Every start/switch/pause/resume/stop request carries the moment (epoch
// ms) the browser captured the action at, so the elapsed-time math is
// based on the same instant it always was -- not on whenever the request
// happens to reach the server.
function parseNow(body) {
  const now = Number(body.now)

  return Number.isFinite(now) ? now : null
}

// Get active timer for current user
router.get('/', async (req, res, next) => {
  try {
    const activeTimer = await ActiveTimer.findOne({
      userId: req.user._id,
    })

    if (!activeTimer) {
      return res.json(null)
    }

    res.json(activeTimer)
  } catch (error) {
    next(error)
  }
})

// Delete active timer
router.delete('/', async (req, res, next) => {
  try {
    const activeTimer =
      await ActiveTimer.findOneAndDelete({
        userId: req.user._id,
      })

    if (!activeTimer) {
      return res.status(404).json({
        error: 'Active timer not found',
      })
    }

    res.json({
      message: 'Active timer deleted',
    })
  } catch (error) {
    next(error)
  }
})

// Start a new timer. Fails if the user already has one active, regardless
// of which task -- matching the existing web UI's own guard, which never
// lets the user reach "start" while a timer is already running or paused.
router.post('/start', async (req, res, next) => {
  try {
    const now = parseNow(req.body)

    if (now === null) {
      return res.status(400).json({ error: 'Invalid now' })
    }

    const ownership = await checkTimerOwnership(
      req.user._id,
      req.body
    )

    if (ownership.error) {
      return res.status(404).json({ error: ownership.error })
    }

    const { activeTimer, error } = await startActiveTimer(
      req.user._id,
      {
        taskId: req.body.taskId || null,
        projectId: req.body.projectId || null,
        description: req.body.description || '',
        startedAt: new Date(now),
        segmentStartedAt: new Date(now),
      }
    )

    if (error === 'ACTIVE_TIMER_EXISTS') {
      return res.status(409).json({
        error: 'An active timer already exists',
      })
    }

    res.status(201).json(activeTimer)
  } catch (error) {
    next(error)
  }
})

// Start a timer for a new task, stopping and saving whatever timer is
// currently active first (unless it's already tracking this same task).
// Used by the AI Assistant's timer tools; not reachable from the plain
// web UI, which has no "switch task" action.
router.post('/switch', async (req, res, next) => {
  try {
    const now = parseNow(req.body)

    if (now === null) {
      return res.status(400).json({ error: 'Invalid now' })
    }

    const ownership = await checkTimerOwnership(
      req.user._id,
      req.body
    )

    if (ownership.error) {
      return res.status(404).json({ error: ownership.error })
    }

    const { activeTimer, error } = await switchActiveTimer(
      req.user._id,
      {
        taskId: req.body.taskId || null,
        projectId: req.body.projectId || null,
        description: req.body.description || '',
        startedAt: new Date(now),
        segmentStartedAt: new Date(now),
        now,
      }
    )

    if (error === 'SAME_TASK_ACTIVE') {
      return res.status(409).json({
        error: 'A timer for this task is already active.',
      })
    }

    res.status(201).json(activeTimer)
  } catch (error) {
    next(error)
  }
})

// Pause the user's active timer.
router.post('/pause', async (req, res, next) => {
  try {
    const now = parseNow(req.body)

    if (now === null) {
      return res.status(400).json({ error: 'Invalid now' })
    }

    const timer = await ActiveTimer.findOne({
      userId: req.user._id,
    })

    if (!timer) {
      return res.status(404).json({
        error: 'Active timer not found',
      })
    }

    const { error } = await pauseActiveTimer(timer, now)

    if (error === 'NOT_RUNNING') {
      return res.status(409).json({
        error: 'The active timer is not running.',
      })
    }

    res.json(timer)
  } catch (error) {
    next(error)
  }
})

// Resume the user's active timer.
router.post('/resume', async (req, res, next) => {
  try {
    const now = parseNow(req.body)

    if (now === null) {
      return res.status(400).json({ error: 'Invalid now' })
    }

    const timer = await ActiveTimer.findOne({
      userId: req.user._id,
    })

    if (!timer) {
      return res.status(404).json({
        error: 'Active timer not found',
      })
    }

    const { error } = await resumeActiveTimer(timer, now)

    if (error === 'NOT_PAUSED') {
      return res.status(409).json({
        error: 'The active timer is not paused.',
      })
    }

    res.json(timer)
  } catch (error) {
    next(error)
  }
})

// Stop the user's active timer and save its tracked time as a TimeEntry,
// in one request (the web UI used to do this as two separate requests).
router.post('/stop', async (req, res, next) => {
  try {
    const now = parseNow(req.body)

    if (now === null) {
      return res.status(400).json({ error: 'Invalid now' })
    }

    const timer = await ActiveTimer.findOne({
      userId: req.user._id,
    })

    if (!timer) {
      return res.status(404).json({
        error: 'Active timer not found',
      })
    }

    const timeEntry = await stopActiveTimerAndSaveEntry(
      req.user._id,
      timer,
      now
    )

    res.json({ timeEntry })
  } catch (error) {
    next(error)
  }
})

module.exports = router