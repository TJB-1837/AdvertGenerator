import React, { lazy, Suspense } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { PublicSite } from './pages/PublicSite'
import './styles.css'

const App = lazy(() => import('./App'))
const root = document.getElementById('root')
const path = window.location.pathname.replace(/\/+$/, '') || '/'
// Preserve Supabase callbacks to the existing allowlisted root URL.
const hash = new URLSearchParams(window.location.hash.slice(1))
const query = new URLSearchParams(window.location.search)
const isAuthCallback = ['access_token', 'refresh_token', 'error', 'error_code', 'type'].some(key => hash.has(key)) || ['code', 'error', 'error_code', 'token_hash'].some(key => query.has(key))
const workspace = path === '/app' || (path === '/' && isAuthCallback)
if (workspace) {
  if (path === '/') window.history.replaceState(window.history.state, '', `/app${window.location.search}${window.location.hash}`)
  document.title = 'Your Workspace | Adrafteo'
  const robots = document.querySelector('meta[name="robots"]') || document.head.appendChild(document.createElement('meta'))
  robots.name = 'robots'
  robots.content = 'noindex, follow'
}
const content = workspace
  ? <Suspense fallback={<main className="auth-shell"><p>Loading your workspace...</p></main>}><App /></Suspense>
  : <PublicSite path={path} />

if (!workspace && root.hasChildNodes()) hydrateRoot(root, <React.StrictMode>{content}</React.StrictMode>)
else createRoot(root).render(<React.StrictMode>{content}</React.StrictMode>)
