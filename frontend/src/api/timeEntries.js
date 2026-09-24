import { apiRequest } from './api'

// Get all time entries
export function getTimeEntries() {
  return apiRequest('/time-entries')
}

export function getTimeEntry(id) {
  return apiRequest(`/time-entries/${id}`)
}

export function createTimeEntry(timeEntry) {
  return apiRequest('/time-entries', {
    method: 'POST',
    body: JSON.stringify(timeEntry),
  })
}

export function updateTimeEntry(id, timeEntry) {
  return apiRequest(`/time-entries/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(timeEntry),
  })
}

export function deleteTimeEntry(id) {
  return apiRequest(`/time-entries/${id}`, {
    method: 'DELETE',
  })
}