import { useSync } from '~/composables/useSync'

export default defineNuxtPlugin(() => {
  if (!('serviceWorker' in navigator)) return

  const sync = useSync()

  // ─── Register Service Worker ────────────────────────────────────────────────
  navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((registration) => {
      console.log('[SW] Registered, scope:', registration.scope)
    })
    .catch((err) => {
      console.warn('[SW] Registration failed:', err)
    })

  // ─── Listen for SW messages (e.g., TRIGGER_DELTA_SYNC from background sync) ─
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'TRIGGER_DELTA_SYNC') {
      sync.deltaSync().catch(console.error)
    }
  })

  // ─── Online event → flush pending commands ──────────────────────────────────
  window.addEventListener('online', () => {
    sync.flushQueue().catch(console.error)
  })

  // ─── Delta sync every 24 hours ──────────────────────────────────────────────
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000
  setInterval(() => {
    if (navigator.onLine) {
      sync.deltaSync().catch(console.error)
    }
  }, TWENTY_FOUR_HOURS)
})
