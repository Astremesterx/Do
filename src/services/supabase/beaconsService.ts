import { getSupabaseClient } from './client'
import type { ImFreeBeacon, EventGenre } from '../../domain'

export const beaconsService = {
  async fetchActiveBeacons(): Promise<ImFreeBeacon[]> {
    const supabase = getSupabaseClient()
    if (!supabase) return []

    try {
      const nowIso = new Date().toISOString()
      const { data, error } = await supabase
        .from('beacons')
        .select('*')
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false })

      if (error || !data) {
        console.warn('[DO Supabase] Error fetching beacons:', error)
        return []
      }

      return data.map((row) => ({
        id: row.id,
        userId: row.user_id,
        userName: row.user_name,
        userAvatar: row.user_avatar,
        latitude: row.latitude,
        longitude: row.longitude,
        city: row.city,
        vibeMessage: row.vibe_message,
        expiresAt: row.expires_at,
        radiusKm: row.radius_km || 10,
        interests: (row.interests || []) as EventGenre[],
      }))
    } catch (err) {
      console.warn('[DO Supabase] Failed to load beacons:', err)
      return []
    }
  },

  async publishBeacon(beacon: ImFreeBeacon): Promise<boolean> {
    const supabase = getSupabaseClient()
    if (!supabase) return false

    try {
      const { error } = await supabase.from('beacons').upsert(
        {
          id: beacon.id,
          user_id: beacon.userId,
          user_name: beacon.userName,
          user_avatar: beacon.userAvatar,
          latitude: beacon.latitude,
          longitude: beacon.longitude,
          city: beacon.city,
          vibe_message: beacon.vibeMessage,
          expires_at: beacon.expiresAt,
          radius_km: beacon.radiusKm || 10,
          interests: beacon.interests || [],
        },
        { onConflict: 'id' },
      )

      if (error) {
        console.warn('[DO Supabase] Error publishing beacon:', error)
        return false
      }
      return true
    } catch (err) {
      console.warn('[DO Supabase] Exception publishing beacon:', err)
      return false
    }
  },

  async deleteBeacon(beaconId: string): Promise<boolean> {
    const supabase = getSupabaseClient()
    if (!supabase) return false

    try {
      const { error } = await supabase.from('beacons').delete().eq('id', beaconId)
      return !error
    } catch {
      return false
    }
  },
}
