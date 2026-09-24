import { apiRequest } from './api'

// Get all time entries
export function getTimeEntries() {
  return apiRequest('/api/time-entries')
}

export function getTimeEntry(id) {
  return apiRequest(`/api/time-entries/${id}`)
}

export function createTimeEntry(timeEntry) {
  return apiRequest('/api/time-entries', {
    method: 'POST',
    body: JSON.stringify(timeEntry),
  })
}

export function updateTimeEntry(id, timeEntry) {
  return apiRequest(`/api/time-entries/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(timeEntry),
  })
}

export function deleteTimeEntry(id) {
  return apiRequest(`/api/time-entries/${id}`, {
    method: 'DELETE',
  })
}