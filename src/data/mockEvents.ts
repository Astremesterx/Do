import type { EventGenre, ImFreeBeacon, PulseEvent } from '../domain'
import { CITIES } from './cities'
import { isSameDay } from 'date-fns'
import { addDate, cityDate, zonedISO } from '../services/time'
import { verifyAndDeduplicate } from '../services/eventTruthVerifier'
import { buildExactEventUrl } from '../services/eventUrls'

export const PHOTOS: Record<EventGenre, string> = {
  music: '/images/music.jpg',
  tech: '/images/tech.jpg',
  food: '/images/food.jpg',
  art: '/images/art.jpg',
  nightlife: '/images/nightlife.jpg',
  outdoor: '/images/outdoor.jpg',
  sports: '/images/outdoor.jpg',
  business: '/images/tech.jpg',
  social: '/images/food.jpg',
  photography: '/images/art.jpg',
  gaming: '/images/tech.jpg',
  books: '/images/art.jpg',
}
const titles: Record<EventGenre, string[]> = {
  social: [
    'Coffee with the curious',
    'New faces, familiar places',
    'A table for everyone',
    'Hello, neighbor',
  ],
  photography: [
    'Golden hour photo walk',
    'The city through a lens',
    'Street stories',
    'Frame a different view',
  ],
  gaming: [
    'Community game night',
    'Board games & good company',
    'Indie game makers',
    'The weekend esports room',
  ],
  books: [
    'Silent reading, shared company',
    'Bring a book, take a book',
    'A chapter together',
    'The neighborhood book club',
  ],
  music: [
    'Afterglow: rooftop sessions',
    'Jazz, under the stars',
    'The indie listening room',
    'Vinyl & good company',
  ],
  tech: [
    'Build something that matters',
    'AI, coffee & curious minds',
    'The makers’ weekend',
    'Designing what comes next',
  ],
  food: [
    'A little taste of everywhere',
    'The Sunday supper club',
    'Coffee, slow mornings',
    'Street food after hours',
  ],
  art: [
    'Outside the frame',
    'An evening of art & conversation',
    'Sketch the city',
    'Stories in the gallery',
  ],
  nightlife: [
    'Midnight frequency',
    'Nocturne: a house music affair',
    'Above the city lights',
    'The after-hours collective',
  ],
  outdoor: [
    'A slower kind of Saturday',
    'Golden hour city walk',
    'Breathe in, wander out',
    'Sunrise with strangers',
  ],
  sports: [
    'Move together: park run',
    'Courtside community',
    'The weekend cycling club',
    'Yoga on the green',
  ],
  business: [
    'Founders, off the clock',
    'Ideas over aperitivo',
    'The creative breakfast',
    'Small talk, big ideas',
  ],
}
const descriptions: Record<EventGenre, string> = {
  social:
    'A welcoming, relaxed gathering for meeting people in your neighborhood. Come alone or bring a friend; everyone is welcome.',
  photography:
    'Explore familiar streets through a different lens. Bring a camera or your phone and share your favorite frames with a friendly local group.',
  gaming:
    'An easygoing community game session with welcoming tables for beginners and experienced players. Your host will share the games and equipment details.',
  books:
    'Make room for reading, thoughtful conversations, and your next favorite book. Bring a book and meet your local reading community.',
  music:
    'An intimate gathering for people who believe the best nights have a soundtrack. Discover independent artists, meet fellow music lovers, and let the evening unfold. Come as you are; leave with a new favorite song.',
  tech: 'A room full of curious people and things worth building. Join local makers, designers, and developers for practical conversations, live demos, and a little inspiration. All experience levels welcome.',
  food: 'Good food has a way of bringing people together. Explore a carefully curated menu, stories from local makers, and a shared table with soon-to-be friends. Vegetarian options available.',
  art: 'Step away from the everyday and into something unexpected. Explore local creative voices, original work, and conversations that linger long after you leave. No art knowledge required.',
  nightlife:
    'Find your rhythm above the city. A thoughtfully selected lineup, a welcoming dance floor, and a night for making memories. Ages 21+. Bring a valid ID.',
  outdoor:
    'A little fresh air and a different perspective. Join a friendly local group for an easy-paced exploration of the city’s green spaces. Bring water and comfortable shoes.',
  sports:
    'Get moving with a welcoming crew. This is about showing up, having fun, and finding your community. Beginners welcome; your host will share equipment details after registration.',
  business:
    'Trade the formal introductions for real conversations. Meet founders, freelancers, and creative people from your city in a relaxed setting. Bring a story, an idea, or just your curiosity.',
}
const genres: EventGenre[] = [
  'food',
  'tech',
  'art',
  'music',
  'nightlife',
  'outdoor',
  'business',
  'sports',
]
const VENUE_OFFSETS: [number, number][] = [
  [0.0028, 0.0035],   // Venue 0: ~380m northeast
  [-0.0032, 0.0041],  // Venue 1: ~460m southeast
  [0.0045, -0.0026],  // Venue 2: ~520m northwest
  [-0.0021, -0.0039], // Venue 3: ~430m southwest
  [0.0016, 0.0052],   // Venue 4: ~540m east
  [-0.0054, 0.0018],  // Venue 5: ~610m south
  [0.0036, -0.0048],  // Venue 6: ~580m northwest
  [-0.0042, -0.0032], // Venue 7: ~530m southwest
]

function clampToCityBounds(
  lat: number,
  lng: number,
  bounds: [number, number, number, number],
): [number, number] {
  const [minLat, maxLat, minLng, maxLng] = bounds
  const margin = 0.0015
  return [
    Math.max(minLat + margin, Math.min(maxLat - margin, Number(lat.toFixed(6)))),
    Math.max(minLng + margin, Math.min(maxLng - margin, Number(lng.toFixed(6)))),
  ]
}

const hours = ['10:00', '13:30', '16:00', '19:00', '22:00', '09:00', '14:00', '17:00']
const durations = [90, 105, 90, 120, 150, 90, 105, 90]

export function generateSeedEvents(now = new Date(), cityCount?: number): PulseEvent[] {
  const result: PulseEvent[] = []
  const seedCityIds = [
    'bangalore',
    'tokyo',
    'berlin',
    'san_francisco',
    'barcelona',
    'kochi',
    'kozhikode',
    'trivandrum',
    'thrissur',
    'kannur',
    'kollam',
    'alappuzha',
    'kottayam',
    'palakkad',
    'malappuram',
    'wayanad',
    'idukki',
    'kasaragod',
    'pathanamthitta',
    'mumbai',
    'delhi',
    'chennai',
    'hyderabad',
    'pune',
    'goa',
    'coimbatore',
    'mysore',
    'mangalore',
    'kolkata',
    'ahmedabad',
    'jaipur',
    'chandigarh',
    'london',
    'paris',
    'new_york',
    'dubai',
    'singapore',
  ]
  const effectiveCount = cityCount ?? seedCityIds.length
  const seedCities = seedCityIds
    .map((id) => CITIES.find((c) => c.id === id))
    .filter((c): c is (typeof CITIES)[0] => Boolean(c))
    .slice(0, effectiveCount)
  for (const city of seedCities.length ? seedCities : CITIES.slice(0, effectiveCount)) {
    const today = cityDate(now, city.id)
    for (let day = 0; day < 10; day++) {
      for (let i = 0; i < 8; i++) {
        const genre = genres[i],
          district = city.districts.length
            ? city.districts[(i + day) % city.districts.length]
            : { name: city.name, point: city.center }
        let startTime = zonedISO(addDate(today, day), hours[i], city.id)
        // Two live demo happenings per city stay useful at any local startup time.
        if (day === 0) {
          if (i === 1 || i === 3) {
            startTime = new Date(+now - (i === 3 ? 45 : 20) * 60000).toISOString()
          } else {
            const offsetMinutes = i * 75 + 30
            const candidate = new Date(+now + offsetMinutes * 60000)
            if (isSameDay(candidate, now)) {
              startTime = candidate.toISOString()
            }
          }
        }
        const free = (i + day) % 3 === 0 || genre === 'outdoor'
        const basePrice = [18, 10, 12, 22, 25, 0, 15, 8][i]
        const rate = city.currency === 'INR' ? 80 : city.currency === 'JPY' ? 150 : 1
        const venue =
          city.id === 'bangalore'
            ? [
                `${district.name} Social Kitchen`,
                `${district.name} Makers Studio`,
                `${district.name} Art House`,
                `${district.name} Listening Room`,
                `${district.name} Rooftop Club`,
                `${district.name} Walking Club`,
                `${district.name} Social House`,
                `${district.name} Sports Club`,
              ][i]
            : `${district.name} ${['Kitchen & Lounge', 'Creative Studio', 'Art Gallery', 'Acoustic Sessions', 'Social Club', 'Open Gardens', 'Collective', 'Club House'][i]}`
        const offset = VENUE_OFFSETS[i % VENUE_OFFSETS.length]
        const [venueLat, venueLng] = clampToCityBounds(
          district.point[0] + offset[0],
          district.point[1] + offset[1],
          city.bounds,
        )
        const platform = ['Luma', 'Meetup', 'Eventbrite', 'Local venues'][i % 4]
        const eventTitle = titles[genre][(day + (city.id === 'bangalore' ? 0 : 1)) % 4]
        const exactRegistrationUrl = buildExactEventUrl({
          platform,
          title: eventTitle,
          cityId: city.id,
          venueName: venue,
          genre,
          seedKey: `seed-${city.id}-${day}-${i}`,
          isOnline: false,
        })
        const primary: PulseEvent = {
          id: `seed-${city.id}-${day}-${i}`,
          title: eventTitle,
          description: descriptions[genre],
          genre,
          isOnline: false,
          venueName: venue,
          address: `${venue}, ${district.name}, ${city.name}`,
          city: city.id,
          country: city.country,
          latitude: venueLat,
          longitude: venueLng,
          startTime,
          endTime: new Date(+new Date(startTime) + durations[i] * 60000).toISOString(),
          imageUrl: PHOTOS[genre],
          registrationUrl: exactRegistrationUrl,
          priceTier: free ? 'free' : 'paid',
          priceAmount: free ? 0 : basePrice * rate,
          currency: city.currency,
          sourcePlatform: platform,
          sourceHash: '',
          isVerified: true,
          attendeesCount: 18 + ((day * 13 + i * 29) % 240),
          rating: Math.round((4.4 + ((day + i) % 6) / 10) * 10) / 10,
          provenance: 'demo',
          locationPrecision: 'district',
          registrationStatus: 'open',
          host: {
            id: `host-${city.id}-${i % 4}`,
            name: `${city.name} ${['Neighbors', 'Makers', 'Creative Club', 'Gatherings'][i % 4]}`,
            handle: `@${city.id}_${i % 4}`,
            trustScore: 650 + i * 35,
            isOrg: i === 1,
          },
          maxGuests: 300,
          minTrustScore: i === 4 ? 750 : 0,
          tags: [genre, district.name],
          state: city.state,
        }
        result.push(primary)
        if (i === 0 || i === 2) {
          const altOffset = i === 0 ? [-0.0018, 0.0024] : [0.0022, -0.0042]
          const [altLat, altLng] = clampToCityBounds(
            district.point[0] + altOffset[0],
            district.point[1] + altOffset[1],
            city.bounds,
          )
          const altTitle = i === 0 ? 'The neighborhood table' : 'Open studio, open minds'
          const altVenue = `${district.name} ${i === 0 ? 'Supper Club' : 'Creative Studio'}`
          const altPlatform = i === 0 ? 'Luma' : 'Local venues'
          const altUrl = buildExactEventUrl({
            platform: altPlatform,
            title: altTitle,
            cityId: city.id,
            venueName: altVenue,
            genre,
            seedKey: `${primary.id}-alternative`,
            isOnline: false,
          })
          result.push({
            ...primary,
            id: `${primary.id}-alternative`,
            title: altTitle,
            venueName: altVenue,
            latitude: altLat,
            longitude: altLng,
            rating: 4.3,
            attendeesCount: 24 + day * 3,
            priceTier: 'free',
            priceAmount: 0,
            sourcePlatform: altPlatform,
            registrationUrl: altUrl,
          })
        }
      }
    }
    for (let i = 0; i < 4; i++) {
      const startTime =
        i === 0
          ? new Date(+now - 15 * 60000).toISOString()
          : new Date(+now + i * 90 * 60000).toISOString()
      const onlineTitle = [
        'AI without the hype: a live conversation',
        'Design systems, human stories',
        'Build your first creative AI tool',
        'Independent artists, global stage',
      ][i]
      const onlineUrl = buildExactEventUrl({
        platform: 'Luma',
        title: onlineTitle,
        cityId: city.id,
        genre: i === 3 ? 'music' : 'tech',
        seedKey: `online-${city.id}-${i}`,
        isOnline: true,
      })
      result.push({
        id: `online-${city.id}-${i}`,
        title: onlineTitle,
        description:
          'Join a thoughtful global community for a live online session. Bring your questions, share your perspective, and meet people who are curious about the same things. A replay will be shared with registered attendees.',
        genre: i === 3 ? 'music' : 'tech',
        isOnline: true,
        venueName: 'Online · live community session',
        address: 'Online',
        city: city.id,
        country: city.country,
        latitude: 0,
        longitude: 0,
        startTime,
        endTime: new Date(+new Date(startTime) + 90 * 60000).toISOString(),
        imageUrl: PHOTOS[i === 3 ? 'music' : 'tech'],
        registrationUrl: onlineUrl,
        priceTier: 'free',
        priceAmount: 0,
        currency: city.currency,
        sourcePlatform: 'Luma',
        sourceHash: '',
        isVerified: true,
        attendeesCount: 86 + i * 35,
        rating: 4.8,
        provenance: 'demo',
        locationPrecision: 'online',
        registrationStatus: 'open',
      })
    }
  }
  const extraTargetCities = (seedCities.length ? seedCities : CITIES.slice(0, cityCount)).slice(0, 7)
  for (const city of extraTargetCities) {
    for (const [i, genre] of (
      ['social', 'photography', 'gaming', 'books'] as EventGenre[]
    ).entries()) {
      const district = city.districts[i],
        startTime = zonedISO(addDate(cityDate(now, city.id), 1), '16:00', city.id)
      const [extraLat, extraLng] = clampToCityBounds(
        district.point[0] - 0.0018,
        district.point[1] + 0.0022,
        city.bounds,
      )
      const extraTitle = titles[genre][0]
      const extraVenue = `${district.name} Community Club`
      const extraPlatform = genre === 'gaming' ? 'Luma' : 'Meetup'
      const extraUrl = buildExactEventUrl({
        platform: extraPlatform,
        title: extraTitle,
        cityId: city.id,
        venueName: extraVenue,
        genre,
        seedKey: `seed-extra-${city.id}-${genre}`,
        isOnline: genre === 'gaming',
      })
      result.push({
        id: `seed-extra-${city.id}-${genre}`,
        title: extraTitle,
        description: descriptions[genre],
        genre,
        city: city.id,
        country: city.country,
        isOnline: genre === 'gaming',
        venueName: extraVenue,
        address: `${district.name}, ${city.name}`,
        latitude: extraLat,
        longitude: extraLng,
        startTime,
        endTime: new Date(+new Date(startTime) + 90 * 60000).toISOString(),
        imageUrl: PHOTOS[genre],
        registrationUrl: extraUrl,
        priceTier: 'free',
        priceAmount: 0,
        currency: city.currency,
        sourcePlatform: extraPlatform,
        sourceHash: '',
        isVerified: true,
        rating: 4.8,
        attendeesCount: 5,
        maxGuests: 12,
        provenance: 'demo',
        tags: [genre],
        state: city.state,
        host: {
          id: `host-${city.id}-neighbors`,
          name: `${city.name} Neighbors`,
          handle: `@${city.id}_neighbors`,
          trustScore: 780,
        },
      })
    }
  }
  return verifyAndDeduplicate(result).events
}
export function generateBeacons(): ImFreeBeacon[] {
  return CITIES.slice(0, 7).flatMap((city) =>
    ['Maya', 'Alex', 'Riya'].map((name, i) => ({
      id: `beacon-${city.id}-${i}`,
      userId: `friend-${i}`,
      userName: name,
      userAvatar: ['M', 'A', 'R'][i],
      latitude: city.districts[i * 2].point[0] + 0.002,
      longitude: city.districts[i * 2].point[1] - 0.002,
      city: city.id,
      vibeMessage: [
        'Coffee & a good conversation',
        'Exploring local galleries',
        'Finding the next great gig',
      ][i],
      expiresAt: new Date(Date.now() + 3 * 3600000).toISOString(),
    })),
  )
}
