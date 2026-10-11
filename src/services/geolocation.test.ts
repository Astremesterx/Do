import { describe, expect, it, vi, beforeEach } from 'vitest'
import { getUserLocation } from './geolocation'

describe('getUserLocation service', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves coordinates via IP geolocation fallback when native geolocation is unavailable', async () => {
    // Mock global fetch returning valid IP geolocation response
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        latitude: 12.9716,
        longitude: 77.5946,
        city: 'Bangalore',
        success: true,
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    // Simulate insecure context or no native geolocation
    vi.stubGlobal('isSecureContext', false)

    const [lat, lon] = await getUserLocation()
    expect(lat).toBe(12.9716)
    expect(lon).toBe(77.5946)
    expect(fetchMock).toHaveBeenCalled()
  })

  it('tries native geolocation when in secure context', async () => {
    const mockGetCurrentPosition = vi.fn().mockImplementation((success) => {
      success({
        coords: {
          latitude: 35.6762,
          longitude: 139.6503,
        },
      })
    })

    vi.stubGlobal('isSecureContext', true)
    vi.stubGlobal('window', { isSecureContext: true })
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: mockGetCurrentPosition,
      },
    })

    const [lat, lon] = await getUserLocation()
    expect(lat).toBe(35.6762)
    expect(lon).toBe(139.6503)
    expect(mockGetCurrentPosition).toHaveBeenCalled()
  })
})
