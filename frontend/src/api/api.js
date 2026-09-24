const API_URL = import.meta.env.VITE_API_URL

export async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: 'Request failed',
    }))

    throw new Error(error.error || 'Request failed')
  }

  return response.json()
}