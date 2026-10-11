import type { ItineraryStop, PulseEvent, TravelPlan, TripConfig } from '../domain'
import { addDate, eventDay, eventSlot } from './time'
import { estimateTransit, haversine } from './geo'
import { generateUUID } from './uuid'

export const dayCount = (start: string, end: string) =>
  Math.round((+new Date(`${end}T12:00Z`) - +new Date(`${start}T12:00Z`)) / 86400000) + 1
export const usdPrice = (e: PulseEvent) =>
  e.priceAmount / (e.currency === 'INR' ? 80 : e.currency === 'JPY' ? 150 : 1)
export function eligibleEvents(events: PulseEvent[], config: TripConfig) {
  return events.filter(
    (e) =>
      !e.isOnline &&
      !e.archived &&
      !e.concluded &&
      e.isVerified &&
      !e.isCustom &&
      e.city === config.destinationCity &&
      eventDay(e) >= config.startDate &&
      eventDay(e) <= config.endDate &&
      config.vibeTags.includes(e.genre) &&
      (config.budget === 'all' ||
        (config.budget === 'free' && e.priceTier === 'free' && e.priceKnown !== false) ||
        (config.budget === 'budget' && e.priceKnown !== false && usdPrice(e) < 25)),
  )
}
export function recalculateStops(stops: ItineraryStop[]): ItineraryStop[] {
  const ordered = [...stops].sort(
    (a, b) =>
      a.dayNumber - b.dayNumber || +new Date(a.event.startTime) - +new Date(b.event.startTime),
  )
  return ordered.map((stop, index) => {
    const prev = ordered[index - 1],
      sameDay = prev?.dayNumber === stop.dayNumber
    const distance = sameDay ? haversine(prev.event, stop.event) : 0,
      transit = sameDay ? estimateTransit(distance) : 0
    const gap = sameDay
      ? (+new Date(stop.event.startTime) - +new Date(prev.event.endTime)) / 60000
      : Infinity
    return {
      ...stop,
      sortOrder: ordered
        .filter((s) => s.dayNumber === stop.dayNumber)
        .findIndex((s) => s.id === stop.id),
      distanceKmFromPrev: distance,
      transitMinutesFromPrev: transit,
      tightConnection: gap < Math.max(45, transit),
    }
  })
}
export function generateItinerary(events: PulseEvent[], config: TripConfig): TravelPlan {
  const days = dayCount(config.startDate, config.endDate)
  if (days < 1 || days > 14 || !config.vibeTags.length)
    throw new Error('Choose a trip of 1–14 days and at least one vibe.')
  const candidates = eligibleEvents(events, config),
    stops: ItineraryStop[] = []
  const limit = { chill: 2, balanced: 3, packed: 4 }[config.pace]
  for (let day = 1; day <= days; day++) {
    const date = addDate(config.startDate, day - 1)
    const daily = candidates.filter((e) => eventDay(e) === date && eventSlot(e))
    const selected: PulseEvent[] = []
    const slots = ['morning', 'afternoon', 'evening', 'night'] as const
    const marquee = daily
      .filter((e) => e.genre === config.vibeTags[0])
      .sort(
        (a, b) =>
          b.rating - a.rating ||
          +new Date(a.startTime) - +new Date(b.startTime) ||
          a.id.localeCompare(b.id),
      )[0]
    for (const slot of ['morning', 'afternoon', 'evening', 'night'] as const) {
      if (selected.length >= limit) break
      const prev = selected.at(-1)
      if (!prev && marquee && slots.indexOf(slot) < slots.indexOf(eventSlot(marquee)!)) continue
      const viable = daily.filter(
        (e) =>
          eventSlot(e) === slot &&
          (!prev
            ? !marquee || e.id === marquee.id
            : +new Date(e.startTime) >=
              +new Date(prev.endTime) +
                Math.max(config.pace === 'chill' ? 180 : 45, estimateTransit(haversine(prev, e))) *
                  60000),
      )
      viable.sort((a, b) =>
        prev
          ? haversine(prev, a) - haversine(prev, b) || b.rating - a.rating
          : Number(b.genre === config.vibeTags[0]) - Number(a.genre === config.vibeTags[0]) ||
            b.rating - a.rating ||
            a.id.localeCompare(b.id),
      )
      if (viable[0]) selected.push(viable[0])
    }
    selected.forEach((event, index) =>
      stops.push({
        id: `stop-${day}-${event.id}`,
        event,
        dayNumber: day,
        slot: eventSlot(event)!,
        sortOrder: index,
        transitMinutesFromPrev: 0,
        distanceKmFromPrev: 0,
      }),
    )
  }
  return {
    ...config,
    id: generateUUID(),
    title: 'A city, your way',
    stops: recalculateStops(stops),
    createdAt: new Date().toISOString(),
  }
}
export function swapAlternatives(stop: ItineraryStop, plan: TravelPlan, events: PulseEvent[]) {
  const used = new Set(plan.stops.map((s) => s.event.id))
  return eligibleEvents(events, plan)
    .filter(
      (e) =>
        eventDay(e) === eventDay(stop.event) &&
        eventSlot(e) === stop.slot &&
        !used.has(e.id) &&
        haversine(e, stop.event) <= 5,
    )
    .filter((event) => {
      const next = recalculateStops(plan.stops.map((s) => (s.id === stop.id ? { ...s, event } : s)))
      return next.filter((s) => s.dayNumber === stop.dayNumber).every((s) => !s.tightConnection)
    })
    .sort((a, b) => haversine(a, stop.event) - haversine(b, stop.event))
}
