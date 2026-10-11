import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { CITIES } from '../data/cities'
import { generateSeedEvents } from '../data/mockEvents'
import {
  normalizeCollection,
  normalizeSourceEvent,
  parseDevpostPeriod,
  safeHTTPS,
} from './collection'
import { verifyAndDeduplicate, verifyEvent } from './eventTruthVerifier'
import { filterEvents } from './filters'
import { eligibleEvents } from './itineraryEngine'
import { isLive } from './time'

const now = new Date('2026-10-10T12:00:00Z')
const raw = {
  id: 101,
  title: 'DevFest Bangalore 2026',
  url: 'https://gdg.community.dev/events/details/test/',
  start_date: '2026-10-12T09:00:00+05:30',
  end_date: '2026-10-12T18:00:00+05:30',
  chapter: { city: 'Bengaluru', title: 'GDG Bangalore', chapter_location: 'Bangalore, India' },
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(now)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('public collection adapters', () => {
  it('reads Pulse snake_case times with seconds and repairs wrong-country pins using a named city', () => {
    const imported = normalizeSourceEvent(
      {
        id: 'reference',
        title: 'Bengaluru build',
        location: 'Palace Grounds, Bengaluru',
        start_date: '2026-10-12',
        end_date: '2026-10-12',
        start_time: '09:00:00',
        end_time: '18:00:00',
        source_url: 'https://example.com/reference',
        latitude: 37.7749,
        longitude: -122.4194,
      },
      'pulse-import',
    )
    expect(imported.city).toBe('bangalore')
    expect(imported.startTime).toBe('2026-10-12T03:30:00.000Z')
    expect(verifyEvent(imported).event.longitude).toBeGreaterThan(77)
  })
  it('audits every bundled Pulse reference record without failing on time strings with seconds', () => {
    const payload = JSON.parse(
      readFileSync(new URL('../../public/data/pulse-archive.json', import.meta.url), 'utf8'),
    )
    const result = normalizeCollection(payload, [], true)
    expect(result.rawCount).toBe(127)
    expect(result.events.length).toBeGreaterThan(100)
    expect(result.events.every((event) => event.archived)).toBe(true)
    expect(result.issues.some((issue) => issue.reason.includes('Invalid time value'))).toBe(false)
    console.info(
      `Pulse reference: ${result.rawCount} raw, ${result.events.length} imported, ${result.events.filter((event) => event.archived).length} archived, ${result.rejected} excluded.`,
    )
  })
  it('keeps explicitly virtual GDG titles off the physical map', () => {
    const event = normalizeSourceEvent({ ...raw, title: 'AI clinic (Virtual)' }, 'gdg')
    expect(event.isOnline).toBe(true)
    expect(event.latitude).toBe(0)
  })
  it.each([
    ['Aug 31 – Oct 23, 2026', ['2026-08-31', '2026-10-23']],
    ['Oct 01 - 10, 2026', ['2026-10-01', '2026-10-10']],
    ['Dec 30 – Jan 03, 2027', ['2026-12-30', '2027-01-03']],
    ['Feb 30 – Mar 01, 2026', null],
    ['Feb 99 – Mar 01, 2026', null],
    ['unknown', null],
  ])('parses source date window %s', (value, dates) =>
    expect(parseDevpostPeriod(value)).toEqual(dates),
  )

  it('retains supplied timestamps, city aliases, organizer, and collection provenance', () => {
    const event = normalizeSourceEvent(raw, 'gdg')
    expect(event.city).toBe('bangalore')
    expect(event.startTime).toBe(raw.start_date)
    expect(event.host?.name).toBe('GDG Bangalore')
    expect(event.host?.trustScore).toBe(0)
    expect(event.provenance).toBe('collected')
    expect(event.locationPrecision).toBe('city')
    expect(event.verification?.flags.join(' ')).toContain('Price was not supplied')
  })

  it('excludes test, hidden, private, unsupported-city, and unsafe-source records', () => {
    const invalid = [
      { ...raw, is_test: true },
      { ...raw, is_hidden: true },
      { ...raw, chapter: { ...raw.chapter, is_private: true } },
      { ...raw, chapter: { city: 'Unmapped City' } },
      { ...raw, url: 'javascript:alert(1)' },
    ]
    const result = normalizeCollection({ sources: [{ id: 'gdg', payload: { results: invalid } }] })
    expect(result.events).toHaveLength(0)
    expect(result.rejected).toBe(5)
    expect(result.issues.some((i) => i.reason.includes('no substitute country pin'))).toBe(true)
  })

  it('keeps Devpost online without inventing a physical pin', () => {
    const result = normalizeSourceEvent(
      {
        id: 10,
        title: 'Global build',
        url: 'https://example.com/hackathon',
        displayed_location: { location: 'Online' },
        submission_period_dates: 'Oct 01 – Nov 10, 2026',
        thumbnail_url: '//example.com/cover.png',
      },
      'devpost',
    )
    expect(result.isOnline).toBe(true)
    expect([result.latitude, result.longitude]).toEqual([0, 0])
    expect(result.endTime).toBe('2026-11-10T23:59:59Z')
    expect(result.imageUrl).toBe('https://example.com/cover.png')
    expect(result.verification?.flags.join(' ')).toContain('Date-only submission window')
  })

  it('archives historical imports without moving their dates into the present', () => {
    const legacy = {
      ...raw,
      start_date: '2025-08-01T09:00:00Z',
      end_date: '2025-08-01T18:00:00Z',
      title: 'DevFest 2025',
    }
    expect(normalizeCollection({ events: [legacy] }).events).toHaveLength(0)
    const archived = normalizeCollection({ events: [legacy] }, [], true).events[0]
    expect(archived.archived).toBe(true)
    expect(archived.startTime).toBe(legacy.start_date)
    expect(archived.provenance).toBe('pulse-import')
  })

  it('rejects an edition/date conflict and an explicitly ended event', () => {
    const result = normalizeCollection({
      sources: [
        {
          id: 'gdg',
          payload: {
            results: [
              { ...raw, title: 'DevFest 2024' },
              { ...raw, title: 'Past event: DevFest' },
            ],
          },
        },
      ],
    })
    expect(result.events).toHaveLength(0)
    expect(result.rejected).toBe(2)
  })

  it('restores native DO records that have no external registration link', () => {
    const event = {
      ...generateSeedEvents(now)[0],
      id: 'local-no-ticket',
      title: 'Local book swap',
      startTime: raw.start_date,
      endTime: raw.end_date,
      registrationUrl: '',
      provenance: 'community' as const,
    }
    const result = normalizeCollection({ events: [event] })
    expect(result.events).toHaveLength(1)
    expect(result.events[0].id).toBe(event.id)
    expect(result.events[0].provenance).toBe('community')
  })

  it('refreshes a collected registration status while avoiding duplicate records', () => {
    const payload = { sources: [{ id: 'gdg', payload: { results: [raw] } }] }
    const first = normalizeCollection(payload)
    const second = normalizeCollection(
      {
        sources: [{ id: 'gdg', payload: { results: [{ ...raw, registrationStatus: 'closed' }] } }],
      },
      first.events,
    )
    expect(second.events).toHaveLength(0)
    expect(second.updates).toHaveLength(1)
    expect(second.updates[0].registrationStatus).toBe('closed')
    const hidden = normalizeCollection(
      { sources: [{ id: 'gdg', payload: { results: [{ ...raw, is_hidden: true }] } }] },
      first.events,
    )
    expect(hidden.updates[0].archived).toBe(true)
  })

  it('audits the collected public snapshot without treating raw counts as valid events', () => {
    const payload: { sources: { count: number }[] } = JSON.parse(
      readFileSync(new URL('../../public/data/collected-events.json', import.meta.url), 'utf8'),
    )
    const result = normalizeCollection(payload)
    const capturedCount = payload.sources.reduce(
      (total: number, source: { count: number }) => total + source.count,
      0,
    )
    expect(result.rawCount).toBe(capturedCount)
    expect(result.rawCount).toBeGreaterThan(0)
    expect(result.events.length).toBeGreaterThan(0)
    expect(result.events.length).toBeLessThan(result.rawCount)
    expect(
      result.events.every(
        (e) => !e.archived && +new Date(e.endTime) > +now && e.provenance === 'collected',
      ),
    ).toBe(true)
    console.info(
      `Collection snapshot: ${result.rawCount} raw, ${result.events.length} accepted, ${result.rejected} excluded, ${result.duplicates} duplicates.`,
    )
  })
})

describe('data integrity across discovery and planning', () => {
  it('uses a default nearby radius and excludes unknown prices from free filters', () => {
    const event = {
      ...generateSeedEvents(now)[0],
      startTime: raw.start_date,
      endTime: raw.end_date,
      latitude: 13.1,
      longitude: 77.7,
    }
    const filters = {
      city: event.city,
      genre: 'all' as const,
      time: 'all' as const,
      date: '',
      query: '',
      radius: 0,
      preferences: {
        scope: 'nearby' as const,
        pricing: 'all' as const,
        minTrust: 0,
        interestsOnly: false,
        followingOnly: false,
      },
    }
    expect(filterEvents([event], filters, now)).toHaveLength(0)
    expect(
      filterEvents(
        [{ ...event, priceTier: 'free', priceKnown: false }],
        { ...filters, preferences: { ...filters.preferences, scope: 'global', pricing: 'free' } },
        now,
      ),
    ).toHaveLength(0)
  })
  it('blocks unsafe links and ID collisions in imported records', () => {
    const event = generateSeedEvents(now)[0]
    expect(safeHTTPS('https://name:password@example.com')).toBe('')
    expect(safeHTTPS('javascript:alert(1)')).toBe('')
    expect(() => verifyEvent({ ...event, meetingUrl: 'javascript:alert(1)' })).toThrow()
    expect(() =>
      verifyEvent({ ...event, officialLinks: [{ label: 'Unsafe', url: 'data:text/html,hello' }] }),
    ).toThrow()
    expect(
      verifyAndDeduplicate([event, { ...event, title: 'Different title, same ID' }]).events,
    ).toHaveLength(1)
  })

  it('rejects malformed optional metadata before imported events reach the UI', () => {
    const event = generateSeedEvents(now)[0]
    for (const metadata of [
      { tags: [null] },
      { verification: { flags: 'verified' } },
      { exactVenue: { label: 'venue' } },
      { archived: 'false' },
      { officialLinks: 'https://example.com' },
    ]) {
      const result = normalizeCollection({ events: [{ ...event, ...metadata }] })
      expect(result.events).toHaveLength(0)
      expect(result.rejected).toBe(1)
    }
  })

  it('keeps archived and concluded records out of live discovery and trip generation', () => {
    const event = generateSeedEvents(now)[0]
    const records = [
      { ...event, archived: true },
      { ...event, id: 'concluded', concluded: true },
    ]
    const filters = {
      city: event.city,
      genre: 'all' as const,
      time: 'all' as const,
      date: '',
      query: '',
      radius: 0,
    }
    expect(filterEvents(records, filters, now)).toHaveLength(0)
    expect(records.some((e) => isLive(e, +now))).toBe(false)
    expect(
      eligibleEvents(records, {
        destinationCity: event.city,
        startDate: '2026-10-10',
        endDate: '2026-10-13',
        vibeTags: [event.genre],
        pace: 'balanced',
        budget: 'all',
      }),
    ).toHaveLength(0)
  })

  it('provides runtime-supported city timezones, including regional exceptions', () => {
    for (const city of CITIES)
      expect(() =>
        new Intl.DateTimeFormat('en', { timeZone: city.timezone }).format(now),
      ).not.toThrow()
    expect(CITIES.find((c) => c.id === 'vancouver')?.timezone).toBe('America/Vancouver')
    expect(CITIES.find((c) => c.id === 'perth')?.timezone).toBe('Australia/Perth')
  })
})
