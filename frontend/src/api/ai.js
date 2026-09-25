import { apiRequest } from './api'

export function getConversations() {
  return apiRequest('/ai/conversations')
}

export function getConversation(conversationId) {
  return apiRequest(`/ai/conversations/${conversationId}`)
}

export function createConversation(projectId = null) {
  return apiRequest('/ai/conversations', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
  })
}

export function sendMessage(conversationId, content) {
  return apiRequest(
    `/ai/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ content }),
    }
  )
}

export function transcribeAudio(audio) {
  return apiRequest('/ai/transcribe', {
    method: 'POST',
    body: JSON.stringify({ audio }),
  })
}

export function deleteConversation(conversationId) {
  return apiRequest(
    `/ai/conversations/${conversationId}`,
    {
      method: 'DELETE',
    }
  )
}