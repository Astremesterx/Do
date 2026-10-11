import React from 'react'
import ReactDOM from 'react-dom/client'
import './services/uuid'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useCommunityStore } from './communityStore'
import 'leaflet/dist/leaflet.css'
import './styles.css'

const appearance = useCommunityStore.getState().theme
const dark =
  appearance === 'dark' ||
  (appearance === 'system' && matchMedia('(prefers-color-scheme:dark)').matches)
document.documentElement.dataset.theme = dark ? 'dark' : 'light'
document.documentElement.style.colorScheme = dark ? 'dark' : 'light'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const registerOffline = () => {
    void navigator.serviceWorker
      .register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(() => console.info('[DO] Offline cache ready.'))
      .catch((error: unknown) => console.warn('[DO] Offline cache unavailable.', error))
  }
  if (document.readyState === 'complete') registerOffline()
  else window.addEventListener('load', registerOffline, { once: true })
}
