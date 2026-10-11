import { afterEach, describe, expect, it, vi } from 'vitest'
import * as client from './supabase/client'
import { eventsService, tripsService, beaconsService, messagesService } from './supabase'

// Never use the developer's .env.local project or mutate live data in tests.
afterEach(() => vi.restoreAllMocks())

describe('Supabase services without a configured client', () => {
  it('fails closed and returns empty read results', async () => {
    vi.spyOn(client, 'getSupabaseClient').mockReturnValue(null)
    expect(await eventsService.fetchEvents()).toEqual([])
    expect(await tripsService.fetchPlans()).toEqual([])
    expect(await beaconsService.fetchActiveBeacons()).toEqual([])
    expect(await messagesService.fetchMessagesForEvent('event')).toEqual([])
    expect(await eventsService.deleteEvent('event')).toBe(false)
    expect(await tripsService.deletePlan('plan')).toBe(false)
    expect(await beaconsService.deleteBeacon('beacon')).toBe(false)
  })
})
