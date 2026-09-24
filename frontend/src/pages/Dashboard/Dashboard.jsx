import Sidebar from '../../components/Sidebar/Sidebar'
import Header from '../../components/Header/Header'
import MainContent from '../../components/MainContent/MainContent'
import './Dashboard.css'

function Dashboard() {
  return (
    <div className="dashboard">
      <Sidebar />

      <div className="dashboard-main">
        <Header />
        <MainContent />
      </div>
    </div>
  )
}

export default Dashboard