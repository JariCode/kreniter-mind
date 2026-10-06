import { apiRequest } from './api'

export async function getDashboardLayout() {
  return apiRequest('/dashboard-layout')
}

export async function saveDashboardLayout(widgets) {
  return apiRequest('/dashboard-layout', {
    method: 'PUT',
    body: JSON.stringify({
      widgets,
    }),
  })
}