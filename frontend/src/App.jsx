import { useEffect, useState } from 'react'
import { useAuth, useUser } from '@clerk/react'

import LandingPage from './pages/LandingPage/LandingPage'
import Dashboard from './pages/Dashboard/Dashboard'
import { getCurrentUser } from './api/userApi'
import { setAuthTokenGetter } from './api/api'

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

    let cancelled = false

    async function initializeAuth() {
      try {
        setAuthTokenGetter(getToken)

        await getCurrentUser(getToken)

        if (!cancelled) {
          setAuthInitialized(true)
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            'Failed to initialize authentication:',
            error
          )
        }
      }
    }

    initializeAuth()

    return () => {
      cancelled = true
    }
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