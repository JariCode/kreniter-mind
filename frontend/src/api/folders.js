import { apiRequest } from './api'

export function getFolders(projectId = null, parentFolderId = null) {
  const params = new URLSearchParams()

  if (projectId) {
    params.set('projectId', projectId)
  }

  if (parentFolderId) {
    params.set('parentFolderId', parentFolderId)
  }

  const query = params.toString()

  return apiRequest(
    `/folders${query ? `?${query}` : ''}`
  )
}

export function createFolder(
  name,
  projectId = null,
  parentFolderId = null
) {
  return apiRequest('/folders', {
    method: 'POST',
    body: JSON.stringify({
      name,
      projectId,
      parentFolderId,
    }),
  })
}

export function renameFolder(folderId, name) {
  return apiRequest(`/folders/${folderId}`, {
    method: 'PUT',
    body: JSON.stringify({
      name,
    }),
  })
}

export function deleteFolder(folderId) {
  return apiRequest(`/folders/${folderId}`, {
    method: 'DELETE',
  })
}