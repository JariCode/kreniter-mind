// Date math shared by the Month/Week/Day views: everything here treats
// weeks as Monday-first, matching the required "viikkonumerot vasemmalla,
// maanantai ensimmäisenä" layout.

// A new Date at local midnight for the given Date/string/number.
export function toDateOnly(value) {
  const date = new Date(value)
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  )
}

export function addDays(date, amount) {
  const result = new Date(date)
  result.setDate(result.getDate() + amount)
  return result
}

export function addMonths(date, amount) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + amount,
    1
  )
}

// 0 = Monday ... 6 = Sunday, unlike Date#getDay (0 = Sunday).
export function getMondayIndex(date) {
  return (date.getDay() + 6) % 7
}

export function startOfWeek(date) {
  return addDays(toDateOnly(date), -getMondayIndex(date))
}

export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// "YYYY-MM-DD" in local time -- used both as a React key and to match
// events/tasks (whose date fields are compared via toDateOnly) to a day.
export function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ISO 8601 week number and week-year for a date.
export function getISOWeek(date) {
  const target = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  )

  const dayNumber = (target.getUTCDay() + 6) % 7

  target.setUTCDate(target.getUTCDate() - dayNumber + 3)

  const firstThursday = new Date(
    Date.UTC(target.getUTCFullYear(), 0, 4)
  )

  const firstDayNumber =
    (firstThursday.getUTCDay() + 6) % 7

  firstThursday.setUTCDate(
    firstThursday.getUTCDate() - firstDayNumber + 3
  )

  const week =
    1 +
    Math.round(
      (target - firstThursday) / (7 * 86400000)
    )

  return { week, year: target.getUTCFullYear() }
}

// A grid of Monday-first weeks covering the whole month, including the
// leading/trailing days from adjacent months needed to fill full weeks.
export function getMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1)
  const lastOfMonth = new Date(year, month + 1, 0)

  const gridStart = startOfWeek(firstOfMonth)
  const gridEnd = addDays(startOfWeek(lastOfMonth), 6)

  const weeks = []
  let current = gridStart

  while (current <= gridEnd) {
    const week = []

    for (let i = 0; i < 7; i++) {
      week.push(current)
      current = addDays(current, 1)
    }

    weeks.push(week)
  }

  return weeks
}

export function formatMonthYear(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function formatFullDate(date) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function formatDayLabel(date) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
}

export const WEEKDAY_LABELS = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
]

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
