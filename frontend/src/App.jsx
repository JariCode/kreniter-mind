import { useUser } from '@clerk/react'
import LandingPage from './pages/LandingPage/LandingPage'
import Dashboard from './pages/Dashboard/Dashboard'

function App() {
  const { isLoaded, isSignedIn } = useUser()

  if (!isLoaded) {
    return null
  }

  if (!isSignedIn) {
    return <LandingPage />
  }

  return <Dashboard />
}

export default App