import type { EventGenre, PulseEvent } from '../domain'
import { CITIES } from '../data/cities'
import { generateSeedEvents } from '../data/mockEvents'
import { verifyAndDeduplicate } from './eventTruthVerifier'
import { addDate, cityDate, zonedISO } from './time'
import { buildExactEventUrl } from './eventUrls'

export interface ScraperAdapter {
  name: string
  extract: () => Promise<PulseEvent[]>
}
const wait = () => new Promise<void>((resolve) => setTimeout(resolve, 300))
const sourceGenres: EventGenre[][] = [
  ['tech', 'art', 'business'],
  ['tech', 'business', 'outdoor', 'sports'],
  ['music', 'food', 'nightlife', 'art'],
  ['tech'],
  ['music', 'food', 'art', 'nightlife', 'outdoor', 'sports'],
]
export const adapters: ScraperAdapter[] = [
  'Luma',
  'Meetup',
  'Eventbrite',
  'Devpost',
  'Local venues',
].map((name, index) => ({
  name,
  async extract() {
    await wait()
    const seeds = generateSeedEvents().filter((e) => !e.isOnline)
    return CITIES.slice(0, 5).map((city, i) => {
      const cityCandidates = seeds.filter(
        (e) => e.city === city.id && sourceGenres[index].includes(e.genre),
      )
      const genreCandidates = seeds.filter((e) => sourceGenres[index].includes(e.genre))
      const template =
        cityCandidates[(index + i) % cityCandidates.length] ||
        genreCandidates[(index + i) % genreCandidates.length] ||
        seeds[0]
      const e = { ...template, city: city.id }
      const startTime = zonedISO(
        addDate(cityDate(new Date(), e.city), 1 + (i % 3)),
        '13:30',
        e.city,
      )
      const title = `${e.title} — ${['community session', 'local collective', 'weekend special', 'buildathon edition', 'neighborhood edition'][index]}`
      const registrationUrl = buildExactEventUrl({
        platform: name,
        title,
        cityId: e.city,
        venueName: e.venueName,
        genre: e.genre,
        seedKey: `ingested-${index}-${e.city}`,
        isOnline: false,
      })
      const targetCity = CITIES.find((c) => c.id === city.id) || city
      const coords: [number, number] =
        cityCandidates.length > 0 && template.city === city.id
          ? [template.latitude, template.longitude]
          : [targetCity.center[0], targetCity.center[1]]
      return {
        ...e,
        id: `ingested-${index}-${e.city}-${startTime.slice(0, 10)}`,
        title,
        sourcePlatform: name,
        registrationUrl,
        startTime,
        endTime: new Date(+new Date(startTime) + 90 * 60000).toISOString(),
        latitude: i === 0 ? 0 : coords[0],
        longitude: i === 0 ? 0 : coords[1],
      }
    })
  },
}))
export async function simulateIngestion(
  existing: PulseEvent[],
  onProgress: (source: string) => void,
) {
  const raw: PulseEvent[] = []
  for (const adapter of adapters) {
    onProgress(adapter.name)
    raw.push(...(await adapter.extract()))
  }
  // Mirror a duplicate feed record and an invalid record to exercise guardrails.
  raw.push(
    { ...raw[0], id: 'duplicate-record' },
    { ...raw[0], id: 'bad-record', startTime: 'invalid' },
  )
  return verifyAndDeduplicate(raw, existing)
}
