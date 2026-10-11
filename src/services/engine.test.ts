import { describe, expect, it } from 'vitest'
import type { PulseEvent, TripConfig } from '../domain'
import { CITIES } from '../data/cities'
import { generateSeedEvents } from '../data/mockEvents'
import { createICS, validateTripConfig } from './calendar'
import { verifyAndDeduplicate, verifyEvent } from './eventTruthVerifier'
import { estimateTransit, haversine, spreadMarkers } from './geo'
import { dayCount, generateItinerary, recalculateStops, swapAlternatives } from './itineraryEngine'
import { eventDay, eventSlot, zonedISO } from './time'
import { filterEvents } from './filters'
import { simulateIngestion } from './scraper'

const now = new Date('2026-10-10T08:00:00Z'),
  events = generateSeedEvents(now, 7)
const config: TripConfig = {
  destinationCity: 'bangalore',
  startDate: '2026-10-11',
  endDate: '2026-10-13',
  vibeTags: ['food', 'tech', 'art', 'music', 'nightlife', 'outdoor', 'sports', 'business'],
  pace: 'balanced',
  budget: 'all',
}
const event = (overrides: Partial<PulseEvent> = {}): PulseEvent => ({
  ...events[0],
  id: 'test-event',
  title: 'A test happening',
  startTime: zonedISO('2026-10-11', '10:00', 'bangalore'),
  endTime: zonedISO('2026-10-11', '11:30', 'bangalore'),
  ...overrides,
})
describe('event truth verifier', () => {
  it('ingests five sources across five cities and enforces source-specific genres', async () => {
    const progress: string[] = []
    const result = await simulateIngestion([], (source) => progress.push(source))
    expect(progress).toEqual(['Luma', 'Meetup', 'Eventbrite', 'Devpost', 'Local venues'])
    expect(result.events).toHaveLength(25)
    expect(new Set(result.events.map((e) => e.city)).size).toBe(5)
    expect(
      result.events.filter((e) => e.sourcePlatform === 'Devpost').every((e) => e.genre === 'tech'),
    ).toBe(true)
    expect(result.repaired).toBe(5)
    expect(result.duplicates).toBe(1)
    expect(result.rejected).toBe(1)
  }, 15000)
  it('seeds 756 verified, unique events in seven cities with all twelve genres', () => {
    expect(events).toHaveLength(756)
    expect(new Set(events.map((e) => e.sourceHash)).size).toBe(events.length)
    expect(new Set(events.map((e) => e.genre)).size).toBe(12)
    expect(new Set(events.map((e) => e.city)).size).toBe(7)
    for (const e of events.filter((e) => !e.isOnline)) {
      const city = CITIES.find((c) => c.id === e.city)!
      expect(e.latitude).toBeGreaterThanOrEqual(city.bounds[0])
      expect(e.latitude).toBeLessThanOrEqual(city.bounds[1])
      expect(e.longitude).toBeGreaterThanOrEqual(city.bounds[2])
      expect(e.longitude).toBeLessThanOrEqual(city.bounds[3])
      expect(e.sourceHash).toMatch(/^[a-f0-9]{64}$/)
    }
  })
  it.each([
    [0, 0],
    [90, 179],
    [NaN, Infinity],
    [37.5, -120],
  ])('repairs null, nonfinite and wrong-country coordinates %s %s', (latitude, longitude) => {
    const result = verifyEvent(event({ latitude, longitude }))
    expect(result.repaired).toBe(true)
    expect(result.event.latitude).toBeGreaterThan(12.83)
    expect(result.event.longitude).toBeGreaterThan(77.46)
  })
  it('deduplicates normalized titles by city and date', () => {
    const result = verifyAndDeduplicate([
      event(),
      event({ id: 'other', title: '  A TEST    HAPPENING  ' }),
    ])
    expect(result.events).toHaveLength(1)
    expect(result.duplicates).toBe(1)
  })
  it('rejects invalid dates and an event ending before it starts', () => {
    expect(() => verifyEvent(event({ startTime: 'not-a-date' }))).toThrow()
    expect(() => verifyEvent(event({ endTime: '2020-01-01T00:00:00Z' }))).toThrow()
  })
  it('allows virtual coordinates without ever including them in physical filters', () => {
    const online = event({ isOnline: true, latitude: 0, longitude: 0 })
    expect(verifyEvent(online).event.latitude).toBe(0)
    expect(
      filterEvents(
        [online],
        { city: 'bangalore', genre: 'all', time: 'all', date: '', query: '', radius: 0 },
        now,
      ),
    ).toHaveLength(0)
  })
})
describe('time and distance', () => {
  it('calculates a known Haversine distance and the mandated transit estimate', () => {
    const distance = haversine({ latitude: 0, longitude: 1 }, { latitude: 0, longitude: 2 })
    expect(distance).toBeCloseTo(111.195, 2)
    expect(estimateTransit(5.4)).toBe(23)
    expect(estimateTransit(0)).toBe(10)
  })
  it('spreads co-located pins deterministically independent of input order', () => {
    const a = event({ id: 'a' }),
      b = event({ id: 'b' })
    const first = spreadMarkers([a, b]),
      second = spreadMarkers([b, a])
    expect(first.get('a')).toEqual(second.get('a'))
    expect(first.get('a')).not.toEqual(first.get('b'))
  })
  it('handles nonoverlapping bracket boundaries and post-midnight nights', () => {
    expect(eventSlot(event({ startTime: zonedISO('2026-10-11', '08:30', 'bangalore') }))).toBe(
      'morning',
    )
    expect(eventSlot(event({ startTime: zonedISO('2026-10-11', '12:30', 'bangalore') }))).toBe(
      'afternoon',
    )
    expect(eventSlot(event({ startTime: zonedISO('2026-10-11', '17:00', 'bangalore') }))).toBe(
      'evening',
    )
    const midnight = event({ startTime: zonedISO('2026-10-12', '01:00', 'bangalore') })
    expect(eventSlot(midnight)).toBe('night')
    expect(eventDay(midnight)).toBe('2026-10-11')
    expect(eventSlot(event({ startTime: zonedISO('2026-10-11', '04:00', 'bangalore') }))).toBe(null)
  })
  it('calculates city-local dates across UTC midnight and DST changes', () => {
    expect(zonedISO('2026-10-11', '00:30', 'tokyo')).toBe('2026-10-10T15:30:00.000Z')
    expect(zonedISO('2026-10-26', '10:00', 'berlin')).toBe('2026-10-26T09:00:00.000Z')
    expect(zonedISO('2026-10-10', '10:00', 'berlin')).toBe('2026-10-10T08:00:00.000Z')
  })
})
describe('spatio-temporal itinerary engine', () => {
  it.each(['chill', 'balanced', 'packed'] as const)(
    'enforces %s limits, chronology, transit buffers, and no duplicate stops',
    (pace) => {
      const plan = generateItinerary(events, { ...config, pace }),
        limit = { chill: 2, balanced: 3, packed: 4 }[pace]
      expect(plan.stops.length).toBeGreaterThan(0)
      expect(new Set(plan.stops.map((s) => s.event.id)).size).toBe(plan.stops.length)
      for (let day = 1; day <= 3; day++) {
        const stops = plan.stops.filter((s) => s.dayNumber === day)
        expect(stops.length).toBeLessThanOrEqual(limit)
        for (let i = 1; i < stops.length; i++) {
          const gap =
            (+new Date(stops[i].event.startTime) - +new Date(stops[i - 1].event.endTime)) / 60000
          expect(gap).toBeGreaterThanOrEqual(
            Math.max(pace === 'chill' ? 180 : 45, stops[i].transitMinutesFromPrev),
          )
          expect(stops[i].tightConnection).toBe(false)
        }
      }
    },
  )
  it('never includes online, unverified, wrong-city, or unaffordable events', () => {
    const plan = generateItinerary(events, { ...config, budget: 'free' })
    expect(
      plan.stops.every(
        (s) =>
          !s.event.isOnline &&
          s.event.isVerified &&
          s.event.city === 'bangalore' &&
          s.event.priceTier === 'free',
      ),
    ).toBe(true)
  })
  it('anchors the first stop to the traveler’s primary vibe', () => {
    const plan = generateItinerary(events, { ...config, vibeTags: ['music', 'food', 'art'] })
    expect(
      plan.stops.filter((s) => s.sortOrder === 0).every((s) => s.event.genre === 'music'),
    ).toBe(true)
  })
  it('chooses the nearest feasible event within a later bracket', () => {
    const morning = event(),
      near = event({
        id: 'near',
        title: 'near',
        latitude: morning.latitude + 0.001,
        startTime: zonedISO('2026-10-11', '14:00', 'bangalore'),
        endTime: zonedISO('2026-10-11', '15:00', 'bangalore'),
      }),
      far = { ...near, id: 'far', latitude: 13.1 }
    const plan = generateItinerary([morning, far, near], { ...config, endDate: config.startDate })
    expect(plan.stops[1].event.id).toBe('near')
  })
  it('flags tight connections after manual edits and resets transit for each day', () => {
    const plan = generateItinerary(events, config),
      stops = plan.stops.map((s, i) =>
        i === 1 ? { ...s, event: { ...s.event, startTime: plan.stops[0].event.endTime } } : s,
      ),
      updated = recalculateStops(stops)
    expect(updated[1].tightConnection).toBe(true)
    expect(updated.find((s) => s.dayNumber === 2)?.transitMinutesFromPrev).toBe(0)
  })
  it('returns only safe same-bracket alternatives within 5 km', () => {
    const plan = generateItinerary(events, config),
      stop = plan.stops[1]
    for (const alternative of swapAlternatives(stop, plan, events)) {
      expect(haversine(stop.event, alternative)).toBeLessThanOrEqual(5)
      expect(eventSlot(alternative)).toBe(stop.slot)
      expect(eventDay(alternative)).toBe(eventDay(stop.event))
      expect(
        recalculateStops(
          plan.stops.map((s) => (s.id === stop.id ? { ...s, event: alternative } : s)),
        ).every((s) => !s.tightConnection),
      ).toBe(true)
    }
  })
  it('rejects inverted or oversized date ranges', () => {
    expect(dayCount('2026-10-10', '2026-10-12')).toBe(3)
    expect(() => generateItinerary(events, { ...config, endDate: '2026-10-09' })).toThrow()
    expect(() => generateItinerary(events, { ...config, endDate: '2026-11-09' })).toThrow()
  })
})
describe('portable exports and sharing', () => {
  it('exports RFC 5545 CRLF, UTC timestamps, escaped text and byte-folded lines', () => {
    const content = createICS([
      event({ title: 'Music, art; friends', description: 'Long story: ' + '楽しい夜 '.repeat(60) }),
    ])
    expect(content).toContain('BEGIN:VCALENDAR\r\nVERSION:2.0')
    expect(content).toContain('SUMMARY:Music\\, art\\; friends')
    expect(content).toContain('DTSTART:20261011T043000Z')
    expect(content).toContain('LOCATION:')
    expect(content).toContain('URL:https://')
    expect(content).toMatch(/\r\n /)
    for (const line of content.split('\r\n'))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
  })
  it('validates untrusted shared configurations', () => {
    expect(validateTripConfig(config)).toBe(true)
    expect(validateTripConfig({ ...config, destinationCity: 'ocean' })).toBe(false)
    expect(validateTripConfig({ ...config, vibeTags: ['invalid'] })).toBe(false)
    expect(validateTripConfig({ ...config, pace: 'unsafe' })).toBe(false)
    expect(validateTripConfig({ ...config, startDate: 'invalid' })).toBe(false)
    expect(validateTripConfig(null)).toBe(false)
  })
})
