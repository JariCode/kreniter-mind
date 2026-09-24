import { useState } from 'react'
import LandingPage from './pages/LandingPage/LandingPage'
import Dashboard from './pages/Dashboard/Dashboard'

function App() {
  const [currentPage, setCurrentPage] = useState('landing')

  return (
    <>
      {currentPage === 'landing' && (
        <LandingPage onEnter={() => setCurrentPage('dashboard')} />
      )}

      {currentPage === 'dashboard' && (
        <Dashboard />
      )}
    </>
  )
}

export default App