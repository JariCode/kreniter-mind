import { apiRequest } from './api'

export async function getTimeline() {
  return apiRequest('/timeline')
}

export async function saveTimeline(selectedProjectId) {
  return apiRequest('/timeline', {
    method: 'PUT',
    body: JSON.stringify({
      selectedProjectId,
    }),
  })
}