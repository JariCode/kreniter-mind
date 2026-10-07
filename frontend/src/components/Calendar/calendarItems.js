import { isSameDay, toDateKey } from './calendarDates'

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

// Task start/due/completed markers for this day, out of the server's
// already-matched taskDates list (backend/utils/calendarItems.js, shared
// with the AI Assistant) -- each entry already carries which of a task's
// dates it is ("kind") and which day it falls on ("dayKey"), so this is
// just a display-time filter, not a decision about which day a task's
// dates belong to.
export function getTaskMarkersForDay(taskMarkers, day) {
  const dayKey = toDateKey(day)

  return taskMarkers.filter((marker) => marker.dayKey === dayKey)
}

const TASK_MARKER_LABELS = {
  start: 'Start: ',
  due: 'Due: ',
  completed: 'Completed: ',
}

// The label prefix shown before a task's title on a task marker.
export function taskMarkerLabel(kind) {
  return TASK_MARKER_LABELS[kind] || ''
}

// The extra class that visually distinguishes a completed-date marker
// (the app's existing completed-green) from the start/due markers.
// A completed task's start/due markers also get this class, so every
// marker of a completed task shows as completed-green.
export function taskMarkerVariantClassName(kind, status) {
  return kind === 'completed' || status === 'completed'
    ? 'calendar-task-marker-completed'
    : ''
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

  const completedCount = taskMarkers.filter(
    (marker) => marker.kind === 'completed'
  ).length

  if (completedCount > 0) {
    parts.push(
      `${completedCount} ${pluralize(
        completedCount,
        'task',
        'tasks'
      )} completed`
    )
  }

  return parts.join(', ')
}
