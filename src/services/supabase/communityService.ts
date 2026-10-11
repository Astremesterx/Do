import { getSupabaseClient } from './client'
import type { LocalProfile, EventReview, EventGenre } from '../../domain'

export const communityService = {
  async fetchProfiles(): Promise<LocalProfile[]> {
    const supabase = getSupabaseClient()
    if (!supabase) return []

    try {
      const { data, error } = await supabase.from('community_profiles').select('*')
      if (error || !data) return []

      return data.map((row) => ({
        id: row.id,
        name: row.name,
        handle: row.handle,
        trustScore: row.trust_score ?? 100,
        bio: row.bio || '',
        city: row.city || 'bangalore',
        interests: (row.interests || []) as EventGenre[],
        highlightInterests: true,
        isGuest: Boolean(row.is_guest),
        isOrg: Boolean(row.is_org),
        orgName: row.org_name || undefined,
      }))
    } catch {
      return []
    }
  },

  async upsertProfile(profile: LocalProfile): Promise<boolean> {
    const supabase = getSupabaseClient()
    if (!supabase) return false

    try {
      const { error } = await supabase.from('community_profiles').upsert(
        {
          id: profile.id,
          name: profile.name,
          handle: profile.handle,
          bio: profile.bio,
          city: profile.city,
          trust_score: profile.trustScore,
          interests: profile.interests,
          is_guest: profile.isGuest,
          is_org: profile.isOrg ?? false,
          org_name: profile.orgName || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      )
      return !error
    } catch {
      return false
    }
  },

  async recordRsvp(eventId: string, profileId: string, status = 'going'): Promise<boolean> {
    const supabase = getSupabaseClient()
    if (!supabase) return false

    try {
      const id = `${profileId}:${eventId}`
      const { error } = await supabase
        .from('community_rsvps')
        .upsert({ id, event_id: eventId, profile_id: profileId, status }, { onConflict: 'id' })
      return !error
    } catch {
      return false
    }
  },

  async removeRsvp(eventId: string, profileId: string): Promise<boolean> {
    const supabase = getSupabaseClient()
    if (!supabase) return false

    try {
      const id = `${profileId}:${eventId}`
      const { error } = await supabase.from('community_rsvps').delete().eq('id', id)
      return !error
    } catch {
      return false
    }
  },

  async recordReview(review: EventReview, userId: string): Promise<boolean> {
    const supabase = getSupabaseClient()
    if (!supabase) return false

    try {
      const id = `${userId}:${review.eventId}`
      const { error } = await supabase.from('event_reviews').upsert(
        {
          id,
          event_id: review.eventId,
          user_id: userId,
          attended: review.attended,
          rating: review.rating,
          compliments: review.compliments,
          notes: review.notes,
        },
        { onConflict: 'id' },
      )
      return !error
    } catch {
      return false
    }
  },
}
