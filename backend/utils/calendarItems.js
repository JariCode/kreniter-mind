const CalendarEvent = require('../models/CalendarEvent')
const Task = require('../models/Task')

const HELSINKI_TIME_ZONE = 'Europe/Helsinki'
const MAX_RANGE_DAYS = 366
const ONE_DAY_MS = 86400000

// Which Task date fields become a calendar marker, and what kind each one
// is labelled as -- mirrors frontend/src/components/Calendar/calendarItems.js
// getTaskMarkersForDay exactly (a task can produce up to one marker per
// field, so up to three total).
const TASK_DATE_FIELDS = [
  ['startDate', 'start'],
  ['dueDate', 'due'],
  ['completedDate', 'completed'],
]

// Parses a "YYYY-MM-DD" (or any Date-parseable) day-only string into a
// Date, or null if it isn't a valid date. Same convention as
// calendarEventValidation.js's parseDateOnly.
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

// The Europe/Helsinki calendar day ("YYYY-MM-DD") a UTC instant falls on.
//
// Every date-only field in this app (CalendarEvent.date, Task.startDate/
// dueDate/completedDate) is written as exact UTC midnight of the intended
// calendar day (parsed from a "YYYY-MM-DD" form value). The frontend reads
// these back with plain, timezone-naive Date getters, which land on the
// same calendar day as long as the browser's own timezone is Europe/
// Helsinki -- the only timezone this app is built for. Resolving explicitly
// through Europe/Helsinki here, rather than through the server process's
// own timezone (which may well be UTC in production), keeps this function
// agreeing with the frontend regardless of where the server runs.
function toHelsinkiDayKey(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: HELSINKI_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const byType = {}

  for (const part of parts) {
    byType[part.type] = part.value
  }

  return `${byType.year}-${byType.month}-${byType.day}`
}

function stripSensitiveFields(doc) {
  if (!doc) {
    return doc
  }

  const clean = { ...doc }

  delete clean.userId
  delete clean.__v

  return clean
}

// Builds the exact calendar view for [from, to] (inclusive, "YYYY-MM-DD",
// at most 366 days): CalendarEvent rows plus task start/due/completed
// markers, combined using the same rules the Calendar page and widget use
// (frontend/src/components/Calendar/calendarItems.js) so every consumer --
// the Calendar page, the dashboard widget, and the AI Assistant -- sees an
// identical calendar for the same range. Always scoped to userId. Returns
// { error } or { from, to, events, taskDates }, where each event and each
// taskDates entry carries a "dayKey" (its Europe/Helsinki calendar day) so
// callers can group by day with a plain string comparison instead of
// re-deriving it.
async function buildCalendarItems(userId, fromValue, toValue) {
  const from = parseDateOnly(fromValue)
  const to = parseDateOnly(toValue)

  if (!from || !to) {
    return { error: 'from and to must be valid dates' }
  }

  if (to < from) {
    return { error: 'to must not be before from' }
  }

  const rangeDays = Math.round((to - from) / ONE_DAY_MS) + 1

  if (rangeDays > MAX_RANGE_DAYS) {
    return { error: 'Date range is too long' }
  }

  // Deriving the key from the parsed Date (rather than trusting the raw
  // query string's formatting) normalizes it to the same "YYYY-MM-DD"
  // shape produced below for each item, so the string comparisons that
  // filter by range are always comparing like with like.
  const fromKey = toHelsinkiDayKey(from)
  const toKey = toHelsinkiDayKey(to)

  // Widened by a day on each side so the query -- expressed in plain UTC,
  // since MongoDB can't filter by Europe/Helsinki calendar day directly --
  // can never exclude an instant that actually resolves to an in-range
  // Europe/Helsinki day. The exact dayKey filter below then trims it back
  // down precisely.
  const queryFrom = new Date(from.getTime() - ONE_DAY_MS)
  const queryTo = new Date(to.getTime() + ONE_DAY_MS)

  const [eventDocs, taskDocs] = await Promise.all([
    CalendarEvent.find({
      userId,
      date: { $gte: queryFrom, $lte: queryTo },
    })
      .sort({ date: 1, startTime: 1 })
      .lean(),
    Task.find({
      userId,
      $or: TASK_DATE_FIELDS.map(([field]) => ({
        [field]: { $gte: queryFrom, $lte: queryTo },
      })),
    })
      .sort({ createdAt: -1 })
      .lean(),
  ])

  const events = eventDocs
    .map((event) => ({
      ...stripSensitiveFields(event),
      dayKey: toHelsinkiDayKey(event.date),
    }))
    .filter((event) => event.dayKey >= fromKey && event.dayKey <= toKey)

  const taskDates = []

  for (const task of taskDocs) {
    const strippedTask = stripSensitiveFields(task)

    for (const [field, kind] of TASK_DATE_FIELDS) {
      const value = task[field]

      if (!value) {
        continue
      }

      const dayKey = toHelsinkiDayKey(value)

      if (dayKey >= fromKey && dayKey <= toKey) {
        taskDates.push({
          task: strippedTask,
          kind,
          date: value,
          dayKey,
        })
      }
    }
  }

  return { from: fromKey, to: toKey, events, taskDates }
}

module.exports = {
  MAX_RANGE_DAYS,
  toHelsinkiDayKey,
  buildCalendarItems,
}
