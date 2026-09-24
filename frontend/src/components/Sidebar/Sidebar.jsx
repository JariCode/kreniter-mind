import './Sidebar.css'

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        KRENITER MIND
      </div>

      <nav className="sidebar-nav">
        <button className="sidebar-item active">
          Dashboard
        </button>

        <button className="sidebar-item">
          Projects
        </button>

        <button className="sidebar-item">
          Tasks
        </button>

        <button className="sidebar-item">
          Notes
        </button>

        <button className="sidebar-item">
          Timeline
        </button>

        <button className="sidebar-item">
          Time
        </button>

        <button className="sidebar-item">
          Files
        </button>

        <button className="sidebar-item">
          Reports
        </button>
      </nav>

      <div className="sidebar-section">
        <button className="sidebar-item">
          AI Assistant
        </button>

        <button className="sidebar-item">
          Coding AI
        </button>
      </div>

      <div className="sidebar-bottom">
        <button className="sidebar-item">
          Settings
        </button>
      </div>
    </aside>
  )
}

export default Sidebar