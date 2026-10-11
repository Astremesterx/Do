import { addDays, isSameDay, startOfDay } from 'date-fns'
import type { DiscoveryPreferences, EventGenre, PulseEvent, TimeFilter } from '../domain'
import { haversine } from './geo'
import { getCity } from '../data/cities'
import { isLive } from './time'
import { hostOf } from './community'
export interface EventFilters {
  city: string
  genre: EventGenre | 'all'
  time: TimeFilter
  date: string
  query: string
  radius: number
  online?: boolean
  saved?: string[]
  preferences?: Partial<DiscoveryPreferences>
  interests?: EventGenre[]
  following?: string[]
}
export function filterEvents(events: PulseEvent[], filters: EventFilters, now = new Date()) {
  const today = startOfDay(now),
    weekday = now.getDay()
  const weekend = addDays(today, weekday === 0 ? -1 : weekday === 6 ? 0 : 6 - weekday)
  const preferences = filters.preferences,
    city = getCity(filters.city)
  const center = preferences?.scope === 'nearby' ? (preferences.origin ?? city.center) : city.center
  const district =
    preferences?.scope === 'city' && preferences.district
      ? city.districts.find((d) => d.name === preferences.district)
      : undefined
  const radius = preferences?.scope === 'nearby' ? filters.radius || 10 : filters.radius
  const onlineSeen = new Set<string>()
  return events
    .filter((e) => {
      if (e.archived || e.concluded || e.isOnline !== !!filters.online) return false
      if (!e.isOnline && !filters.saved) {
        const scope = preferences?.scope ?? 'city'
        if (filters.city === 'all' || scope === 'global') {
          // Worldwide mode: show events globally across all cities and regions
        } else {
          if ((scope === 'city' || (scope === 'state' && !city.state)) && e.city !== filters.city)
            return false
          if (scope === 'state' && city.state && (e.state || getCity(e.city).state) !== city.state)
            return false
          if (scope === 'country' && e.country !== city.country) return false
          if (
            district &&
            !`${e.address} ${e.venueName} ${e.tags?.join(' ') ?? ''}`
              .toLowerCase()
              .includes(district.name.toLowerCase()) &&
            haversine(e, { latitude: district.point[0], longitude: district.point[1] }) > 10
          )
            return false
        }
      }
      if (preferences?.pricing === 'free' && (e.priceTier !== 'free' || e.priceKnown === false))
        return false
      if (preferences?.pricing === 'paid' && e.priceTier !== 'paid') return false
      if (preferences?.minTrust && hostOf(e).trustScore < preferences.minTrust) return false
      if (preferences?.interestsOnly && !filters.interests?.includes(e.genre)) return false
      if (preferences?.followingOnly && !filters.following?.includes(hostOf(e).id)) return false
      if (filters.saved && !filters.saved.includes(e.id)) return false
      if (filters.genre !== 'all' && e.genre !== filters.genre) return false
      if (+new Date(e.endTime) < +now) return false
      const start = new Date(e.startTime)
      if (filters.time === 'live' && !isLive(e, +now)) return false
      if (filters.time === 'today' && !isSameDay(start, today) && !isLive(e, +now)) return false
      if (filters.time === 'tomorrow' && !isSameDay(start, addDays(today, 1))) return false
      if (filters.time === 'week' && !(start < addDays(today, 7))) return false
      if (filters.time === 'upcoming' && (isLive(e, +now) || start >= addDays(today, 365)))
        return false
      if (filters.time === 'weekend' && !(start >= weekend && start < addDays(weekend, 2)))
        return false
      if (filters.time === 'date' && !isSameDay(start, new Date(`${filters.date}T12:00:00`)))
        return false
      if (
        filters.query &&
        !`${e.title} ${e.venueName} ${e.address} ${e.genre} ${e.country} ${e.tags?.join(' ') ?? ''}`
          .toLowerCase()
          .includes(filters.query.toLowerCase())
      )
        return false
      if (
        !e.isOnline &&
        filters.city !== 'all' &&
        preferences?.scope !== 'global' &&
        radius &&
        (!preferences || preferences.scope === 'city' || preferences.scope === 'nearby') &&
        haversine(e, { latitude: center[0], longitude: center[1] }) > radius
      )
        return false
      if (e.isOnline) {
        const key = `${e.title.toLowerCase()}-${e.startTime}`
        if (onlineSeen.has(key)) return false
        onlineSeen.add(key)
      }
      return true
    })
    .sort(
      (a, b) =>
        Number(isLive(b, +now)) - Number(isLive(a, +now)) ||
        +new Date(a.startTime) - +new Date(b.startTime) ||
        b.rating - a.rating,
    )
}
