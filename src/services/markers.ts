import L from 'leaflet'
import type { EventGenre } from '../domain'
import { genreInfo } from '../data/cities'

const paths: Record<string, string> = {
  music:
    'M9 18V5l12-2v13M9 9l12-2M6 18a3 3 0 1 0 0 6 3 3 0 0 0 0-6M18 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  tech: 'm8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16',
  food: 'M4 5h13v9a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V5m13 2h2a3 3 0 1 1 0 6h-2M3 22h17',
  art: 'M12 3a9 9 0 0 0 0 18h2a2 2 0 0 0 1-4 2 2 0 0 1 1-4h2a3 3 0 0 0 3-3 9 9 0 0 0-9-7M7 10h.01M10 7h.01M15 7h.01',
  nightlife: 'm5 3 14 0-7 9L5 3m7 9v9m-4 0h8',
  sports: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18',
  outdoor: 'm12 3-7 8h3l-5 7h7v4h4v-4h7l-5-7h3l-7-8',
  business: 'M4 7h16v14H4V7m4 0V3h8v4M4 12h16m-10 0v3h4v-3',
  social:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8m11 10v-2a4 4 0 0 0-3-4',
  photography: 'M3 7h5l2-3h4l2 3h5v14H3V7m9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  gaming: 'M5 7h14l3 13-5-3H7l-5 3L5 7m3 3v5m-2-2h4m6-2h.01m3 3h.01',
  books: 'M12 5C8 3 5 3 2 4v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-6-1-10 1v15',
}
const iconCache = new Map<string, L.DivIcon>()
export function createCustomPinIcon(
  genre: EventGenre,
  live: boolean,
  selected = false,
  sequence?: number,
) {
  const key = `${genre}-${live}-${selected}-${sequence}`
  if (iconCache.has(key)) return iconCache.get(key)!
  const color = genreInfo(genre).color
  const icon = L.divIcon({
    className: 'custom-pin',
    iconSize: [40, 48],
    iconAnchor: [20, 42],
    tooltipAnchor: [0, -43],
    html: `<div class="map-pin ${live ? 'live-marker-pulse' : ''} ${selected ? 'pin-selected' : ''}" style="--pin-color:${color}"><span>${sequence !== undefined ? `<b>${String(sequence).padStart(2, '0')}</b>` : `<svg viewBox="0 0 26 26" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[genre]}"/></svg>`}</span></div>`,
  })
  iconCache.set(key, icon)
  return icon
}
