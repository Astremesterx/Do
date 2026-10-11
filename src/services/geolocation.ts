/**
 * Universal Geolocation Service with Network Host & Insecure Origin Fallback.
 *
 * Browsers block `navigator.geolocation` on non-localhost HTTP origins (such as
 * LAN network host: http://192.168.x.x:5173). This service automatically:
 * 1. Tries high-accuracy native GPS if available in a secure context.
 * 2. Falls back seamlessly to IP-based geolocation when running on an insecure
 *    network host or when native location permission is unavailable.
 */

interface IPGeoResponse {
  latitude?: number
  longitude?: number
  lat?: number
  lon?: number
  city?: string
  success?: boolean
}

export async function getUserLocation(): Promise<[number, number]> {
  // 1. Try native GPS in secure context (localhost / HTTPS / supported WebViews)
  const isSecure =
    typeof globalThis !== 'undefined' && 'isSecureContext' in globalThis
      ? Boolean((globalThis as unknown as { isSecureContext: boolean }).isSecureContext)
      : typeof window !== 'undefined'
        ? Boolean(window.isSecureContext)
        : true

  const hasNative =
    typeof navigator !== 'undefined' &&
    Boolean(navigator.geolocation) &&
    typeof navigator.geolocation.getCurrentPosition === 'function'

  if (isSecure && hasNative) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 6000,
          enableHighAccuracy: true,
          maximumAge: 60000,
        })
      })
      return [position.coords.latitude, position.coords.longitude]
    } catch {
      // In case of permission denial or timeout, proceed to IP fallback below
    }
  }

  // 2. Fallback to IP Geolocation (works universally over HTTP network host)
  const endpoints = [
    'https://ipwho.is/',
    'https://freeipapi.com/api/json',
  ]

  for (const url of endpoints) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 4500)
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timer)

      if (res.ok) {
        const data = (await res.json()) as IPGeoResponse
        const lat = data.latitude ?? data.lat
        const lon = data.longitude ?? data.lon
        if (typeof lat === 'number' && typeof lon === 'number' && !Number.isNaN(lat) && !Number.isNaN(lon)) {
          return [lat, lon]
        }
      }
    } catch {
      // Continue to next endpoint if this one times out or fails
    }
  }

  throw new Error('Location access was unavailable. Use a city or drop a pin instead.')
}
