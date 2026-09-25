import { useClerk } from '@clerk/react'
import './LandingPage.css'

function LandingPage({ onEnter }) {
  const { openSignIn } = useClerk()

  function handleEnter() {
    openSignIn({
      fallbackRedirectUrl: '/',
    })
  }

  return (
    <main className="landing-page">
      <div className="landing-content">

        <h1 className="landing-title">
          KRENITER MIND
        </h1>

        <p className="landing-subtitle">
          VISUAL AI WORKSPACE
        </p>

        <div className="entity-container">
          <div className="k-entity">
            <div className="k-entity-line k-entity-line-one" />
            <div className="k-entity-line k-entity-line-two" />

            <div className="k-entity-core">
              K
            </div>
          </div>
        </div>

        <p className="landing-description">
          Beyond notes. Map your mind with AI.
        </p>

        <button
          className="landing-button"
          onClick={handleEnter}
        >
          ENTER WORKSPACE
        </button>

      </div>
    </main>
  )
}

export default LandingPage