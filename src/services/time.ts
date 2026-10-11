import { addDays, format, startOfDay } from 'date-fns'
import type { PulseEvent, Slot } from '../domain'
import { getCity } from '../data/cities'

export const localDate = (date = new Date()) => format(date, 'yyyy-MM-dd')
export const addDate = (date: string, days: number) =>
  format(addDays(new Date(`${date}T12:00:00`), days), 'yyyy-MM-dd')
export function cityDate(value: string | Date, city: string) {
  try {
    const tz = getCity(city)?.timezone || 'UTC'
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(value))
  } catch {
    return localDate()
  }
}
export const cityHour = (value: string, city: string) => {
  try {
    const tz = getCity(city)?.timezone || 'UTC'
    return Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(value)),
    )
  } catch {
    return 12
  }
}
export const cityTime = (value: string, city: string) => {
  try {
    const tz = getCity(city)?.timezone || 'UTC'
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(value))
  } catch {
    return ''
  }
}
export const browserTime = (value: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
  } catch {
    return ''
  }
}
export const isLive = (event: PulseEvent, now = Date.now()) =>
  !event.archived &&
  !event.concluded &&
  +new Date(event.startTime) <= now &&
  +new Date(event.endTime) > now
export const dayStart = (date: string) => +startOfDay(new Date(date))
export function eventDay(event: PulseEvent) {
  const date = cityDate(event.startTime, event.city)
  return cityHour(event.startTime, event.city) < 2 ? addDate(date, -1) : date
}
export function eventSlot(event: PulseEvent): Slot | null {
  const hour = cityHour(event.startTime, event.city)
  const minute = Number(cityTime(event.startTime, event.city).slice(3))
  const h = hour + minute / 60
  if (h >= 8.5 && h < 12.5) return 'morning'
  if (h >= 12.5 && h < 17) return 'afternoon'
  if (h >= 17 && h < 21) return 'evening'
  if (h >= 21 || h < 2) return 'night'
  return null
}
export function countdown(value: string, now = Date.now()) {
  try {
    const target = +new Date(value)
    if (isNaN(target)) return 'Upcoming'
    const mins = Math.ceil((target - now) / 60000)
    if (mins <= 0) return 'Live now'
    if (mins < 60) return `Starts in ${mins} min`
    if (mins < 1440) return `Starts in ${Math.floor(mins / 60)}h ${mins % 60}m`
    return `Starts in ${Math.ceil(mins / 1440)} days`
  } catch {
    return 'Upcoming'
  }
}
export function formatPrice(event: PulseEvent) {
  if (event.priceKnown === false) return 'Check source'
  if (event.priceTier === 'free') return 'Free'
  if (event.priceTier === 'invite') return 'Invite only'
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: event.currency || 'USD',
      maximumFractionDigits: 0,
    }).format(event.priceAmount || 0)
  } catch {
    return event.priceAmount ? `${event.priceAmount}` : 'Free'
  }
}
export function zonedISO(date: string, time: string, cityId: string) {
  // Derive the zone offset for this date, including daylight-saving transitions.
  const city = getCity(cityId)
  const provisional = new Date(`${date}T${time}:00Z`)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: city.timezone,
    timeZoneName: 'longOffset',
  }).formatToParts(provisional)
  const offset =
    (parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT').replace('GMT', '') || '+00:00'
  return new Date(`${date}T${time}:00${offset}`).toISOString()
}
