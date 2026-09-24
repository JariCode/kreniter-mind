import { apiRequest } from './api'

export async function getCurrentUser(getToken) {
  const token = await getToken()

  return apiRequest('/users/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}