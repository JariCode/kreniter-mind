import {
  apiRequest,
  apiRequestBlob,
} from './api'

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

export function sendMessage(conversationId, content, file = null) {
  return apiRequest(
    `/ai/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({
        content,
        file,
      }),
    }
  )
}

export function transcribeAudio(audio) {
  return apiRequest('/ai/transcribe', {
    method: 'POST',
    body: JSON.stringify({ audio }),
  })
}

export function generateSpeech(text) {
  return apiRequestBlob('/ai/speech', {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}

export function generateImage(prompt) {
  return apiRequest('/ai/image', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
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