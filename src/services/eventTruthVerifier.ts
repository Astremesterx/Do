import { sha256 } from 'js-sha256'
import type { PulseEvent } from '../domain'
import { CITIES, GENRES, getCity } from '../data/cities'
import { cityDate } from './time'

export function eventHash(event: Pick<PulseEvent, 'title' | 'startTime' | 'city'>) {
  const clean = event.title.trim().toLowerCase().replace(/\s+/g, ' ')
  return sha256(`${clean}${cityDate(event.startTime, event.city)}${event.city.toLowerCase()}`)
}
export function validCoordinate(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !!lat &&
    !!lng &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  )
}
function httpsURL(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}
export function verifyEvent(input: PulseEvent): { event: PulseEvent; repaired: boolean } {
  if (
    !input ||
    typeof input.id !== 'string' ||
    !input.id.trim() ||
    typeof input.title !== 'string' ||
    typeof input.description !== 'string' ||
    typeof input.address !== 'string' ||
    typeof input.venueName !== 'string' ||
    typeof input.country !== 'string' ||
    typeof input.sourcePlatform !== 'string' ||
    typeof input.registrationUrl !== 'string' ||
    typeof input.isOnline !== 'boolean'
  )
    throw new Error('Invalid event record')
  if (!CITIES.some((c) => c.id === input.city)) throw new Error('Unsupported city')
  if (
    !GENRES.some((g) => g.id === input.genre) ||
    !['free', 'paid', 'invite'].includes(input.priceTier) ||
    !Number.isFinite(input.priceAmount) ||
    input.priceAmount < 0 ||
    !/^[A-Z]{3}$/.test(input.currency)
  )
    throw new Error('Invalid event category or price')
  if (
    !input.title.trim() ||
    !Number.isFinite(+new Date(input.startTime)) ||
    !Number.isFinite(+new Date(input.endTime)) ||
    +new Date(input.endTime) <= +new Date(input.startTime)
  )
    throw new Error('Invalid event details or timestamps')
  const event = { ...input, title: input.title.trim(), description: input.description.trim() }
  const stringList = (value: unknown) =>
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  if (
    (event.tags !== undefined && !stringList(event.tags)) ||
    (event.verification !== undefined && !stringList(event.verification?.flags)) ||
    [event.state, event.exactVenue, event.meetingUrl, event.collectedAt].some(
      (value) => value !== undefined && typeof value !== 'string',
    ) ||
    [
      event.priceKnown,
      event.isCustom,
      event.privateVenue,
      event.unlimited,
      event.concluded,
      event.archived,
    ].some((value) => value !== undefined && typeof value !== 'boolean') ||
    (event.provenance !== undefined &&
      !['demo', 'community', 'collected', 'pulse-import'].includes(event.provenance)) ||
    (event.locationPrecision !== undefined &&
      !['venue', 'district', 'city', 'online'].includes(event.locationPrecision))
  )
    throw new Error('Invalid event metadata')
  if (event.registrationUrl && !httpsURL(event.registrationUrl))
    throw new Error('Registration links must use HTTPS')
  if (
    typeof event.imageUrl !== 'string' ||
    !(
      httpsURL(event.imageUrl) ||
      /^\/images\/[\w.-]+$/.test(event.imageUrl) ||
      /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/i.test(event.imageUrl)
    )
  )
    throw new Error('Unsupported cover image')
  if (event.meetingUrl && !httpsURL(event.meetingUrl))
    throw new Error('Meeting links must use HTTPS')
  if (
    (event.officialLinks !== undefined &&
      (!Array.isArray(event.officialLinks) ||
        event.officialLinks.some(
          (link) => typeof link?.label !== 'string' || !httpsURL(link.url),
        ))) ||
    (event.officialMentions !== undefined &&
      (!Array.isArray(event.officialMentions) ||
        event.officialMentions.some(
          (link) => typeof link?.title !== 'string' || !httpsURL(link.url),
        )))
  )
    throw new Error('Official links must use HTTPS')
  if (
    event.registrationStatus &&
    !['open', 'closed', 'waitlist'].includes(event.registrationStatus)
  )
    throw new Error('Invalid registration status')
  if (event.maxGuests !== undefined && (!Number.isInteger(event.maxGuests) || event.maxGuests < 1))
    throw new Error('Invalid guest capacity')
  if (
    event.minTrustScore !== undefined &&
    (!Number.isFinite(event.minTrustScore) || event.minTrustScore < 0 || event.minTrustScore > 1000)
  )
    throw new Error('Invalid trust requirement')
  if (
    event.host &&
    (typeof event.host.id !== 'string' ||
      typeof event.host.name !== 'string' ||
      typeof event.host.handle !== 'string' ||
      !Number.isFinite(event.host.trustScore))
  )
    throw new Error('Invalid event host')
  event.rating = Number.isFinite(event.rating) ? Math.max(0, Math.min(5, event.rating ?? 0)) : 0
  event.attendeesCount = Number.isFinite(event.attendeesCount)
    ? Math.max(0, Math.floor(event.attendeesCount ?? 0))
    : 0
  const [minLat, maxLat, minLng, maxLng] = getCity(event.city).bounds
  const valid =
    validCoordinate(event.latitude, event.longitude) &&
    event.latitude >= minLat &&
    event.latitude <= maxLat &&
    event.longitude >= minLng &&
    event.longitude <= maxLng
  if (!event.isOnline && !valid) {
    // District anchors are land-verified; a broad city box alone cannot certify water.
    const district =
      getCity(event.city).districts.find((d) =>
        event.address.toLowerCase().includes(d.name.toLowerCase()),
      ) ?? getCity(event.city).districts[0]
    ;[event.latitude, event.longitude] = district.point
  }
  // Unknown coordinates inside the city box also snap to a known land anchor.
  const nearby = getCity(event.city).districts.some(
    (d) =>
      Math.abs(d.point[0] - event.latitude) < 0.004 &&
      Math.abs(d.point[1] - event.longitude) < 0.004,
  )
  if (!event.isOnline && !nearby) {
    const nearest = [...getCity(event.city).districts].sort(
      (a, b) =>
        Math.hypot(a.point[0] - event.latitude, a.point[1] - event.longitude) -
        Math.hypot(b.point[0] - event.latitude, b.point[1] - event.longitude),
    )[0]
    ;[event.latitude, event.longitude] = nearest.point
  }
  event.sourceHash = eventHash(event)
  event.isVerified = true
  const repaired = !event.isOnline && (!valid || !nearby)
  if (repaired && event.provenance === 'collected') event.locationPrecision = 'city'
  event.verification = {
    score:
      event.provenance === 'collected'
        ? repaired || event.locationPrecision === 'city'
          ? 70
          : 85
        : event.provenance === 'pulse-import'
          ? 50
          : 80,
    checkedAt: new Date().toISOString(),
    flags: [
      ...new Set([
        ...(event.verification?.flags ?? []),
        ...(repaired ? ['Location snapped to a known city/district anchor'] : []),
        ...(event.provenance === 'demo' ? ['Simulated event'] : []),
      ]),
    ],
  }
  return { event, repaired }
}
export function verifyAndDeduplicate(inputs: PulseEvent[], existing: PulseEvent[] = []) {
  const hashes = new Set(existing.map((e) => e.sourceHash))
  const ids = new Set(existing.map((e) => e.id))
  const events: PulseEvent[] = []
  let repaired = 0,
    duplicates = 0,
    rejected = 0
  for (const input of inputs) {
    try {
      const result = verifyEvent(input)
      if (hashes.has(result.event.sourceHash) || ids.has(result.event.id)) {
        duplicates++
        continue
      }
      hashes.add(result.event.sourceHash)
      ids.add(result.event.id)
      events.push(result.event)
      if (result.repaired) repaired++
    } catch {
      rejected++
    }
  }
  return { events, repaired, duplicates, rejected }
}
