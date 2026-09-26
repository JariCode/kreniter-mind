import {
  apiRequest,
  apiRequestBlob,
} from './api'

export function getFiles(
  projectId = null,
  folderId = null
) {
  const params = new URLSearchParams()

  if (projectId) {
    params.set('projectId', projectId)
  }

  if (folderId) {
    params.set('folderId', folderId)
  }

  const query = params.toString()

  return apiRequest(
    `/files${query ? `?${query}` : ''}`
  )
}

export function uploadFile(
  file,
  projectId = null,
  folderId = null
) {
  const formData = new FormData()

  formData.append('file', file)

  if (projectId) {
    formData.append('projectId', projectId)
  }

  if (folderId) {
    formData.append('folderId', folderId)
  }

  return apiRequest('/files', {
    method: 'POST',
    body: formData,
  })
}

export function downloadFile(fileId) {
  return apiRequestBlob(
    `/files/${fileId}/download`
  )
}

export function updateFileContent(
  fileId,
  file
) {
  const formData = new FormData()

  formData.append('file', file)

  return apiRequest(`/files/${fileId}/content`, {
    method: 'PUT',
    body: formData,
  })
}

export function updateFile(
  fileId,
  data
) {
  return apiRequest(`/files/${fileId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteFile(fileId) {
  return apiRequest(`/files/${fileId}`, {
    method: 'DELETE',
  })
}