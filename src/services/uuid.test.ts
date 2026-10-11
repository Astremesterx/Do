import { describe, expect, it } from 'vitest'
import { generateUUID } from './uuid'

describe('generateUUID', () => {
  it('generates a valid RFC 4122 v4 UUID format', () => {
    const id = generateUUID()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it('generates unique UUIDs sequentially', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      ids.add(generateUUID())
    }
    expect(ids.size).toBe(100)
  })

  it('falls back seamlessly when crypto.randomUUID is not a function', () => {
    const original = globalThis.crypto?.randomUUID
    try {
      if (globalThis.crypto) {
        // Force randomUUID to be undefined to simulate insecure context
        // @ts-expect-error simulating missing randomUUID in insecure context
        globalThis.crypto.randomUUID = undefined
      }
      const id = generateUUID()
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    } finally {
      if (globalThis.crypto && original) {
        globalThis.crypto.randomUUID = original
      }
    }
  })
})
