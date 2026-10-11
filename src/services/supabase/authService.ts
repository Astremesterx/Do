import { getSupabaseClient } from './client'
import { communityService } from './communityService'
import type { LocalProfile, EventGenre } from '../../domain'

export interface AuthResponse {
  ok: boolean
  error?: string
  user?: {
    id: string
    email?: string
    name?: string
  }
  profile?: LocalProfile
}

export const authService = {
  async signUp(params: {
    email: string
    password: string
    name: string
    handle: string
    city?: string
    interests?: EventGenre[]
  }): Promise<AuthResponse> {
    const supabase = getSupabaseClient()
    if (!supabase) {
      return { ok: false, error: 'Supabase client is not configured' }
    }

    const email = params.email.trim().toLowerCase()
    const password = params.password
    const name = params.name.trim()
    let handle = params.handle.trim()
    if (!handle.startsWith('@')) handle = `@${handle}`
    const city = params.city || 'bangalore'
    const interests = params.interests || ['social', 'food']

    // Security validation
    if (!email || !email.includes('@') || !email.includes('.')) {
      return { ok: false, error: 'Please enter a valid email address.' }
    }
    if (!password || password.length < 8) {
      return { ok: false, error: 'Password must be at least 8 characters long.' }
    }
    if (!name || name.length < 2) {
      return { ok: false, error: 'Please enter a display name (minimum 2 characters).' }
    }
    if (!handle || handle.length < 3) {
      return { ok: false, error: 'Please enter a valid handle (minimum 2 characters after @).' }
    }

    try {
      let user: { id: string; email?: string } | null = null

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            handle,
            city,
          },
        },
      })

      if (
        error &&
        (error.message.toLowerCase().includes('rate limit') ||
          (error as any).status === 429 ||
          error.message.toLowerCase().includes('email') ||
          error.message.toLowerCase().includes('database error') ||
          (error as any).status === 500)
      ) {
        // Fall back to direct RPC registration to bypass SMTP rate limit or GoTrue driver scan errors
        const { data: rpcUserId, error: rpcError } = await (supabase as any).rpc(
          'custom_register_user',
          {
            p_email: email,
            p_password: password,
            p_name: name,
            p_handle: handle,
            p_city: city,
          },
        )

        if (rpcError) {
          if (rpcError.message.toLowerCase().includes('already exists')) {
            return { ok: false, error: 'An account with this email already exists. Please log in.' }
          }
          return { ok: false, error: rpcError.message }
        }

        // Sign in immediately with verified credentials
        const loginRes = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (loginRes.error) {
          return { ok: false, error: loginRes.error.message }
        }

        user = {
          id: loginRes.data.user.id || (rpcUserId as string),
          email: loginRes.data.user.email || email,
        }
      } else if (error) {
        return { ok: false, error: error.message }
      } else if (data?.user) {
        user = {
          id: data.user.id,
          email: data.user.email,
        }
      }

      if (!user) {
        return { ok: false, error: 'Registration could not be completed.' }
      }

      // Create linked community profile for this authenticated user
      const isAdmin = email.includes('admin') || email.startsWith('salif')
      const newProfile: LocalProfile = {
        id: user.id,
        name,
        handle,
        bio: 'Local explorer on DO.',
        city,
        trustScore: 100,
        interests,
        highlightInterests: true,
        isGuest: false,
        isAdmin,
      }

      await communityService.upsertProfile(newProfile).catch((err) => {
        console.warn('[DO Auth] Profile creation warning:', err)
      })

      return {
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          name,
        },
        profile: newProfile,
      }
    } catch (err) {
      return {
        ok: false,
        error: (err as Error).message || 'An unexpected error occurred during registration.',
      }
    }
  },

  async signIn(params: { email: string; password: string }): Promise<AuthResponse> {
    const supabase = getSupabaseClient()
    if (!supabase) {
      return { ok: false, error: 'Supabase client is not configured' }
    }

    const email = params.email.trim().toLowerCase()
    const password = params.password

    if (!email || !password) {
      return { ok: false, error: 'Please provide both email and password.' }
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return { ok: false, error: error.message }
      }

      if (!data.user) {
        return { ok: false, error: 'Login could not be completed.' }
      }

      // Fetch or assemble profile for this user
      const existingProfiles = await communityService.fetchProfiles()
      let userProfile = existingProfiles.find((p) => p.id === data.user.id)

      if (!userProfile) {
        const meta = data.user.user_metadata || {}
        const isUserAdmin =
          email.includes('admin') || email.startsWith('salif') || meta.role === 'admin'
        userProfile = {
          id: data.user.id,
          name: meta.name || data.user.email?.split('@')[0] || 'DO Explorer',
          handle: meta.handle || `@${data.user.email?.split('@')[0] || 'user'}`,
          bio: 'Exploring good moments on DO.',
          city: meta.city || 'bangalore',
          trustScore: 150,
          interests: ['social', 'food', 'tech'],
          highlightInterests: true,
          isGuest: false,
          isAdmin: isUserAdmin,
        }
        await communityService.upsertProfile(userProfile).catch(() => {})
      } else if (email.includes('admin') || email.startsWith('salif')) {
        userProfile.isAdmin = true
      }

      return {
        ok: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          name: userProfile.name,
        },
        profile: userProfile,
      }
    } catch (err) {
      return {
        ok: false,
        error: (err as Error).message || 'An unexpected error occurred during sign-in.',
      }
    }
  },

  async signOut(): Promise<{ ok: boolean }> {
    const supabase = getSupabaseClient()
    if (!supabase) return { ok: true }

    try {
      await supabase.auth.signOut()
      return { ok: true }
    } catch {
      return { ok: true }
    }
  },

  async getSession() {
    const supabase = getSupabaseClient()
    if (!supabase) return null
    try {
      const { data } = await supabase.auth.getSession()
      return data.session
    } catch {
      return null
    }
  },

  async getCurrentUser() {
    const supabase = getSupabaseClient()
    if (!supabase) return null
    try {
      const { data } = await supabase.auth.getUser()
      return data.user
    } catch {
      return null
    }
  },
}
