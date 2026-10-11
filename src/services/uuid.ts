/**
 * Universal RFC 4122 v4 UUID generator.
 *
 * Works in:
 * - Secure contexts (window.crypto.randomUUID)
 * - Insecure contexts (e.g. non-localhost HTTP LAN dev: http://192.168.x.x)
 * - Embedded webviews and older browser engines
 * - Node / Vitest test environments
 */
export function generateUUID(): string {
  // 1. Try native crypto.randomUUID
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID()
    } catch {
      // Fall through to fallback
    }
  }

  // 2. Try crypto.getRandomValues
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    try {
      const bytes = new Uint8Array(16)
      crypto.getRandomValues(bytes)
      bytes[6] = (bytes[6] & 0x0f) | 0x40 // Version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80 // Variant 10xx
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    } catch {
      // Fall through to Math.random
    }
  }

  // 3. RFC 4122 v4 using Math.random
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Automatically install a global polyfill for crypto.randomUUID if missing
if (typeof globalThis !== 'undefined') {
  try {
    if (!globalThis.crypto) {
      (globalThis as unknown as { crypto: Partial<Crypto> }).crypto = {} as Crypto
    }
    if (typeof globalThis.crypto.randomUUID !== 'function') {
      globalThis.crypto.randomUUID = generateUUID as () => `${string}-${string}-${string}-${string}-${string}`
    }
  } catch {
    // Read-only in some strict sandboxes; handled by direct generateUUID calls
  }
}
