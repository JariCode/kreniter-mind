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
          <svg
            className="k-entity"
            viewBox="0 0 400 400"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>

              <radialGradient id="entityCore">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="25%" stopColor="#8fd0ff" />
                <stop offset="60%" stopColor="#1688ff" />
                <stop offset="100%" stopColor="#064a91" />
              </radialGradient>

              <linearGradient
                id="entityBlue"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#8fd0ff" />
                <stop offset="45%" stopColor="#1688ff" />
                <stop offset="100%" stopColor="#0753a6" />
              </linearGradient>

              <filter id="entityBlur">
                <feGaussianBlur stdDeviation="12" />
              </filter>

              <filter id="entityGlow">
                <feGaussianBlur stdDeviation="4" />
              </filter>

            </defs>

            {/* Ambient energy */}

            <circle
              className="entity-ambient"
              cx="200"
              cy="200"
              r="125"
              filter="url(#entityBlur)"
            />

            {/* Outer structure */}

            <path
              className="entity-line entity-line-one"
              d="
                M 200 58
                C 150 70, 108 105, 82 148
                C 58 188, 68 236, 102 270
                C 132 301, 169 320, 200 337
              "
            />

            <path
              className="entity-line entity-line-two"
              d="
                M 200 58
                C 248 70, 292 105, 318 148
                C 342 188, 332 236, 298 270
                C 268 301, 231 320, 200 337
              "
            />

            {/* K */}

            <path
              className="entity-k"
              d="
                M 145 135
                L 145 265

                M 145 200
                L 255 135

                M 145 200
                L 255 265
              "
            />

            {/* Core */}

            <circle
              className="entity-core-glow"
              cx="200"
              cy="200"
              r="30"
              filter="url(#entityBlur)"
            />

            <circle
              className="entity-core"
              cx="200"
              cy="200"
              r="10"
              fill="url(#entityCore)"
              filter="url(#entityGlow)"
            />

            {/* Floating fragments */}

            <circle
              className="entity-fragment fragment-one"
              cx="110"
              cy="105"
              r="2"
            />

            <circle
              className="entity-fragment fragment-two"
              cx="290"
              cy="105"
              r="2"
            />

            <circle
              className="entity-fragment fragment-three"
              cx="92"
              cy="255"
              r="1.5"
            />

            <circle
              className="entity-fragment fragment-four"
              cx="308"
              cy="255"
              r="1.5"
            />

          </svg>
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