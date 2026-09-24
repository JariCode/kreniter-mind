import { apiRequest } from './api'

export function getNotes() {
  return apiRequest('/notes')
}

export function getNote(id) {
  return apiRequest(`/notes/${id}`)
}

export function createNote(note) {
  return apiRequest('/notes', {
    method: 'POST',
    body: JSON.stringify(note),
  })
}

export function updateNote(id, note) {
  return apiRequest(`/notes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(note),
  })
}

export function deleteNote(id) {
  return apiRequest(`/notes/${id}`, {
    method: 'DELETE',
  })
}