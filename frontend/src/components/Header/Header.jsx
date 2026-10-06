import { UserButton, useUser } from '@clerk/react'
import clerkAppearance from '../../clerkAppearance'
import './Header.css'

function Header() {
  const { user } = useUser()
  const greeting = user?.firstName
    ? `Welcome back, ${user.firstName}`
    : 'Welcome back'

  return (
    <header className="header">
      <div className="header-title">
        <p>{greeting}</p>
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