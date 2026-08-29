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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)