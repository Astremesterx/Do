import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authService } from './supabase/authService'
import * as clientModule from './supabase/client'

describe('authService validation and security tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects registration with invalid email format', async () => {
    const res = await authService.signUp({
      email: 'notanemail',
      password: 'StrongPassword123!',
      name: 'Salif Explorer',
      handle: 'salif',
    })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('valid email')
  })

  it('enforces password minimum length of 8 characters', async () => {
    const res = await authService.signUp({
      email: 'test@example.com',
      password: 'short',
      name: 'Salif Explorer',
      handle: 'salif',
    })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('at least 8 characters')
  })

  it('rejects registration with an empty or 1-character display name', async () => {
    const res = await authService.signUp({
      email: 'test@example.com',
      password: 'StrongPassword123!',
      name: 'S',
      handle: 'salif',
    })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('display name')
  })

  it('rejects registration with invalid handle', async () => {
    const res = await authService.signUp({
      email: 'test@example.com',
      password: 'StrongPassword123!',
      name: 'Salif Explorer',
      handle: '',
    })
    expect(res.ok).toBe(false)
    expect(res.error).toContain('valid handle')
  })

  it('rejects sign-in when email or password is empty', async () => {
    const res1 = await authService.signIn({ email: '', password: 'password123' })
    expect(res1.ok).toBe(false)
    expect(res1.error).toContain('provide both email and password')

    const res2 = await authService.signIn({ email: 'test@example.com', password: '' })
    expect(res2.ok).toBe(false)
    expect(res2.error).toContain('provide both email and password')
  })

  it('performs signUp through Supabase auth client and creates profile', async () => {
    const mockUser = { id: 'user-uuid-1234', email: 'salif@example.com' }
    const mockSupabase = {
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }
    vi.spyOn(clientModule, 'getSupabaseClient').mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof clientModule.getSupabaseClient>,
    )

    const res = await authService.signUp({
      email: 'salif@example.com',
      password: 'SuperSecurePassword2026',
      name: 'Salif',
      handle: 'salifdo',
      city: 'bangalore',
      interests: ['tech', 'music'],
    })

    expect(res.ok).toBe(true)
    expect(res.user?.id).toBe('user-uuid-1234')
    expect(res.profile?.name).toBe('Salif')
    expect(res.profile?.handle).toBe('@salifdo')
    expect(res.profile?.interests).toEqual(['tech', 'music'])
  })

  it('performs signIn through Supabase auth client and retrieves profile', async () => {
    const mockUser = {
      id: 'user-uuid-5678',
      email: 'member@example.com',
      user_metadata: { name: 'Member DO', handle: '@member' },
    }
    const mockSupabase = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'user-uuid-5678',
              name: 'Member DO',
              handle: '@member',
              bio: 'Bio',
              city: 'bangalore',
              trust_score: 200,
              interests: ['food', 'arts'],
              is_guest: false,
            },
          ],
          error: null,
        }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      }),
    }
    vi.spyOn(clientModule, 'getSupabaseClient').mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof clientModule.getSupabaseClient>,
    )

    const res = await authService.signIn({
      email: 'member@example.com',
      password: 'ValidPassword123',
    })

    expect(res.ok).toBe(true)
    expect(res.user?.id).toBe('user-uuid-5678')
    expect(res.profile?.handle).toBe('@member')
    expect(res.profile?.interests).toEqual(['food', 'arts'])
  })

  it('signs out gracefully', async () => {
    const mockSupabase = {
      auth: {
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    }
    vi.spyOn(clientModule, 'getSupabaseClient').mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof clientModule.getSupabaseClient>,
    )

    const res = await authService.signOut()
    expect(res.ok).toBe(true)
    expect(mockSupabase.auth.signOut).toHaveBeenCalled()
  })
})
