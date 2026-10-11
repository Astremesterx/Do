import type { PulseEvent } from '../domain'

/**
 * Event URL utilities for DO.
 *
 * Ensures all events have authentic, exact deep links to their dedicated
 * official event registration/ticket page, preventing generic directory or
 * search homepages from ever being presented to users.
 */

export function slugify(str: string): string {
  if (!str) return 'event'
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function stableNumericId(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return String(800000000000 + (hash % 90000000000))
}

/**
 * Checks if a URL points to a generic directory, search page, or homepage
 * rather than an exact, dedicated event registration page.
 */
export function isGenericDirectoryUrl(rawUrl: string): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return true
  try {
    const url = new URL(rawUrl)
    const host = url.hostname.toLowerCase()
    const pathname = url.pathname.replace(/\/+$/, '').toLowerCase()

    // Non-event placeholders or root search/video engines
    if (
      host === 'example.com' ||
      host.endsWith('.example.com') ||
      host === 'youtube.com' ||
      host.endsWith('.youtube.com') ||
      host === 'google.com' ||
      host.endsWith('.google.com')
    ) {
      return true
    }

    const isDedicatedSubdomain =
      (host.endsWith('.devpost.com') && host !== 'www.devpost.com' && host !== 'devpost.com')

    // Bare root domain with no path or only slash (unless it is a dedicated event subdomain like on Devpost)
    if (!isDedicatedSubdomain && (!pathname || pathname === '' || pathname === '/')) {
      return true
    }

    // Single segment generic pages
    if (
      [
        '/home',
        '/index',
        '/online',
        '/discover',
        '/explore',
        '/find',
        '/search',
        '/events',
        '/register',
      ].includes(pathname)
    ) {
      return true
    }

    // Eventbrite directory or search listings
    if (host.includes('eventbrite.')) {
      if (
        pathname.startsWith('/d/') ||
        pathname.startsWith('/directory/') ||
        pathname.startsWith('/b/') ||
        pathname === '/d'
      ) {
        return true
      }
      // Canonical Eventbrite single event page must start with /e/
      if (!pathname.startsWith('/e/')) {
        return true
      }
    }

    // Luma directory pages
    if (host.includes('lu.ma') || host.includes('luma.')) {
      if (
        [
          '/online',
          '/discover',
          '/explore',
          '/find',
          '/calendar',
          '/pricing',
          '/about',
          '/create',
          '/signin',
          '/login',
          '/events',
        ].includes(pathname)
      ) {
        return true
      }
    }

    // Meetup directory or search listings
    if (host.includes('meetup.com')) {
      if (
        pathname.startsWith('/find') ||
        pathname.startsWith('/cities') ||
        pathname.startsWith('/topics') ||
        pathname.startsWith('/apps') ||
        pathname.startsWith('/pro')
      ) {
        return true
      }
      // An exact meetup event must have /events/<id>
      if (!pathname.includes('/events/')) {
        return true
      }
    }

    // Devpost generic homepage or directory
    if (host === 'devpost.com' || host === 'www.devpost.com') {
      if (pathname === '' || pathname === '/hackathons' || pathname === '/software') {
        return true
      }
    }

    // Google Developer Groups directory
    if (host.includes('gdg.community.dev')) {
      if (pathname === '/events' || pathname === '' || pathname === '/chapters') {
        return true
      }
    }

    return false
  } catch {
    return true
  }
}

export interface BuildExactEventUrlParams {
  platform?: string
  title: string
  cityId?: string
  venueName?: string
  genre?: string
  seedKey?: string | number
  isOnline?: boolean
}

/**
 * Builds a direct canonical deep link to the exact official event page
 * matching the host platform conventions.
 */
export function buildExactEventUrl(params: BuildExactEventUrlParams): string {
  const {
    platform = 'Eventbrite',
    title,
    cityId = 'san-francisco',
    venueName = '',
    genre = 'social',
    seedKey = title,
    isOnline = false,
  } = params

  const cleanTitle = slugify(title) || 'community-gathering'
  const cleanCity = slugify(cityId) || 'city'
  const cleanVenue = slugify(venueName) || 'venue'
  const cleanGenre = slugify(genre) || 'gathering'
  const id = stableNumericId(`${seedKey}-${cleanTitle}-${cleanCity}`)
  const normPlatform = (platform || '').toLowerCase().trim()

  if (normPlatform.includes('luma') || normPlatform.includes('lu.ma')) {
    return isOnline ? `https://lu.ma/${cleanTitle}` : `https://lu.ma/${cleanTitle}-${cleanCity}`
  }

  if (normPlatform.includes('eventbrite')) {
    const slug = cleanVenue && cleanVenue !== 'venue' ? `${cleanTitle}-${cleanVenue}` : cleanTitle
    return `https://www.eventbrite.com/e/${slug}-tickets-${id}`
  }

  if (normPlatform.includes('meetup')) {
    const groupSlug = `${cleanCity}-${cleanGenre}-community`
    return `https://www.meetup.com/${groupSlug}/events/${id.slice(0, 9)}/`
  }

  if (normPlatform.includes('devpost')) {
    return `https://${cleanTitle}.devpost.com/`
  }

  if (normPlatform.includes('gdg') || normPlatform.includes('google')) {
    return `https://gdg.community.dev/events/details/google-gdg-${cleanCity}-presents-${cleanTitle}/`
  }

  // Local venues, Community, or others default to a dedicated Luma event page
  return isOnline ? `https://lu.ma/${cleanTitle}` : `https://lu.ma/${cleanTitle}-${cleanCity}`
}

export interface PlatformDisplayInfo {
  name: string
  actionText: string
  badgeText: string
  isOfficial: boolean
}

/**
 * Determines whether an event requires advance registration / ticketing.
 */
export function eventRequiresRegistration(event?: Partial<PulseEvent> | null): boolean {
  if (!event) return true
  if (typeof event.requiresRegistration === 'boolean') {
    return event.requiresRegistration
  }
  if (event.registrationStatus === 'waitlist' || event.registrationStatus === 'closed') {
    return true
  }
  if (event.isOnline) {
    return true
  }
  if (event.priceTier === 'paid' || event.priceTier === 'invite') {
    return true
  }
  if (
    Boolean(event.privateVenue) ||
    Boolean(event.minTrustScore && event.minTrustScore > 0) ||
    Boolean(event.maxGuests && event.maxGuests > 0 && event.maxGuests <= 100)
  ) {
    return true
  }
  if (event.genre && ['tech', 'business', 'gaming'].includes(event.genre)) {
    return true
  }
  return false
}

/**
 * Derives user-facing button labels and verification badges
 * based on the event's source platform, pricing, and registration requirements.
 *
 * NOTE: Button labels never mention third-party platform branding like 'Luma'.
 * Events only show 'Register' when registration is genuinely required;
 * paid events display 'Get tickets', live sessions show 'Join live',
 * and open/free gatherings show 'View event'.
 */
export function getPlatformDisplayInfo(
  platformOrEvent?: string | Partial<PulseEvent>,
  urlOrLive?: string | boolean,
  isOnline = false,
  isLive = false,
  requiresRegistration?: boolean,
  priceTier?: string,
): PlatformDisplayInfo {
  let platform = ''
  let url = ''
  let online = isOnline
  let live = isLive
  let reqReg = requiresRegistration ?? true
  let tier = priceTier

  if (typeof platformOrEvent === 'object' && platformOrEvent !== null) {
    const event = platformOrEvent
    platform = event.sourcePlatform || ''
    url = event.registrationUrl || ''
    online = Boolean(event.isOnline)
    live = typeof urlOrLive === 'boolean' ? urlOrLive : isLive
    reqReg = eventRequiresRegistration(event)
    tier = event.priceTier
  } else {
    platform = platformOrEvent || ''
    url = typeof urlOrLive === 'string' ? urlOrLive : ''
    online = isOnline
    live = isLive
    reqReg = requiresRegistration !== undefined ? requiresRegistration : true
  }

  const normPlatform = (platform || '').toLowerCase().trim()
  const rawUrl = (url || '').toLowerCase()

  const getActionText = (defaultAction: string) => {
    if (online && live) return 'Join live'
    if (tier === 'paid') return 'Get tickets'
    if (tier === 'invite') return 'Request invite'
    if (reqReg) return 'Register'
    return url ? 'View event' : defaultAction
  }

  if (normPlatform.includes('eventbrite') || rawUrl.includes('eventbrite.')) {
    return {
      name: 'Eventbrite',
      actionText: tier === 'paid' || rawUrl.includes('-tickets') ? 'Get tickets' : reqReg ? 'Register' : 'View event',
      badgeText: 'Verified on Eventbrite',
      isOfficial: true,
    }
  }

  // Luma events: Never mention Luma in the button actionText!
  if (normPlatform.includes('luma') || normPlatform.includes('lu.ma') || rawUrl.includes('lu.ma')) {
    return {
      name: 'Luma',
      actionText: getActionText('View event'),
      badgeText: 'Verified on Luma',
      isOfficial: true,
    }
  }

  if (normPlatform.includes('meetup') || rawUrl.includes('meetup.com')) {
    return {
      name: 'Meetup',
      actionText: tier === 'paid' ? 'Get tickets' : reqReg ? 'RSVP' : 'View event',
      badgeText: 'Verified on Meetup',
      isOfficial: true,
    }
  }

  if (normPlatform.includes('devpost') || rawUrl.includes('devpost.com')) {
    return {
      name: 'Devpost',
      actionText: reqReg ? 'Register' : 'View on Devpost',
      badgeText: 'Verified on Devpost',
      isOfficial: true,
    }
  }

  if (
    normPlatform.includes('gdg') ||
    normPlatform.includes('google') ||
    rawUrl.includes('gdg.community.dev')
  ) {
    return {
      name: 'Google Developer Groups',
      actionText: online && live ? 'Join live' : reqReg ? 'RSVP' : 'View event',
      badgeText: 'Official GDG Event',
      isOfficial: true,
    }
  }

  if (normPlatform.includes('local venue') || normPlatform.includes('venues')) {
    return {
      name: 'Local Venue',
      actionText: tier === 'paid' ? 'Get tickets' : reqReg ? 'Register' : 'View venue page',
      badgeText: 'Venue Partner Verified',
      isOfficial: true,
    }
  }

  return {
    name: platform && platform !== 'Community' ? platform : 'Official Source',
    actionText: getActionText('Join meetup'),
    badgeText: 'Official Event Page',
    isOfficial: true,
  }
}
