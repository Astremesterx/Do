import type { PulseEvent, TravelPlan, TripConfig } from '../domain'
import { CITIES } from '../data/cities'
import { dayCount } from './itineraryEngine'

const escapeICS = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,')
const stamp = (date: string) =>
  new Date(date)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
function foldLine(line: string) {
  const lines: string[] = []
  let part = '',
    bytes = 0
  for (const char of line) {
    const length = new TextEncoder().encode(char).length
    if (bytes + length > 75) {
      lines.push(part)
      part = ' '
      bytes = 1
    }
    part += char
    bytes += length
  }
  lines.push(part)
  return lines.join('\r\n')
}
export function createICS(events: PulseEvent[]) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DO//Event Itinerary//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events.flatMap((e) => [
      'BEGIN:VEVENT',
      `UID:${e.id}@do.local`,
      `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(e.startTime)}`,
      `DTEND:${stamp(e.endTime)}`,
      `SUMMARY:${escapeICS(e.title)}`,
      `LOCATION:${escapeICS(e.isOnline ? 'Online' : e.address)}`,
      `DESCRIPTION:${escapeICS(`${e.description}\n${e.registrationUrl}`)}`,
      `URL:${e.registrationUrl}`,
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ]
  return lines.map(foldLine).join('\r\n') + '\r\n'
}
export function downloadFile(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.hidden = true
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export const exportCalendar = (events: PulseEvent[], name = 'do-events') =>
  downloadFile(createICS(events), `${name}.ics`, 'text/calendar;charset=utf-8')
export const exportPlan = (plan: TravelPlan) =>
  downloadFile(JSON.stringify(plan, null, 2), 'do-trip.json', 'application/json')
export function shareURL(plan: TravelPlan) {
  const config: TripConfig = {
    destinationCity: plan.destinationCity,
    startDate: plan.startDate,
    endDate: plan.endDate,
    vibeTags: plan.vibeTags,
    pace: plan.pace,
    budget: plan.budget,
  }
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('trip', JSON.stringify(config))
  return url.toString()
}
export function validateTripConfig(value: unknown): value is TripConfig {
  if (!value || typeof value !== 'object') return false
  const v = value as TripConfig
  const genres = ['tech', 'music', 'nightlife', 'food', 'art', 'sports', 'business', 'outdoor']
  return (
    CITIES.some((c) => c.id === v.destinationCity) &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.startDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.endDate) &&
    Number.isFinite(+new Date(v.startDate)) &&
    dayCount(v.startDate, v.endDate) >= 1 &&
    dayCount(v.startDate, v.endDate) <= 14 &&
    Array.isArray(v.vibeTags) &&
    v.vibeTags.length > 0 &&
    v.vibeTags.every((g) => genres.includes(g)) &&
    ['chill', 'balanced', 'packed'].includes(v.pace) &&
    ['free', 'budget', 'all'].includes(v.budget)
  )
}
export function importPlanJSON(text: string): TravelPlan {
  const data = JSON.parse(text) as TravelPlan
  if (!validateTripConfig(data) || !Array.isArray(data.stops))
    throw new Error('This file is not a valid DO trip.')
  return data
}
