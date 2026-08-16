import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { useAppStore } from './store/useAppStore'

if (import.meta.env.DEV) {
  ;(window as unknown as { __store?: typeof useAppStore }).__store = useAppStore
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
