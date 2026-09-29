import { apiRequest } from './api'

// "YYYY-MM-DD" for a Date, in local time.
function toDateParam(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getCalendarEvents(from, to) {
  return apiRequest(
    `/calendar-events?from=${toDateParam(from)}&to=${toDateParam(to)}`
  )
}

export function createCalendarEvent(event) {
  return apiRequest('/calendar-events', {
    method: 'POST',
    body: JSON.stringify(event),
  })
}

export function updateCalendarEvent(id, event) {
  return apiRequest(`/calendar-events/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(event),
  })
}

export function deleteCalendarEvent(id) {
  return apiRequest(`/calendar-events/${id}`, {
    method: 'DELETE',
  })
}
