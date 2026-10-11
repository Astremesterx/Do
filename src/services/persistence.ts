import { createJSONStorage } from 'zustand/middleware'

const memory = new Map<string, string>()

// Auto-cleanup helper for oversized legacy keys that caused QuotaExceededError
export function cleanupOversizedStorage() {
  if (typeof window === 'undefined') return
  try {
    const rawEvents = localStorage.getItem('pulse-events-v1')
    if (rawEvents && rawEvents.length > 50000) {
      try {
        const parsed = JSON.parse(rawEvents)
        if (parsed?.state && Array.isArray(parsed.state.events)) {
          parsed.state.events = parsed.state.events.filter(
            (e: { id?: string; provenance?: string; isCustom?: boolean }) =>
              e &&
              !e.id?.startsWith('seed-') &&
              !e.id?.startsWith('online-') &&
              (e.provenance === 'community' || e.isCustom),
          )
          localStorage.setItem('pulse-events-v1', JSON.stringify(parsed))
        } else {
          localStorage.removeItem('pulse-events-v1')
        }
      } catch {
        localStorage.removeItem('pulse-events-v1')
      }
    }
    // Clean up any legacy keys
    localStorage.removeItem('pulse-events-v0')
    localStorage.removeItem('pulse-events-backup')
  } catch {
    /* Ignore quota access restrictions */
  }
}

// Run cleanup immediately on load to recover exhausted browser quotas
if (typeof window !== 'undefined') {
  cleanupOversizedStorage()
}

export const browserStorage = createJSONStorage(() => ({
  getItem(name: string) {
    if (memory.has(name)) return memory.get(name)!
    if (typeof window === 'undefined') return null
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem(name: string, value: string) {
    memory.set(name, value)
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(name, value)
      memory.delete(name)
    } catch (err) {
      // Attempt quota recovery
      cleanupOversizedStorage()
      try {
        localStorage.setItem(name, value)
        memory.delete(name)
      } catch {
        // Gracefully keep in memory fallback without crashing or disrupting the user
        console.debug('[DO Storage] Local storage unavailable, retained in memory:', name, err)
      }
    }
  },
  removeItem(name: string) {
    memory.delete(name)
    if (typeof window === 'undefined') return
    try {
      localStorage.removeItem(name)
    } catch {
      /* In-memory session remains usable. */
    }
  },
}))
