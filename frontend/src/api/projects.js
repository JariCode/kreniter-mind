import { apiRequest } from './api'

export function getProjects() {
  return apiRequest('/api/projects')
}

export function getProject(id) {
  return apiRequest(`/api/projects/${id}`)
}

export function createProject(project) {
  return apiRequest('/api/projects', {
    method: 'POST',
    body: JSON.stringify(project),
  })
}

export function updateProject(id, project) {
  return apiRequest(`/api/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(project),
  })
}

export function deleteProject(id) {
  return apiRequest(`/api/projects/${id}`, {
    method: 'DELETE',
  })
}