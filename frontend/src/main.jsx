import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'
import { applyTheme, THEME_KEYS, DEFAULT_THEME, STORAGE_KEY } from './theme/themes'

// Apply the saved theme before React paints to avoid a flash of the default.
try {
  const saved = localStorage.getItem(STORAGE_KEY)
  applyTheme(THEME_KEYS.includes(saved) ? saved : DEFAULT_THEME)
} catch {
  applyTheme(DEFAULT_THEME)
}

// Keep the branded splash (index.html) up for 3 seconds on the first open of a
// browser session, then fade it out. Later loads in the session aren't held back.
const SPLASH_MS = 3000
let wait = 0
try {
  if (!sessionStorage.getItem('cs-splash-seen')) {
    wait = Math.max(0, SPLASH_MS - performance.now())
    sessionStorage.setItem('cs-splash-seen', '1')
  }
} catch { /* storage blocked: don't wait */ }

function mount() {
  const splash = document.getElementById('cs-splash')
  const render = () => ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
  if (!splash || !wait) { render(); return }
  splash.style.transition = 'opacity 300ms ease'
  splash.style.opacity = '0'
  setTimeout(render, 300)
}
setTimeout(mount, wait)

// Installable app: register the service worker in production builds only
// (in dev it would cache Vite's modules and fight hot reload).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
