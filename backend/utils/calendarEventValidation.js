const mongoose = require('mongoose')
const Project = require('../models/Project')

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const MAX_RANGE_DAYS = 366

// Parses a "YYYY-MM-DD" (or any Date-parseable) day-only string into a
// Date at midnight, or null if it isn't a valid date.
function parseDateOnly(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date
}

// Validates and normalizes the fields shared by create and update. Both
// treat the request as a full replace of every field (like the other
// resources' PATCH routes in this app), so this is used identically by
// the calendar event route (POST and PATCH) and by the AI Assistant's
// create/update calendar tools. Returns { error, status } or { data }.
async function buildEventData(userId, body) {
  const title =
    typeof body.title === 'string' ? body.title.trim() : ''

  if (!title) {
    return { error: 'Title is required', status: 400 }
  }

  const date = parseDateOnly(body.date)

  if (!date) {
    return { error: 'A valid date is required', status: 400 }
  }

  const description =
    typeof body.description === 'string'
      ? body.description
      : ''

  const allDay = body.allDay !== false

  let startTime = null
  let endTime = null

  if (!allDay) {
    startTime = body.startTime
    endTime = body.endTime

    if (
      typeof startTime !== 'string' ||
      !TIME_PATTERN.test(startTime)
    ) {
      return { error: 'Invalid time', status: 400 }
    }

    if (
      typeof endTime !== 'string' ||
      !TIME_PATTERN.test(endTime)
    ) {
      return { error: 'Invalid time', status: 400 }
    }

    if (endTime <= startTime) {
      return {
        error: 'End time must be after start time',
        status: 400,
      }
    }
  }

  let projectId = null

  if (body.projectId) {
    if (!mongoose.Types.ObjectId.isValid(body.projectId)) {
      return { error: 'Invalid project ID', status: 400 }
    }

    const project = await Project.findOne({
      _id: body.projectId,
      userId,
    })

    if (!project) {
      return { error: 'Project not found', status: 404 }
    }

    projectId = body.projectId
  }

  return {
    data: {
      title,
      description,
      date,
      allDay,
      startTime,
      endTime,
      projectId,
    },
  }
}

module.exports = {
  TIME_PATTERN,
  MAX_RANGE_DAYS,
  parseDateOnly,
  buildEventData,
}
