import { apiRequest } from './api'

export function getTasks() {
  return apiRequest('/api/tasks')
}

export function getTask(id) {
  return apiRequest(`/api/tasks/${id}`)
}

export function createTask(task) {
  return apiRequest('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(task),
  })
}

export function updateTask(id, task) {
  return apiRequest(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(task),
  })
}

export function deleteTask(id) {
  return apiRequest(`/api/tasks/${id}`, {
    method: 'DELETE',
  })
}