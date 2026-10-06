import { apiRequest } from './api'

export function getTimeView() {
  return apiRequest('/time-view')
}

export function saveTimeView(selectedProjectId) {
  return apiRequest('/time-view', {
    method: 'PUT',
    body: JSON.stringify({ selectedProjectId }),
  })
}