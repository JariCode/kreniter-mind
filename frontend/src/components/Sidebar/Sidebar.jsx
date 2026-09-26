import { useEffect, useState } from 'react'
import './Sidebar.css'

function Sidebar({ activeView, onViewChange }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setMobileOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  function handleViewChange(view) {
    onViewChange(view)
    setMobileOpen(false)
  }

  return (
    <>
      <button
        className="sidebar-mobile-toggle"
        type="button"
        onClick={() => setMobileOpen((current) => !current)}
        aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={mobileOpen}
      >
        <span />
        <span />
        <span />
      </button>

      {mobileOpen && (
        <button
          className="sidebar-mobile-overlay"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-logo">
          KRENITER MIND
        </div>

        <nav className="sidebar-nav">
          <button
            className={`sidebar-item ${
              activeView === 'dashboard' ? 'active' : ''
            }`}
            onClick={() => handleViewChange('dashboard')}
          >
            Dashboard
          </button>

          <button
            className={`sidebar-item ${
              activeView === 'projects' ? 'active' : ''
            }`}
            onClick={() => handleViewChange('projects')}
          >
            Projects
          </button>

          <button
            className={`sidebar-item ${
              activeView === 'tasks' ? 'active' : ''
            }`}
            onClick={() => handleViewChange('tasks')}
          >
            Tasks
          </button>

          <button
            className={`sidebar-item ${
              activeView === 'notes' ? 'active' : ''
            }`}
            onClick={() => handleViewChange('notes')}
          >
            Notes
          </button>

          <button
            className={`sidebar-item ${
              activeView === 'timeline' ? 'active' : ''
            }`}
            onClick={() => handleViewChange('timeline')}
          >
            Timeline
          </button>

          <button
            className={`sidebar-item ${
              activeView === 'time' ? 'active' : ''
            }`}
            onClick={() => handleViewChange('time')}
          >
            Time
          </button>

          <button
            className={`sidebar-item ${
              activeView === 'files' ? 'active' : ''
            }`}
            onClick={() => handleViewChange('files')}
          >
            Files
          </button>

          <button
            className={`sidebar-item ${
              activeView === 'reports' ? 'active' : ''
            }`}
            onClick={() => handleViewChange('reports')}
          >
            Reports
          </button>
        </nav>

        <div className="sidebar-section">
          <button
            className={`sidebar-item ${
              activeView === 'ai-assistant' ? 'active' : ''
            }`}
            onClick={() => handleViewChange('ai-assistant')}
          >
            AI Assistant
          </button>

          <button
            className={`sidebar-item ${
              activeView === 'coding-ai' ? 'active' : ''
            }`}
            onClick={() => handleViewChange('coding-ai')}
          >
            Coding AI
          </button>
        </div>

        <div className="sidebar-bottom">
          <button
            className={`sidebar-item ${
              activeView === 'settings' ? 'active' : ''
            }`}
            onClick={() => handleViewChange('settings')}
          >
            Settings
          </button>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
