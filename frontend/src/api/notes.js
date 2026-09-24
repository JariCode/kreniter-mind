import { apiRequest } from './api'

export function getNotes() {
  return apiRequest('/api/notes')
}

export function getNote(id) {
  return apiRequest(`/api/notes/${id}`)
}

export function createNote(note) {
  return apiRequest('/api/notes', {
    method: 'POST',
    body: JSON.stringify(note),
  })
}

export function updateNote(id, note) {
  return apiRequest(`/api/notes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(note),
  })
}

export function deleteNote(id) {
  return apiRequest(`/api/notes/${id}`, {
    method: 'DELETE',
  })
}