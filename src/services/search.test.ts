import { describe, expect, it } from 'vitest'
import { CITIES, getCity, resolveCity, WORLDWIDE_CITY } from '../data/cities'
import { filterEvents } from './filters'
import { generateSeedEvents } from '../data/mockEvents'

describe('Top Bar Search & Map Navigation logic', () => {
  it('indexes districts across cities like Indiranagar, Koramangala, and Shibuya', () => {
    const districts = CITIES.flatMap((c) =>
      c.districts.map((d) => ({
        name: d.name,
        point: d.point,
        cityName: c.name,
        cityId: c.id,
      })),
    )

    const indiranagar = districts.find((d) => d.name.toLowerCase().includes('indiranagar'))
    expect(indiranagar).toBeDefined()
    expect(indiranagar?.cityName).toBe('Bangalore')
    expect(indiranagar?.point).toEqual([12.9784, 77.6408])

    const koramangala = districts.find((d) => d.name.toLowerCase().includes('koramangala'))
    expect(koramangala).toBeDefined()
    expect(koramangala?.cityName).toBe('Bangalore')
    expect(koramangala?.point).toEqual([12.9352, 77.6245])

    const shibuya = districts.find((d) => d.name.toLowerCase().includes('shibuya'))
    expect(shibuya).toBeDefined()
    expect(shibuya?.cityName).toBe('Tokyo')
    expect(shibuya?.point).toEqual([35.6595, 139.7005])
  })

  it('resolves coordinates for target places and zoom levels', () => {
    const testDistricts = [
      { query: 'indiranagar', expectedCity: 'bangalore', expectedCoords: [12.9784, 77.6408] },
      { query: 'koramangala', expectedCity: 'bangalore', expectedCoords: [12.9352, 77.6245] },
      { query: 'shibuya', expectedCity: 'tokyo', expectedCoords: [35.6595, 139.7005] },
      { query: 'mitte', expectedCity: 'berlin', expectedCoords: [52.5225, 13.401] },
    ]

    for (const test of testDistricts) {
      let matchedDistrict: { name: string; point: [number, number]; cityId: string } | undefined
      for (const c of CITIES) {
        const found = c.districts.find((d) => d.name.toLowerCase().includes(test.query))
        if (found) {
          matchedDistrict = { name: found.name, point: found.point, cityId: c.id }
          break
        }
      }

      expect(matchedDistrict).toBeDefined()
      expect(matchedDistrict?.cityId).toBe(test.expectedCity)
      expect(matchedDistrict?.point).toEqual(test.expectedCoords)
    }
  })

  it('resolves authentic local districts in Kochi and Kozhikode', () => {
    const kochi = CITIES.find((c) => c.id === 'kochi')
    expect(kochi).toBeDefined()
    const districtNames = kochi?.districts.map((d) => d.name)
    expect(districtNames).toContain('Ernakulam')
    expect(districtNames).toContain('Kakkanad')
    expect(districtNames).toContain('Fort Kochi')
    expect(districtNames).toContain('Marine Drive')
    expect(districtNames).toContain('Edappally')
    expect(districtNames).toContain('Panampilly Nagar')

    const kakkanad = kochi?.districts.find((d) => d.name === 'Kakkanad')
    expect(kakkanad?.point).toEqual([10.0159, 76.3419])

    const fortKochi = kochi?.districts.find((d) => d.name === 'Fort Kochi')
    expect(fortKochi?.point).toEqual([9.9658, 76.2421])
  })

  it('supports Worldwide global city resolution and worldwide event discovery', () => {
    expect(getCity('all')).toEqual(WORLDWIDE_CITY)
    expect(resolveCity('worldwide')).toEqual(WORLDWIDE_CITY)
    expect(resolveCity('global')).toEqual(WORLDWIDE_CITY)

    const allEvents = generateSeedEvents(new Date('2026-10-10T08:00:00Z'), 18)
    const worldwideEvents = filterEvents(allEvents, {
      city: 'all',
      genre: 'all',
      time: 'all',
      date: '2026-10-10',
      query: '',
      radius: 0,
      preferences: { scope: 'global' },
    })

    expect(worldwideEvents.length).toBeGreaterThan(500)
    const citiesInWorldwide = new Set(worldwideEvents.map((e) => e.city))
    expect(citiesInWorldwide.size).toBeGreaterThan(10)
    expect(citiesInWorldwide).toContain('kochi')
    expect(citiesInWorldwide).toContain('bangalore')
    expect(citiesInWorldwide).toContain('tokyo')
  })

  it('indexes all 14 Kerala districts and key cultural destinations with authentic landmarks', () => {
    const keralaDistrictIds = [
      'trivandrum',
      'kochi',
      'kozhikode',
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
    ]

    for (const id of keralaDistrictIds) {
      const city = CITIES.find((c) => c.id === id)
      expect(city).toBeDefined()
      expect(city?.state).toBe('Kerala')
      expect(city?.districts.length).toBeGreaterThanOrEqual(6)
    }

    // Resolves famous Kerala destinations and landmarks
    expect(resolveCity('thiruvananthapuram')?.id).toBe('trivandrum')
    expect(resolveCity('calicut')?.id).toBe('kozhikode')
    expect(resolveCity('ernakulam')?.id).toBe('kochi')
    expect(resolveCity('alleppey')?.id).toBe('alappuzha')
    expect(resolveCity('trichur')?.id).toBe('thrissur')

    const allDistricts = CITIES.flatMap((c) => c.districts.map((d) => ({ ...d, cityId: c.id })))
    expect(allDistricts.find((d) => d.name.includes('Varkala Cliff'))?.cityId).toBe('trivandrum')
    expect(allDistricts.find((d) => d.name.includes('Munnar'))?.cityId).toBe('idukki')
    expect(allDistricts.find((d) => d.name.includes('Bekal'))?.cityId).toBe('kasaragod')
    expect(allDistricts.find((d) => d.name.includes('Sultan Bathery'))?.cityId).toBe('wayanad')
    expect(allDistricts.find((d) => d.name.includes('Guruvayur'))?.cityId).toBe('thrissur')
    expect(allDistricts.find((d) => d.name.includes('Whitefield'))?.cityId).toBe('bangalore')
  })
})
