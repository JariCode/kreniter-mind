import { UserButton } from '@clerk/react'
import clerkAppearance from '../../clerkAppearance'
import './Header.css'

function Header({ activeView }) {
  const viewTitles = {
    dashboard: 'Dashboard',
    projects: 'Projects',
    tasks: 'Tasks',
    notes: 'Notes',
    timeline: 'Timeline',
    time: 'Time',
    files: 'Files',
    reports: 'Reports',
    'ai-assistant': 'AI Assistant',
    'coding-ai': 'Coding AI',
    settings: 'Settings',
  }

  const viewTitle = viewTitles[activeView] || 'Dashboard'

  return (
    <header className="header">
      <div className="header-title">
        <h1>{viewTitle}</h1>
        <p>Welcome back</p>
      </div>

      <div className="header-actions">
        <div className="header-user">
          <UserButton
            appearance={clerkAppearance}
            userProfileProps={{
              appearance: clerkAppearance,
            }}
          />
        </div>
      </div>
    </header>
  )
}

export default Header