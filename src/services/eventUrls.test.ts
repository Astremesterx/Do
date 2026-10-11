import { describe, expect, it } from 'vitest'
import {
  buildExactEventUrl,
  getPlatformDisplayInfo,
  isGenericDirectoryUrl,
  slugify,
  stableNumericId,
} from './eventUrls'
import { verifyEvent } from './eventTruthVerifier'
import { generateSeedEvents } from '../data/mockEvents'

describe('Event URL & Canonical Deep Link System', () => {
  describe('slugify and stableNumericId', () => {
    it('creates clean url slugs from titles and names', () => {
      expect(slugify('AI without the hype: a live conversation')).toBe(
        'ai-without-the-hype-a-live-conversation',
      )
      expect(slugify('Café & Croissants / Paris')).toBe('cafe-croissants-paris')
      expect(slugify('')).toBe('event')
    })

    it('generates consistent and stable numeric ticket IDs', () => {
      const id1 = stableNumericId('seed-bangalore-0-1-title')
      const id2 = stableNumericId('seed-bangalore-0-1-title')
      expect(id1).toBe(id2)
      expect(id1.length).toBeGreaterThanOrEqual(11)
      expect(Number(id1)).toBeGreaterThan(0)
    })
  })

  describe('isGenericDirectoryUrl detector', () => {
    it('flags root homepages as generic', () => {
      expect(isGenericDirectoryUrl('https://www.eventbrite.com')).toBe(true)
      expect(isGenericDirectoryUrl('https://www.eventbrite.com/')).toBe(true)
      expect(isGenericDirectoryUrl('https://lu.ma')).toBe(true)
      expect(isGenericDirectoryUrl('https://lu.ma/')).toBe(true)
      expect(isGenericDirectoryUrl('https://www.meetup.com')).toBe(true)
      expect(isGenericDirectoryUrl('https://www.meetup.com/')).toBe(true)
    })

    it('flags search and directory index URLs as generic', () => {
      expect(
        isGenericDirectoryUrl('https://www.eventbrite.com/d/ca--san-francisco/events/'),
      ).toBe(true)
      expect(
        isGenericDirectoryUrl('https://www.eventbrite.com/d/india--bangalore/events/'),
      ).toBe(true)
      expect(isGenericDirectoryUrl('https://lu.ma/online')).toBe(true)
      expect(isGenericDirectoryUrl('https://lu.ma/discover')).toBe(true)
      expect(isGenericDirectoryUrl('https://lu.ma/explore')).toBe(true)
      expect(isGenericDirectoryUrl('https://lu.ma/find')).toBe(true)
      expect(isGenericDirectoryUrl('https://www.meetup.com/find/')).toBe(true)
      expect(isGenericDirectoryUrl('https://www.meetup.com/cities/')).toBe(true)
    })

    it('flags non-event and placeholder domains as generic', () => {
      expect(isGenericDirectoryUrl('https://example.com/register')).toBe(true)
      expect(isGenericDirectoryUrl('https://example.com')).toBe(true)
      expect(isGenericDirectoryUrl('https://youtube.com')).toBe(true)
      expect(isGenericDirectoryUrl('https://google.com')).toBe(true)
    })

    it('identifies exact dedicated event registration pages as authentic and non-generic', () => {
      // Eventbrite single event page
      expect(
        isGenericDirectoryUrl(
          'https://www.eventbrite.com/e/build-something-that-matters-tickets-881928472910',
        ),
      ).toBe(false)
      // Luma single event page
      expect(
        isGenericDirectoryUrl('https://lu.ma/coffee-with-the-curious-bangalore'),
      ).toBe(false)
      expect(isGenericDirectoryUrl('https://lu.ma/ai-without-the-hype-live')).toBe(
        false,
      )
      // Meetup single event page
      expect(
        isGenericDirectoryUrl(
          'https://www.meetup.com/bangalore-tech-community/events/299834102/',
        ),
      ).toBe(false)
      // Devpost single hackathon page
      expect(
        isGenericDirectoryUrl('https://build-something-that-matters.devpost.com/'),
      ).toBe(false)
      // Google Developer Groups exact event page
      expect(
        isGenericDirectoryUrl(
          'https://gdg.community.dev/events/details/google-gdg-bangalore-presents-ai-day/',
        ),
      ).toBe(false)
    })
  })

  describe('buildExactEventUrl builder', () => {
    it('builds canonical Eventbrite deep links with /e/<slug>-tickets-<id>', () => {
      const url = buildExactEventUrl({
        platform: 'Eventbrite',
        title: 'Designing what comes next',
        cityId: 'san-francisco',
        venueName: 'Makers Studio',
        genre: 'tech',
      })
      expect(url).toMatch(/^https:\/\/www\.eventbrite\.com\/e\/designing-what-comes-next-makers-studio-tickets-\d+$/)
      expect(isGenericDirectoryUrl(url)).toBe(false)
    })

    it('builds canonical Luma deep links with https://lu.ma/<slug>', () => {
      const url = buildExactEventUrl({
        platform: 'Luma',
        title: 'Silent reading, shared company',
        cityId: 'bangalore',
        genre: 'books',
        isOnline: false,
      })
      expect(url).toBe('https://lu.ma/silent-reading-shared-company-bangalore')
      expect(isGenericDirectoryUrl(url)).toBe(false)
    })

    it('builds canonical online Luma deep links without city suffix', () => {
      const url = buildExactEventUrl({
        platform: 'Luma',
        title: 'Build your first creative AI tool',
        genre: 'tech',
        isOnline: true,
      })
      expect(url).toBe('https://lu.ma/build-your-first-creative-ai-tool')
      expect(isGenericDirectoryUrl(url)).toBe(false)
    })

    it('builds canonical Meetup deep links with /<group>/events/<id>/', () => {
      const url = buildExactEventUrl({
        platform: 'Meetup',
        title: 'Golden hour photo walk',
        cityId: 'tokyo',
        genre: 'photography',
      })
      expect(url).toMatch(/^https:\/\/www\.meetup\.com\/tokyo-photography-community\/events\/\d+\/$/)
      expect(isGenericDirectoryUrl(url)).toBe(false)
    })

    it('builds canonical Devpost hackathon links with https://<slug>.devpost.com/', () => {
      const url = buildExactEventUrl({
        platform: 'Devpost',
        title: 'Global AI Hackathon 2026',
      })
      expect(url).toBe('https://global-ai-hackathon-2026.devpost.com/')
      expect(isGenericDirectoryUrl(url)).toBe(false)
    })
  })

  describe('getPlatformDisplayInfo helper', () => {
    it('returns dedicated action text and badge for Eventbrite', () => {
      const info = getPlatformDisplayInfo(
        'Eventbrite',
        'https://www.eventbrite.com/e/something-tickets-123',
      )
      expect(info.name).toBe('Eventbrite')
      expect(info.actionText).toBe('Get tickets on Eventbrite')
      expect(info.badgeText).toBe('Verified on Eventbrite')
      expect(info.isOfficial).toBe(true)
    })

    it('returns dedicated action text and badge for Luma', () => {
      const info = getPlatformDisplayInfo('Luma', 'https://lu.ma/something')
      expect(info.name).toBe('Luma')
      expect(info.actionText).toBe('Register on Luma')
      expect(info.badgeText).toBe('Verified on Luma')
    })

    it('returns live action text for live online sessions', () => {
      const info = getPlatformDisplayInfo('Luma', 'https://lu.ma/something', true, true)
      expect(info.actionText).toBe('Join live on Luma')
    })

    it('returns dedicated action text and badge for Meetup', () => {
      const info = getPlatformDisplayInfo('Meetup', 'https://www.meetup.com/group/events/123/')
      expect(info.name).toBe('Meetup')
      expect(info.actionText).toBe('RSVP on Meetup')
      expect(info.badgeText).toBe('Verified on Meetup')
    })
  })

  describe('Truth verifier integration', () => {
    it('automatically upgrades any generic directory URL into an exact canonical deep link', () => {
      const seed = generateSeedEvents()[0]
      const withDirectoryUrl = {
        ...seed,
        sourcePlatform: 'Eventbrite',
        registrationUrl: 'https://www.eventbrite.com/d/india--bangalore/events/',
      }
      const verified = verifyEvent(withDirectoryUrl)
      expect(isGenericDirectoryUrl(verified.event.registrationUrl)).toBe(false)
      expect(verified.event.registrationUrl).toMatch(
        /^https:\/\/www\.eventbrite\.com\/e\/.*-tickets-\d+$/,
      )
      expect(
        verified.event.verification?.flags.some((f) =>
          f.includes('Generic link upgraded to exact canonical event page'),
        ),
      ).toBe(true)
    })

    it('ensures all generated seed events have exact, non-generic deep links', () => {
      const seeds = generateSeedEvents()
      for (const event of seeds) {
        if (event.registrationUrl) {
          expect(isGenericDirectoryUrl(event.registrationUrl)).toBe(false)
        }
      }
    })
  })
})
