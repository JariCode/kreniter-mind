import { useState } from 'react'
import Sidebar from '../../components/Sidebar/Sidebar'
import Header from '../../components/Header/Header'
import MainContent from '../../components/MainContent/MainContent'
import './Dashboard.css'

function Dashboard() {
  const [activeView, setActiveView] = useState('dashboard')

  return (
    <div className="dashboard">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
      />

      <div className="dashboard-main">
        <Header activeView={activeView} />
        <MainContent
          activeView={activeView}
          onViewChange={setActiveView}
        />
      </div>
    </div>
  )
}

export default Dashboard