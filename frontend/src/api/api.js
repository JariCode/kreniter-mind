const API_URL = import.meta.env.VITE_API_URL

let getAuthToken = null

export function setAuthTokenGetter(getToken) {
  getAuthToken = getToken
}

async function fetchApiResponse(endpoint, options = {}) {
  const token = getAuthToken ? await getAuthToken() : null

  const headers = new Headers(options.headers)

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({
      error: 'Request failed',
    }))

    const error = new Error(
      data.error || `Request failed: ${response.status}`
    )

    // Extra fields for callers that need more than the message, e.g. a 409
    // conflict body. Existing callers only read .message, so this is additive.
    error.status = response.status
    error.data = data

    throw error
  }

  return response
}

export async function apiRequest(endpoint, options = {}) {
  const response = await fetchApiResponse(endpoint, options)

  return response.json()
}

export async function apiRequestBlob(endpoint, options = {}) {
  const response = await fetchApiResponse(endpoint, options)

  return response.blob()
}