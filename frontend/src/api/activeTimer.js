import { apiRequest } from './api'

// Get active timer
export function getActiveTimer() {
  return apiRequest('/active-timer')
}

// Create active timer
export function createActiveTimer(timer) {
  return apiRequest('/active-timer', {
    method: 'POST',
    body: JSON.stringify(timer),
  })
}

// Update active timer
export function updateActiveTimer(timer) {
  return apiRequest('/active-timer', {
    method: 'PATCH',
    body: JSON.stringify(timer),
  })
}

// Delete active timer
export function deleteActiveTimer() {
  return apiRequest('/active-timer', {
    method: 'DELETE',
  })
}