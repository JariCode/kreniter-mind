const HELSINKI_TIME_ZONE = 'Europe/Helsinki'

// ISO 8601 week number for a calendar date (the "nearest Thursday" method),
// given as separate year/month(1-based)/day fields so the caller can supply
// fields already resolved to a specific timezone rather than a Date object.
function getIsoWeek(year, month, day) {
  const target = new Date(Date.UTC(year, month - 1, day))

  const dayNumber = (target.getUTCDay() + 6) % 7

  target.setUTCDate(target.getUTCDate() - dayNumber + 3)

  const firstThursday = new Date(
    Date.UTC(target.getUTCFullYear(), 0, 4)
  )

  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7

  firstThursday.setUTCDate(
    firstThursday.getUTCDate() - firstDayNumber + 3
  )

  return (
    1 +
    Math.round((target - firstThursday) / (7 * 86400000))
  )
}

// The current date/time as displayed to the AI Assistant, always resolved
// in the Europe/Helsinki timezone regardless of the server's own timezone,
// e.g. "Tuesday 29.9.2026 12:40 (Europe/Helsinki), ISO week 40".
function formatCurrentDateTimeForAssistant(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: HELSINKI_TIME_ZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const byType = {}

  for (const part of parts) {
    byType[part.type] = part.value
  }

  const year = Number(byType.year)
  const month = Number(byType.month)
  const day = Number(byType.day)
  // Some ICU versions render midnight as "24:00" with hour12: false.
  const hour = byType.hour === '24' ? '00' : byType.hour
  const week = getIsoWeek(year, month, day)

  return `${byType.weekday} ${day}.${month}.${year} ${hour}:${byType.minute} (${HELSINKI_TIME_ZONE}), ISO week ${week}`
}

// Today's calendar date as a UTC-midnight Date, matching how this app
// stores every other date-only field (parsed from a "YYYY-MM-DD" form
// value, which JS resolves to UTC midnight) -- used as the fallback date
// when a task's status requires a date that wasn't explicitly given.
function getTodayDateOnly(now = new Date()) {
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    )
  )
}

module.exports = {
  formatCurrentDateTimeForAssistant,
  getTodayDateOnly,
}
