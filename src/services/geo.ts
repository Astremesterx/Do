import type { PulseEvent } from '../domain'
export function haversine(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const rad = Math.PI / 180,
    dLat = (b.latitude - a.latitude) * rad,
    dLng = (b.longitude - a.longitude) * rad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(Math.min(1, h)))
}
export const estimateTransit = (km: number) => Math.max(10, Math.round((km / 25) * 60 + 10))
export function spreadMarkers(events: PulseEvent[]) {
  const groups = new Map<string, PulseEvent[]>()
  events.forEach((e) => {
    const key = `${e.latitude.toFixed(5)},${e.longitude.toFixed(5)}`
    groups.set(key, [...(groups.get(key) ?? []), e])
  })
  const points = new Map<string, [number, number]>()
  groups.forEach((group) =>
    group
      .sort((a, b) => a.id.localeCompare(b.id))
      .forEach((e, index) => {
        const r = group.length > 1 ? 0.00018 * (Math.floor(index / 8) + 1) : 0,
          theta = (2 * Math.PI * index) / group.length
        points.set(e.id, [e.latitude + r * Math.cos(theta), e.longitude + r * Math.sin(theta)])
      }),
  )
  return points
}
