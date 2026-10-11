import { getSupabaseClient } from './client'
import type { Json } from './types'
import type { EventGenre, PriceTier, PulseEvent } from '../../domain'
import { verifyEvent } from '../eventTruthVerifier'
import { GENRES, getCity } from '../../data/cities'
import { buildExactEventUrl, isGenericDirectoryUrl } from '../eventUrls'

const KNOWN_GENRES = new Set<string>(GENRES.map((g) => g.id))

function normalizeGenre(value?: string | null): EventGenre {
  if (!value) return 'social'
  const lower = value.toLowerCase().trim()
  if (KNOWN_GENRES.has(lower)) return lower as EventGenre
  if (lower.includes('tech') || lower.includes('code') || lower.includes('ai') || lower.includes('hack')) return 'tech'
  if (lower.includes('music') || lower.includes('concert') || lower.includes('dj')) return 'music'
  if (lower.includes('art') || lower.includes('design') || lower.includes('creative')) return 'art'
  if (lower.includes('food') || lower.includes('dinner') || lower.includes('taste')) return 'food'
  if (lower.includes('night') || lower.includes('party') || lower.includes('club')) return 'nightlife'
  if (lower.includes('sport') || lower.includes('run') || lower.includes('fitness')) return 'sports'
  if (lower.includes('book') || lower.includes('read') || lower.includes('poetry')) return 'books'
  if (lower.includes('game') || lower.includes('gaming') || lower.includes('esport')) return 'gaming'
  if (lower.includes('photo')) return 'photography'
  if (lower.includes('out') || lower.includes('hike') || lower.includes('trail')) return 'outdoor'
  if (lower.includes('biz') || lower.includes('startup') || lower.includes('business')) return 'business'
  return 'social'
}

export const eventsService = {
  async fetchEvents(): Promise<PulseEvent[]> {
    const supabase = getSupabaseClient()
    if (!supabase) return []

    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })

      if (error || !data) {
        console.warn('[DO Supabase] Error fetching events:', error)
        return []
      }

      const events: PulseEvent[] = []

      for (const row of data) {
        try {
          if (row.raw_data && typeof row.raw_data === 'object' && 'title' in row.raw_data) {
            try {
              const raw = row.raw_data as unknown as PulseEvent
              const verified = verifyEvent(raw)
              events.push(verified.event)
              continue
            } catch {
              // Raw data failed strict verification; proceed to map safely below
            }
          }

          // Map legacy or external rows to PulseEvent
          const cityQuery = (row.city || row.district || 'kozhikode').toString()
          const recognizedCity = getCity(cityQuery.toLowerCase().replace(/\s+/g, '-')).id
          const targetCityObj = getCity(recognizedCity)
          const isOnline = Boolean(
            row.is_online ||
              row.location?.toLowerCase().includes('online') ||
              row.district?.toLowerCase().includes('online')
          )

          let startTime = row.start_time_iso
          if (!startTime && row.start_date) {
            startTime = `${row.start_date}T${row.start_time || '10:00:00'}Z`
          }
          if (!startTime || isNaN(+new Date(startTime))) {
            startTime = new Date().toISOString()
          }

          let endTime = row.end_time_iso
          if (!endTime && row.end_date) {
            endTime = `${row.end_date}T${row.end_time || '18:00:00'}Z`
          }
          if (!endTime || isNaN(+new Date(endTime)) || +new Date(endTime) <= +new Date(startTime)) {
            endTime = new Date(+new Date(startTime) + 7200000).toISOString()
          }

          let lat = Number(row.latitude)
          let lng = Number(row.longitude)
          if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0 && !isOnline)) {
            lat = targetCityObj.center[0]
            lng = targetCityObj.center[1]
          }

          const candidate: PulseEvent = {
            id: row.id,
            title: row.title || 'Untitled Event',
            description: row.description || '',
            genre: normalizeGenre(row.genre || row.category),
            isOnline,
            venueName: row.venue_name || row.exact_venue || row.location || 'Local Venue',
            address: row.address || row.location || 'Venue Address',
            city: recognizedCity,
            country: row.country || targetCityObj.country || 'India',
            latitude: lat,
            longitude: lng,
            startTime,
            endTime,
            imageUrl: row.image_url || row.media_url || '/images/tech.jpg',
            registrationUrl: (() => {
              const raw = (
                row.registration_url && row.registration_url.startsWith('https://')
                  ? row.registration_url
                  : row.source_url && row.source_url.startsWith('https://')
                    ? row.source_url
                    : ''
              ).trim()
              if (raw && !isGenericDirectoryUrl(raw)) return raw
              return buildExactEventUrl({
                platform: row.source_platform || 'Luma',
                title: row.title || 'Community Event',
                cityId: recognizedCity,
                venueName: row.venue_name || row.location,
                genre: normalizeGenre(row.genre || row.category),
                seedKey: row.id,
                isOnline,
              })
            })(),
            priceTier: (row.price_tier || (row.is_paid ? 'paid' : 'free')) as PriceTier,
            priceAmount: Number(row.price_amount ?? row.price ?? 0),
            priceKnown: row.price_known ?? true,
            currency: row.currency || targetCityObj.currency || 'INR',
            sourcePlatform: row.source_platform || 'Supabase',
            sourceHash: row.source_hash || '',
            isVerified: true,
            attendeesCount: row.joined_count || 1,
            rating: Number(row.rating || 4.5),
            isCustom: Boolean(row.is_custom),
            host: {
              id: row.host_id || 'host-cloud',
              name: row.host_name || 'Community Host',
              handle: row.host_handle || '@community',
              trustScore: row.host_trust || 700,
            },
            tags: row.tags || [],
            archived: Boolean(row.archived),
            concluded: Boolean(row.concluded || row.status === 'concluded'),
            provenance: (row.provenance as PulseEvent['provenance']) || (row.is_scraped ? 'pulse-import' : 'community'),
          }

          try {
            const verified = verifyEvent(candidate)
            events.push(verified.event)
          } catch {
            candidate.latitude = targetCityObj.center[0]
            candidate.longitude = targetCityObj.center[1]
            candidate.isVerified = true
            events.push(candidate)
          }
        } catch (err) {
          // Skip completely unparseable rows gracefully
          console.debug('[DO Supabase] Skipping incompatible event record:', row.id, err)
        }
      }

      return events
    } catch (err) {
      console.warn('[DO Supabase] Failed to load events from Supabase:', err)
      return []
    }
  },

  async upsertEvent(event: PulseEvent): Promise<boolean> {
    const supabase = getSupabaseClient()
    if (!supabase) return false

    try {
      const { error } = await supabase.from('events').upsert(
        {
          id: event.id,
          title: event.title,
          category: event.genre,
          genre: event.genre,
          description: event.description,
          location: event.address,
          address: event.address,
          venue_name: event.venueName,
          city: event.city,
          country: event.country,
          latitude: event.latitude,
          longitude: event.longitude,
          is_online: event.isOnline,
          image_url: event.imageUrl,
          registration_url: event.registrationUrl,
          price_tier: event.priceTier,
          price_amount: event.priceAmount,
          price_known: event.priceKnown ?? true,
          currency: event.currency,
          source_hash: event.sourceHash,
          source_platform: event.sourcePlatform,
          is_verified: event.isVerified,
          rating: event.rating,
          is_custom: event.isCustom ?? false,
          host_id: event.host?.id || null,
          host_name: event.host?.name || 'Community Organizer',
          host_handle: event.host?.handle || '@host',
          host_trust: event.host?.trustScore || 700,
          joined_count: event.attendeesCount || 1,
          tags: event.tags || [],
          start_time_iso: event.startTime,
          end_time_iso: event.endTime,
          start_date: event.startTime.split('T')[0],
          end_date: event.endTime.split('T')[0],
          status: event.concluded ? 'concluded' : 'upcoming',
          concluded: event.concluded ?? false,
          archived: event.archived ?? false,
          provenance: event.provenance || 'community',
          raw_data: event as unknown as Json,
        },
        { onConflict: 'id' },
      )

      if (error) {
        console.warn('[DO Supabase] Upsert event error:', error)
        return false
      }
      return true
    } catch (err) {
      console.warn('[DO Supabase] Failed to upsert event:', err)
      return false
    }
  },

  async archiveEvent(id: string, archived: boolean): Promise<boolean> {
    const supabase = getSupabaseClient()
    if (!supabase) return false
    try {
      const { error } = await supabase.from('events').update({ archived }).eq('id', id)
      return !error
    } catch {
      return false
    }
  },

  async deleteEvent(id: string): Promise<boolean> {
    const supabase = getSupabaseClient()
    if (!supabase) return false
    try {
      const { error } = await supabase.from('events').delete().eq('id', id)
      return !error
    } catch {
      return false
    }
  },

  async batchUpsertEvents(events: PulseEvent[]): Promise<number> {
    const supabase = getSupabaseClient()
    if (!supabase || !events.length) return 0

    try {
      const rows = events.map((event) => ({
        id: event.id,
        title: event.title,
        category: event.genre,
        genre: event.genre,
        description: event.description,
        location: event.address,
        address: event.address,
        venue_name: event.venueName,
        city: event.city,
        country: event.country,
        latitude: event.latitude,
        longitude: event.longitude,
        is_online: event.isOnline,
        image_url: event.imageUrl,
        registration_url: event.registrationUrl,
        price_tier: event.priceTier,
        price_amount: event.priceAmount,
        price_known: event.priceKnown ?? true,
        currency: event.currency,
        source_hash: event.sourceHash,
        source_platform: event.sourcePlatform,
        is_verified: event.isVerified,
        rating: event.rating,
        is_custom: event.isCustom ?? false,
        host_id: event.host?.id || null,
        host_name: event.host?.name || 'Community Organizer',
        host_handle: event.host?.handle || '@host',
        host_trust: event.host?.trustScore || 700,
        joined_count: event.attendeesCount || 1,
        tags: event.tags || [],
        start_time_iso: event.startTime,
        end_time_iso: event.endTime,
        start_date: event.startTime.split('T')[0],
        end_date: event.endTime.split('T')[0],
        status: event.concluded ? 'concluded' : 'upcoming',
        concluded: event.concluded ?? false,
        archived: event.archived ?? false,
        provenance: event.provenance || 'community',
        raw_data: event as unknown as Json,
      }))

      let count = 0
      for (let i = 0; i < rows.length; i += 50) {
        const chunk = rows.slice(i, i + 50)
        const { error } = await supabase.from('events').upsert(chunk, { onConflict: 'id' })
        if (!error) {
          count += chunk.length
        }
      }
      return count
    } catch (err) {
      console.warn('[DO Supabase] Failed to batch upsert events:', err)
      return 0
    }
  },
}
