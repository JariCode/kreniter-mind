import { useEffect, useState } from 'react'
import Sidebar from '../../components/Sidebar/Sidebar'
import Header from '../../components/Header/Header'
import MainContent from '../../components/MainContent/MainContent'
import './Dashboard.css'

function Dashboard() {
  const [activeView, setActiveView] = useState(() => {
    return window.history.state?.activeView || 'dashboard'
  })

  useEffect(() => {
    window.history.replaceState(
      {
        ...window.history.state,
        activeView,
      },
      ''
    )
  }, [activeView])

  function handleViewChange(view) {
    window.history.replaceState(
      {
        ...window.history.state,
        activeView: view,
      },
      ''
    )

    setActiveView(view)
  }

  return (
    <div className="dashboard">
      <Sidebar
        activeView={activeView}
        onViewChange={handleViewChange}
      />

      <div className="dashboard-main">
        <Header activeView={activeView} />
        <MainContent
          activeView={activeView}
          onViewChange={handleViewChange}
        />
      </div>
    </div>
  )
}

export default Dashboard