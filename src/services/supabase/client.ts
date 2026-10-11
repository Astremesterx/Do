import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

const env =
  typeof import.meta !== 'undefined' && import.meta.env
    ? (import.meta.env as Record<string, string | undefined>)
    : {}

const supabaseUrl =
  env.VITE_SUPABASE_URL?.trim() ||
  'https://wvmczeizdehapojpzgoz.supabase.co'

const supabaseAnonKey =
  env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  env.VITE_SUPABASE_ANON_KEY?.trim() ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2bWN6ZWl6ZGVoYXBvanB6Z296Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2NDg3MTgsImV4cCI6MjEwNzIyNDcxOH0.oz1KplLFkpkL5p78vV9Vcu6AHqrjro9TtTrQvLKXwG0'

export function isPublicSupabaseConfig(url: string, key: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
      parsed.pathname !== '/' || parsed.search || parsed.hash ||
      parsed.hostname.includes('your-project-ref')) return false
    if (key.startsWith('sb_publishable_')) return key.length > 20
    // Never allow service_role / secret credentials to initialize a browser client.
    const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload.role === 'anon'
  } catch {
    return false
  }
}

export const isSupabaseConfigured = (): boolean => {
  return isPublicSupabaseConfig(supabaseUrl, supabaseAnonKey)
}

let clientInstance: SupabaseClient<Database> | null = null

export const getSupabaseClient = (): SupabaseClient<Database> | null => {
  if (!isSupabaseConfigured()) {
    return null
  }
  if (!clientInstance) {
    try {
      clientInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    } catch (err) {
      console.warn('[DO Supabase] Failed to initialize client:', err)
      clientInstance = null
    }
  }
  return clientInstance
}

export const checkSupabaseConnection = async (): Promise<{
  ok: boolean
  message: string
  eventCount?: number
}> => {
  const client = getSupabaseClient()
  if (!client) {
    return { ok: false, message: 'Supabase credentials not configured' }
  }
  try {
    const { count, error } = await client
      .from('events')
      .select('*', { count: 'exact', head: true })
    if (error) {
      return { ok: false, message: error.message }
    }
    return {
      ok: true,
      message: 'Connected to Supabase project DO',
      eventCount: count ?? 0,
    }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Connection failed',
    }
  }
}

export const supabase = getSupabaseClient()
