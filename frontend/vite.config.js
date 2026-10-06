import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Content-Security-Policy for the local preview.
// Deployment addresses come from environment variables.
function contentSecurityPolicy(apiOrigins, clerkOrigin) {
  return [
    "default-src 'self'",
    `script-src 'self' https://*.clerk.accounts.dev ${clerkOrigin} https://challenges.cloudflare.com`,
    `connect-src 'self' ${apiOrigins} https://*.clerk.accounts.dev ${clerkOrigin}`,
    "img-src 'self' data: blob: https://img.clerk.com",
    "media-src 'self' blob:",
    "frame-src 'self' blob: https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

// https://vite.dev/config/
export default defineConfig(({ command, mode, isPreview }) => {
  const env = loadEnv(mode, '.', '')
  const basePath = env.VITE_BASE_PATH || '/'
  const apiOrigin = env.VITE_API_URL ? new URL(env.VITE_API_URL).origin : ''
  const clerkOrigin = env.VITE_CLERK_PRODUCTION_URL || ''

  return {
    plugins: [react()],
    // The dev server (npm run dev) stays at the root for local development and tests.
    base: command === 'build' || isPreview ? basePath : '/',
    preview: {
      headers: {
        'Content-Security-Policy': contentSecurityPolicy(
          `http://localhost:5000 ${apiOrigin}`,
          clerkOrigin
        ),
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy':
          'camera=(), microphone=(self), geolocation=(), payment=(), usb=()',
      },
    },
  }
})