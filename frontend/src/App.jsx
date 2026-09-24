import { useEffect, useState } from 'react'
import { useAuth, useUser } from '@clerk/react'

import LandingPage from './pages/LandingPage/LandingPage'
import Dashboard from './pages/Dashboard/Dashboard'
import { getCurrentUser } from './api/userApi'
import { setAuthToken } from './api/api'

function App() {
  const { isLoaded, isSignedIn } = useUser()
  const { getToken } = useAuth()

  const [authInitialized, setAuthInitialized] = useState(false)

  useEffect(() => {
    if (!isLoaded) {
      return
    }

    if (!isSignedIn) {
      setAuthInitialized(false)
      return
    }

    async function initializeAuth() {
      try {
        const token = await getToken()

        setAuthToken(token)

        const data = await getCurrentUser(getToken)

        console.log('Current user:', data.user)

        setAuthInitialized(true)
      } catch (error) {
        console.error('Failed to initialize authentication:', error)
      }
    }

    initializeAuth()
  }, [isLoaded, isSignedIn, getToken])

  if (!isLoaded) {
    return null
  }

  if (!isSignedIn) {
    return <LandingPage />
  }

  if (!authInitialized) {
    return null
  }

  return <Dashboard />
}

export default App