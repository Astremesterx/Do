import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from './types'

/** app_metadata is set by the server; user_metadata and email are never roles. */
export function isTrustedAdmin(user: Pick<User, 'app_metadata'> | null | undefined): boolean {
  return user?.app_metadata?.role === 'admin' ||
    (Array.isArray(user?.app_metadata?.roles) && user.app_metadata.roles.includes('admin'))
}

/** Defense in depth only: every table still needs ownership RLS on the server. */
export async function authenticatedUser(client: SupabaseClient<Database>): Promise<User | null> {
  try {
    const { data, error } = await client.auth.getUser()
    return !error && data.user ? data.user : null
  } catch {
    return null
  }
}
