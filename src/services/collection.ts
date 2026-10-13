import type { EventGenre, PulseEvent } from '../domain'
import { CITIES, resolveCity } from '../data/cities'
import { PHOTOS } from '../data/mockEvents'
import { verifyAndDeduplicate, verifyEvent } from './eventTruthVerifier'
import { zonedISO } from './time'

type RecordValue = Record<string, unknown>
const record = (value: unknown): RecordValue =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordValue) : {}
const text = (value: unknown) => (typeof value === 'string' ? value : '')
const number = (value: unknown, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback
const cleanText = (value: unknown) =>
  text(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
export function safeHTTPS(value: unknown) {
  try {
    const url = new URL(text(value).startsWith('//') ? `https:${value}` : text(value))
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''
  } catch {
    return ''
  }
}
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function parseDevpostPeriod(value: string): [string, string] | null {
  const match = value.match(
    /^([A-Za-z]{3})\s+(\d{1,2})\s*(?:,\s*(\d{4}))?\s*[-–]\s*(?:([A-Za-z]{3})\s+)?(\d{1,2}),?\s+(\d{4})$/,
  )
  if (!match) return null
  const endYear = +match[6],
    startMonth = months.indexOf(match[1]) + 1,
    endMonth = months.indexOf(match[4] || match[1]) + 1
  const startYear = match[3] ? +match[3] : endYear - (startMonth > endMonth ? 1 : 0)
  if (!startMonth || !endMonth) return null
  const date = (year: number, month: number, day: string) =>
    `${year}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}`
  const start = date(startYear, startMonth, match[2]),
    end = date(endYear, endMonth, match[5])
  const startDate = new Date(`${start}T00:00:00Z`),
    endDate = new Date(`${end}T00:00:00Z`)
  if (
    !Number.isFinite(+startDate) ||
    !Number.isFinite(+endDate) ||
    startDate.toISOString().slice(0, 10) !== start ||
    endDate.toISOString().slice(0, 10) !== end ||
    endDate < startDate
  )
    return null
  return [start, end]
}
const genreMap: Record<string, EventGenre> = {
  tech: 'tech',
  music: 'music',
  outdoor: 'outdoor',
  sports: 'sports',
  food: 'food',
  photography: 'photography',
  gaming: 'gaming',
  books: 'books',
  social: 'social',
  art: 'art',
  nightlife: 'nightlife',
  business: 'business',
}
function sourceRecordId(raw: RecordValue, source: string) {
  return `${source}-${String(raw.id || raw['@id'] || cleanText(raw.title || raw.name))
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 140)}`
}
function inferGenre(raw: RecordValue, source: string): EventGenre {
  if (genreMap[text(raw.category).toLowerCase()]) return genreMap[text(raw.category).toLowerCase()]
  if (['gdg', 'devpost', 'devfolio'].includes(source)) return 'tech'
  if (source === 'dice') return 'music'
  if (source === 'ra') return 'nightlife'
  if (source === 'athletics') return 'sports'
  const label = `${text(raw.title || raw.name)} ${text(raw.description)}`
  for (const [genre, pattern] of Object.entries({
    photography: /photo|camera/i,
    gaming: /gaming|esport|game night/i,
    books: /book|reading|literature/i,
    music: /music|concert|gig|jazz/i,
    food: /food|dining|tasting|brunch/i,
    sports: /sport|match|marathon|football/i,
    outdoor: /hiking|outdoor|nature walk/i,
    art: /gallery|exhibition|art|theatre/i,
    business: /networking|business|entrepreneur/i,
    tech: /tech|hackathon|developer|\bAI\b/i,
  }))
    if (pattern.test(label)) return genre as EventGenre
  return 'social'
}
function findCity(raw: RecordValue) {
  const chapter = record(raw.chapter),
    location = record(raw.location),
    address = record(location.address)
  const options = [raw.city, chapter.city, address.addressLocality, raw.district]
  for (const value of options) {
    const city = resolveCity(text(value))
    if (city) return city
  }
  if ([raw.city, chapter.city, address.addressLocality].some((value) => text(value).trim()))
    return undefined
  const fold = (value: string) =>
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/_/g, ' ')
  for (const value of [raw.location, raw.district, chapter.chapter_location, raw.title]) {
    const label = fold(text(value))
      .replace(/\bbengaluru\b/g, 'bangalore')
      .replace(/\bcalicut\b/g, 'kozhikode')
    const found = [...CITIES]
      .sort((a, b) => b.name.length - a.name.length)
      .find((city) => {
        const name = fold(city.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        return new RegExp(`(^|[\\s,(/-])${name}($|[\\s,)/-])`).test(label)
      })
    if (found) return found
  }
  return undefined
}
export function normalizeSourceEvent(
  value: unknown,
  source: string,
  collectedAt = new Date().toISOString(),
): PulseEvent {
  const raw = record(value),
    chapter = record(raw.chapter),
    location = record(raw.location),
    geo = record(location.geo),
    address = record(location.address)
  if (raw.is_test === true || raw.is_hidden === true || chapter.is_private === true)
    throw new Error('Test, hidden, or private source record')
  const isDevpost = source === 'devpost',
    legacy = source === 'pulse-import'
  const online =
    raw.isOnline === true ||
    raw.is_online === true ||
    raw.is_virtual === true ||
    /online|virtual/i.test(
      `${text(record(raw.displayed_location).location)} ${text(raw.event_attendance_type)} ${text(raw.eventAttendanceMode)} ${text(raw.location)} ${text(chapter.chapter_location)}`,
    ) ||
    /\b(online|virtual|webinar|livestream)\b/i.test(text(raw.title || raw.name))
  const city = findCity(raw)
  if (!online && !city)
    throw new Error('Physical event has no supported city; no substitute country pin was invented')
  const anchor = city ?? CITIES[0],
    host = record(raw.host),
    organizer = record(raw.organizer),
    offers = record(Array.isArray(raw.offers) ? raw.offers[0] : raw.offers)
  const genre = inferGenre(raw, source)
  let startTime = text(raw.start_date || raw.startDate || raw.startTime),
    endTime = text(raw.end_date || raw.endDate || raw.endTime)
  const period = isDevpost ? parseDevpostPeriod(text(raw.submission_period_dates)) : null
  if (period) {
    startTime = `${period[0]}T00:00:00Z`
    endTime = `${period[1]}T23:59:59Z`
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(startTime)) {
    const date = startTime
    const localTime = (value: unknown, fallback: string) => {
      if (!value) return fallback
      const time = text(value)
      if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time))
        throw new Error('Invalid local source time')
      return time.slice(0, 5)
    }
    startTime = zonedISO(
      date,
      localTime(raw.start_time, '') ||
        (/^\d{2}:\d{2}$/.test(text(raw.startTime)) ? text(raw.startTime) : '09:00'),
      anchor.id,
    )
    endTime = zonedISO(
      text(raw.end_date || raw.endDate) || date,
      localTime(raw.end_time, '') ||
        (/^\d{2}:\d{2}$/.test(text(raw.endTime)) ? text(raw.endTime) : '18:00'),
      anchor.id,
    )
  }
  if (isDevpost && !period) throw new Error('Unrecognized Devpost submission period')
  const url = safeHTTPS(raw.sourceUrl || raw.source_url || raw.url || raw.registrationUrl)
  if (!url) throw new Error('Missing official HTTPS source URL')
  const title = cleanText(raw.title || raw.name)
  if (!title) throw new Error('Missing event title')
  const organizerName =
    cleanText(
      host.name || raw.host_name || raw.organization_name || chapter.title || organizer.name,
    ) || source.toUpperCase()
  const officialLinks = (
    Array.isArray(raw.officialLinks)
      ? raw.officialLinks
      : Array.isArray(raw.official_links)
        ? raw.official_links
        : []
  )
    .map((item) => {
      const link = record(item)
      return { label: cleanText(link.label) || 'Official source', url: safeHTTPS(link.url) }
    })
    .filter((link) => link.url)
  const flags: string[] = []
  if (period) flags.push('Date-only submission window; confirm the exact deadline on the source')
  if (anchor.timezone === 'UTC' && !online)
    flags.push('City timezone unavailable; supplied timestamps retained')
  if (legacy)
    flags.push(
      'Historical Pulse snapshot; original authenticity claims have not been independently confirmed',
    )
  if (!safeHTTPS(raw.imageUrl || raw.mediaUrl || raw.thumbnail_url || raw.image))
    flags.push('Illustrative cover photo; the source did not supply one')
  if (raw.priceAmount === undefined && raw.price === undefined && offers.price === undefined)
    flags.push('Price was not supplied; confirm any fee on the official page')
  const price = number(raw.priceAmount ?? raw.price ?? offers.price)
  const event: PulseEvent = {
    id: sourceRecordId(raw, source),
    title,
    description:
      cleanText(raw.description) ||
      (isDevpost
        ? `A ${organizerName} hackathon. See the official page for eligibility, rules, prizes, and submission deadlines.`
        : 'See the official event page for the full program and registration details.'),
    genre,
    isOnline: online,
    city: anchor.id,
    country: online && !city ? 'Global' : anchor.country,
    state: text(raw.state || chapter.state) || anchor.state,
    venueName: online
      ? 'Online'
      : cleanText(location.name || raw.location || chapter.chapter_location) ||
        `${anchor.name} · approximate city location`,
    address: online
      ? 'Online'
      : cleanText(
          address.streetAddress ||
            raw.address ||
            raw.exactVenue ||
            raw.exact_venue ||
            chapter.chapter_location,
        ) || anchor.name,
    latitude: online ? 0 : number(raw.latitude ?? geo.latitude, anchor.center[0]),
    longitude: online ? 0 : number(raw.longitude ?? geo.longitude, anchor.center[1]),
    startTime,
    endTime,
    imageUrl:
      safeHTTPS(raw.imageUrl || raw.mediaUrl || raw.thumbnail_url || raw.image) || PHOTOS[genre],
    registrationUrl: url,
    priceTier: price > 0 ? 'paid' : 'free',
    priceAmount: price,
    priceKnown:
      raw.priceAmount !== undefined || raw.price !== undefined || offers.price !== undefined,
    currency: text(raw.currency || offers.priceCurrency) || anchor.currency,
    sourcePlatform:
      text(raw.sourcePlatform || raw.source_platform) ||
      (source === 'gdg' ? 'Google Developer Groups' : isDevpost ? 'Devpost' : source),
    sourceHash: '',
    isVerified: false,
    rating: number(raw.rating, 0),
    attendeesCount: number(raw.joinedCount ?? raw.joined_count ?? raw.registrations_count),
    maxGuests: legacy ? number(raw.maxPeople ?? raw.max_people, 0) || undefined : undefined,
    unlimited: isDevpost,
    minTrustScore: legacy ? number(raw.minTrustScore ?? raw.min_trust_score) : 0,
    privateVenue:
      legacy &&
      (raw.privateVenue === true ||
        raw.private_venue === true ||
        !!raw.exactVenue ||
        !!raw.exact_venue),
    exactVenue: legacy ? cleanText(raw.exactVenue || raw.exact_venue) : undefined,
    meetingUrl: legacy ? safeHTTPS(raw.meetingUrl || raw.meeting_url) : undefined,
    registrationStatus:
      raw.open_state === 'closed' || raw.registrationStatus === 'closed'
        ? 'closed'
        : raw.registrationStatus === 'waitlist'
          ? 'waitlist'
          : 'open',
    tags: (Array.isArray(raw.tags)
      ? raw.tags
      : Array.isArray(raw.themes)
        ? raw.themes.map((item) => record(item).name)
        : ['Tech', source]
    )
      .map(cleanText)
      .filter(Boolean),
    host: {
      id: `organizer-${organizerName.toLowerCase().replace(/\W/g, '')}`,
      name: organizerName,
      handle: text(host.handle || raw.host_handle) || `@${source}`,
      trustScore: legacy
        ? Math.max(0, Math.min(1000, number(host.trustScore ?? raw.host_trust)))
        : 0,
      isOrg: true,
    },
    officialLinks: [{ label: 'Official event & registration', url }, ...officialLinks],
    officialMentions: (Array.isArray(raw.officialMentions) ? raw.officialMentions : [])
      .map((item) => {
        const mention = record(item)
        return {
          title: cleanText(mention.title),
          url: safeHTTPS(mention.url),
          platform: cleanText(mention.platform),
        }
      })
      .filter((m) => m.url),
    provenance: legacy ? 'pulse-import' : 'collected',
    collectedAt,
    locationPrecision: online ? 'online' : 'city',
    concluded: raw.status === 'concluded',
    verification: { score: 0, flags, checkedAt: collectedAt },
  }
  return event
}
export function collectionTruthIssue(event: PulseEvent, now = Date.now()) {
  if (!Number.isFinite(+new Date(event.startTime)) || !Number.isFinite(+new Date(event.endTime)))
    return 'Invalid source schedule'
  if (+new Date(event.endTime) <= now || event.concluded) return 'Historical or concluded event'
  const edition = event.title.match(/\b20\d{2}\b/g)
  const startYear = new Date(event.startTime).getUTCFullYear()
  if (edition?.length === 1 && +edition[0] < startYear)
    return 'Edition year conflicts with the supplied date'
  if (
    /\b(event (?:has )?(?:ended|concluded)|past event)\b/i.test(
      `${event.title} ${event.description}`,
    )
  )
    return 'Source explicitly marks this event as concluded'
  return null
}
export function normalizeCollection(
  payload: unknown,
  existing: PulseEvent[] = [],
  includeHistorical = false,
) {
  const data = record(payload),
    collectedAt = text(data.collectedAt) || new Date().toISOString()
  const sources = Array.isArray(data.sources)
    ? data.sources
    : [{ id: 'pulse-import', payload: { events: data.events } }]
  const candidates: PulseEvent[] = [],
    issues: { title: string; reason: string }[] = []
  const excludedIds = new Set<string>()
  for (const value of sources) {
    const source = record(value),
      sourceData = record(source.payload)
    const rows = sourceData.results ?? sourceData.hackathons ?? sourceData.events
    if (!Array.isArray(rows)) continue
    for (const row of rows.slice(0, 3000)) {
      try {
        const native =
          text(source.id) === 'pulse-import' &&
          typeof record(row).sourceHash === 'string' &&
          typeof record(row).genre === 'string'
        const event = native
          ? verifyEvent(row as PulseEvent).event
          : normalizeSourceEvent(row, text(source.id), collectedAt)
        const issue = collectionTruthIssue(event)
        if (issue && !includeHistorical) {
          issues.push({ title: event.title, reason: issue })
          excludedIds.add(event.id)
          continue
        }
        if (issue || (text(source.id) === 'pulse-import' && !native)) event.archived = true
        candidates.push(event)
      } catch (error) {
        excludedIds.add(sourceRecordId(record(row), text(source.id)))
        issues.push({
          title: cleanText(record(row).title || record(row).name) || 'Untitled record',
          reason: String((error as Error).message),
        })
      }
    }
  }
  const result = verifyAndDeduplicate(candidates, existing)
  const updates = [
    ...verifyAndDeduplicate(
      candidates.filter(
        (event) =>
          event.provenance === 'collected' &&
          existing.some((old) => old.id === event.id && old.provenance === 'collected'),
      ),
    ).events,
    ...existing
      .filter((event) => event.provenance === 'collected' && excludedIds.has(event.id))
      .map((event) => ({
        ...event,
        archived: true,
        verification: {
          ...event.verification!,
          flags: [
            ...(event.verification?.flags ?? []),
            'Excluded by the latest source validation; retained in the archive',
          ],
        },
      })),
  ]
  return {
    ...result,
    updates,
    issues,
    rejected: result.rejected + issues.length,
    rawCount: candidates.length + issues.length,
  }
}
