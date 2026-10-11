import { createJSONStorage } from 'zustand/middleware'

const memory = new Map<string, string>()
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
    } catch {
      window.dispatchEvent(new CustomEvent('do-storage-warning'))
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
