import { isSameDay } from './calendarDates'

export function getEventsForDay(events, day) {
  return events
    .filter((event) => isSameDay(new Date(event.date), day))
    .sort((a, b) => {
      if (a.allDay !== b.allDay) {
        return a.allDay ? -1 : 1
      }

      if (a.allDay) {
        return 0
      }

      return a.startTime.localeCompare(b.startTime)
    })
}

// Tasks whose startDate or dueDate falls on this day. A task with both
// dates on the same day appears twice (once per reason), each carrying
// which one it is so the caller can label it accordingly.
export function getTaskMarkersForDay(tasks, day) {
  const markers = []

  for (const task of tasks) {
    if (
      task.startDate &&
      isSameDay(new Date(task.startDate), day)
    ) {
      markers.push({ task, kind: 'start' })
    }

    if (
      task.dueDate &&
      isSameDay(new Date(task.dueDate), day)
    ) {
      markers.push({ task, kind: 'due' })
    }
  }

  return markers
}

export function findProjectName(projects, projectId) {
  if (!projectId) {
    return null
  }

  const project = projects.find(
    (item) => String(item._id) === String(projectId)
  )

  return project ? project.name : null
}

export function statusLabel(status) {
  if (status === 'in-progress') {
    return 'Started'
  }

  if (status === 'completed') {
    return 'Completed'
  }

  return 'Added'
}

function pluralize(count, singular, plural) {
  return count === 1 ? singular : plural
}

// "29 September 2026, 2 events, 1 task due" -- used as the accessible
// label for a day button.
export function getDayAriaLabel(day, events, taskMarkers) {
  const dateLabel = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(day)

  const parts = [dateLabel]

  if (events.length > 0) {
    parts.push(
      `${events.length} ${pluralize(
        events.length,
        'event',
        'events'
      )}`
    )
  }

  const dueCount = taskMarkers.filter(
    (marker) => marker.kind === 'due'
  ).length

  if (dueCount > 0) {
    parts.push(
      `${dueCount} ${pluralize(
        dueCount,
        'task',
        'tasks'
      )} due`
    )
  }

  const startCount = taskMarkers.filter(
    (marker) => marker.kind === 'start'
  ).length

  if (startCount > 0) {
    parts.push(
      `${startCount} ${pluralize(
        startCount,
        'task',
        'tasks'
      )} starting`
    )
  }

  return parts.join(', ')
}
