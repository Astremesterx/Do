import { describe, it, expect, beforeEach } from 'vitest'
import { isUserAdmin, useCommunityStore } from '../communityStore'

describe('Admin Access & Site Maintenance Security', () => {
  beforeEach(() => {
    useCommunityStore.getState().setAdminStatus(false)
  })

  it('rejects regular users from admin privileges', () => {
    expect(isUserAdmin('john.doe@example.com')).toBe(false)
    expect(isUserAdmin('alex@gmail.com')).toBe(false)
    expect(isUserAdmin('guest')).toBe(false)
    expect(isUserAdmin(undefined)).toBe(false)
  })

  it('grants admin privileges to designated admin and owner accounts', () => {
    expect(isUserAdmin('admin@do.com')).toBe(true)
    expect(isUserAdmin('salif@do.com')).toBe(true)
    expect(isUserAdmin('salif.admin@gmail.com')).toBe(true)
    expect(isUserAdmin('user@example.com', { role: 'admin' })).toBe(true)
  })

  it('verifies admin maintenance passphrases correctly', () => {
    const store = useCommunityStore.getState()
    expect(store.isAdmin).toBe(false)

    // Wrong passphrase fails
    const failRes = store.verifyAdminPassphrase('wrong-passphrase')
    expect(failRes).toBe(false)
    expect(useCommunityStore.getState().isAdmin).toBe(false)

    // Correct maintenance passphrase succeeds
    const okRes = store.verifyAdminPassphrase('do-admin-2026')
    expect(okRes).toBe(true)
    expect(useCommunityStore.getState().isAdmin).toBe(true)
  })

  it('allows site administrator to lock admin mode', () => {
    const store = useCommunityStore.getState()
    store.setAdminStatus(true)
    expect(useCommunityStore.getState().isAdmin).toBe(true)

    store.setAdminStatus(false)
    expect(useCommunityStore.getState().isAdmin).toBe(false)
  })
})
