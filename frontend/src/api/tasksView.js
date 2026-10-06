import { apiRequest } from './api'

export function getTasksView() {
  return apiRequest('/tasks-view')
}

export function saveTasksView(selectedProjectId) {
  return apiRequest('/tasks-view', {
    method: 'PUT',
    body: JSON.stringify({ selectedProjectId }),
  })
}