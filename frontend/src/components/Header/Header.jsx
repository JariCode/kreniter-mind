import './Header.css'

function Header() {
  return (
    <header className="header">
      <div className="header-title">
        <h1>Dashboard</h1>
        <p>Welcome back</p>
      </div>

      <div className="header-actions">
        <button className="header-search">
          Search
        </button>

        <div className="header-user">
          User
        </div>
      </div>
    </header>
  )
}

export default Header