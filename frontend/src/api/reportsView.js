import { apiRequest } from './api'

export function getReportsView() {
  return apiRequest('/reports-view')
}

export function saveReportsView(
  selectedProjectId
) {
  return apiRequest('/reports-view', {
    method: 'PUT',
    body: JSON.stringify({
      selectedProjectId,
    }),
  })
}