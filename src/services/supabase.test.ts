import { describe, expect, it } from 'vitest'
import {
  isSupabaseConfigured,
  getSupabaseClient,
  checkSupabaseConnection,
  eventsService,
  tripsService,
  beaconsService,
  messagesService,
} from './supabase'

describe('Supabase Integration for DO', () => {
  it('detects valid Supabase configuration for project DO', () => {
    expect(isSupabaseConfigured()).toBe(true)
    const client = getSupabaseClient()
    expect(client).not.toBeNull()
  })

  it('connects to Supabase DO database and verifies events table', async () => {
    const health = await checkSupabaseConnection()
    expect(health.ok).toBe(true)
    expect(health.eventCount).toBeGreaterThanOrEqual(0)
  })

  it('can query cloud events and maps them through DO truth verifier', async () => {
    const events = await eventsService.fetchEvents()
    expect(Array.isArray(events)).toBe(true)
    if (events.length > 0) {
      const first = events[0]
      expect(first.id).toBeDefined()
      expect(first.title).toBeDefined()
      expect(first.genre).toBeDefined()
      expect(first.isVerified).toBe(true)
    }
  })

  it('handles active beacon queries gracefully', async () => {
    const beacons = await beaconsService.fetchActiveBeacons()
    expect(Array.isArray(beacons)).toBe(true)
  })

  it('can upsert an event, publish a beacon, and save a trip to Supabase project Do', async () => {
    const testEvent = {
      id: 'test-supabase-event-1',
      title: 'Do Launch Meetup',
      description: 'Celebrating the Do database integration',
      genre: 'tech' as const,
      isOnline: false,
      venueName: 'Kozhikode Beach Point',
      address: 'Kozhikode, Kerala',
      city: 'kozhikode',
      country: 'India',
      latitude: 11.2588,
      longitude: 75.7804,
      startTime: new Date(Date.now() + 86400000).toISOString(),
      endTime: new Date(Date.now() + 93600000).toISOString(),
      imageUrl: '/images/tech.jpg',
      registrationUrl: 'https://example.com/register',
      priceTier: 'free' as const,
      priceAmount: 0,
      currency: 'INR',
      sourcePlatform: 'DO',
      sourceHash: 'test-hash-1',
      isVerified: true,
      rating: 5,
      provenance: 'community' as const,
    }

    const saved = await eventsService.upsertEvent(testEvent)
    expect(saved).toBe(true)

    const events = await eventsService.fetchEvents()
    expect(events.some((e) => e.id === 'test-supabase-event-1')).toBe(true)

    // Test Beacon
    const beacon = {
      id: 'test-beacon-1',
      userId: 'test-user',
      userName: 'Salif',
      userAvatar: 'S',
      latitude: 11.2588,
      longitude: 75.7804,
      city: 'kozhikode',
      vibeMessage: 'Exploring the coast',
      expiresAt: new Date(Date.now() + 7200000).toISOString(),
    }
    const beaconSaved = await beaconsService.publishBeacon(beacon)
    expect(beaconSaved).toBe(true)

    const activeBeacons = await beaconsService.fetchActiveBeacons()
    expect(activeBeacons.some((b) => b.id === 'test-beacon-1')).toBe(true)

    // Test Chat Message
    const posted = await messagesService.postMessage('test-supabase-event-1', {
      id: 'msg-test-1',
      userName: 'Salif',
      avatar: 'S',
      body: 'Welcome to the Do project database!',
      createdAt: new Date().toISOString(),
    })
    expect(posted).toBe(true)

    const messages = await messagesService.fetchMessagesForEvent('test-supabase-event-1')
    expect(messages.some((m) => m.id === 'msg-test-1')).toBe(true)
  }, 15000)

  it('handles trip queries gracefully', async () => {
    const plans = await tripsService.fetchPlans('test-user')
    expect(Array.isArray(plans)).toBe(true)
  })

  it('handles event messages query gracefully', async () => {
    const messages = await messagesService.fetchMessagesForEvent('non-existent-event')
    expect(Array.isArray(messages)).toBe(true)
  })

  it('supports real-time chat subscriptions with cleanup function', () => {
    const onMessage = () => {}
    const unsubscribe = messagesService.subscribeToMessages('test-supabase-event-1', onMessage)
    expect(typeof unsubscribe).toBe('function')
    expect(() => unsubscribe()).not.toThrow()
  })
})

