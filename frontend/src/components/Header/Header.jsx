import { UserButton } from '@clerk/react'
import './Header.css'

function Header() {
  return (
    <header className="header">
      <div className="header-title">
        <h1>Dashboard</h1>
        <p>Welcome back</p>
      </div>

      <div className="header-actions">
        <div className="header-user">
          <UserButton />
        </div>
      </div>
    </header>
  )
}

export default Header