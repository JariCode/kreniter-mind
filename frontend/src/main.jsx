import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'

import './index.css'
import App from './App.jsx'
import clerkAppearance from './clerkAppearance'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ClerkProvider
      appearance={clerkAppearance}
    >
      <App />
    </ClerkProvider>
  </StrictMode>,
)