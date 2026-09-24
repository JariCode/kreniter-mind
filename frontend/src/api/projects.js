import { apiRequest } from './api'

export function getProjects() {
  return apiRequest('/projects')
}

export function getProject(id) {
  return apiRequest(`/projects/${id}`)
}

export function createProject(project) {
  return apiRequest('/projects', {
    method: 'POST',
    body: JSON.stringify(project),
  })
}

export function updateProject(id, project) {
  return apiRequest(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(project),
  })
}

export function deleteProject(id) {
  return apiRequest(`/projects/${id}`, {
    method: 'DELETE',
  })
}