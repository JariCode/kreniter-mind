const API_URL = import.meta.env.VITE_API_URL

let getAuthToken = null

export function setAuthTokenGetter(getToken) {
  getAuthToken = getToken
}

export async function apiRequest(endpoint, options = {}) {
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
    const error = await response.json().catch(() => ({
      error: 'Request failed',
    }))

    throw new Error(
      error.error || `Request failed: ${response.status}`
    )
  }

  return response.json()
}

export async function apiRequestBlob(endpoint, options = {}) {
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
    const error = await response.json().catch(() => ({
      error: 'Request failed',
    }))

    throw new Error(
      error.error || `Request failed: ${response.status}`
    )
  }

  return response.blob()
}