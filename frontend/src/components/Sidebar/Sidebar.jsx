import './Sidebar.css'

function Sidebar({ activeView, onViewChange }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        KRENITER MIND
      </div>

      <nav className="sidebar-nav">
        <button
          className={`sidebar-item ${
            activeView === 'dashboard' ? 'active' : ''
          }`}
          onClick={() => onViewChange('dashboard')}
        >
          Dashboard
        </button>

        <button
          className={`sidebar-item ${
            activeView === 'projects' ? 'active' : ''
          }`}
          onClick={() => onViewChange('projects')}
        >
          Projects
        </button>

        <button
          className={`sidebar-item ${
            activeView === 'tasks' ? 'active' : ''
          }`}
          onClick={() => onViewChange('tasks')}
        >
          Tasks
        </button>

        <button
          className={`sidebar-item ${
            activeView === 'notes' ? 'active' : ''
          }`}
          onClick={() => onViewChange('notes')}
        >
          Notes
        </button>

        <button
          className={`sidebar-item ${
            activeView === 'timeline' ? 'active' : ''
          }`}
          onClick={() => onViewChange('timeline')}
        >
          Timeline
        </button>

        <button
          className={`sidebar-item ${
            activeView === 'time' ? 'active' : ''
          }`}
          onClick={() => onViewChange('time')}
        >
          Time
        </button>

        <button
          className={`sidebar-item ${
            activeView === 'files' ? 'active' : ''
          }`}
          onClick={() => onViewChange('files')}
        >
          Files
        </button>

        <button
          className={`sidebar-item ${
            activeView === 'reports' ? 'active' : ''
          }`}
          onClick={() => onViewChange('reports')}
        >
          Reports
        </button>
      </nav>

      <div className="sidebar-section">
        <button
          className={`sidebar-item ${
            activeView === 'ai-assistant' ? 'active' : ''
          }`}
          onClick={() => onViewChange('ai-assistant')}
        >
          AI Assistant
        </button>

        <button
          className={`sidebar-item ${
            activeView === 'coding-ai' ? 'active' : ''
          }`}
          onClick={() => onViewChange('coding-ai')}
        >
          Coding AI
        </button>
      </div>

      <div className="sidebar-bottom">
        <button
          className={`sidebar-item ${
            activeView === 'settings' ? 'active' : ''
          }`}
          onClick={() => onViewChange('settings')}
        >
          Settings
        </button>
      </div>
    </aside>
  )
}

export default Sidebar