import { apiRequest } from './api'

export function getTasks() {
  return apiRequest('/tasks')
}

export function getTask(id) {
  return apiRequest(`/tasks/${id}`)
}

export function createTask(task) {
  return apiRequest('/tasks', {
    method: 'POST',
    body: JSON.stringify(task),
  })
}

export function updateTask(id, task) {
  return apiRequest(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(task),
  })
}

export function deleteTask(id) {
  return apiRequest(`/tasks/${id}`, {
    method: 'DELETE',
  })
}