import { beforeEach, describe, expect, it } from 'vitest'
import { generateSeedEvents } from '../data/mockEvents'
import { selectProfile, useCommunityStore } from '../communityStore'
import { useSocialStore } from '../stores'
import { joinEligibility, reviewTrustDelta, trustTier } from './community'

const initial = useCommunityStore.getInitialState()
const future = new Date(Date.now() + 86400000)
const event = {
  ...generateSeedEvents(future)[0],
  id: 'community-test',
  maxGuests: 10,
  attendeesCount: 2,
  minTrustScore: 0,
  registrationStatus: 'open' as const,
}
beforeEach(() => {
  useCommunityStore.setState(initial, true)
  useSocialStore.setState({ goingIds: [], beacons: [], messages: {} })
})

describe('local community rules', () => {
  it('counts local RSVPs from other profiles toward the guest limit', () => {
    const limited = { ...event, attendeesCount: 9 }
    expect(useCommunityStore.getState().toggleJoin(limited).ok).toBe(true)
    useCommunityStore.getState().switchProfile('demo-salif')
    expect(useCommunityStore.getState().toggleJoin(limited).ok).toBe(false)
  })
  it('enforces guest, capacity, registration, trust, and concluded-event restrictions', () => {
    const profile = selectProfile(useCommunityStore.getState())
    expect(joinEligibility(event, { ...profile, isGuest: true })).toContain('local profile')
    expect(joinEligibility({ ...event, attendeesCount: 10 }, profile)).toContain('full')
    expect(joinEligibility({ ...event, registrationStatus: 'closed' }, profile)).toContain('closed')
    expect(joinEligibility({ ...event, registrationStatus: 'waitlist' }, profile)).toContain(
      'waitlist',
    )
    expect(joinEligibility({ ...event, minTrustScore: 800 }, profile)).toContain('800')
    expect(joinEligibility({ ...event, concluded: true }, profile)).toContain('ended')
    expect(joinEligibility({ ...event, attendeesCount: 10, unlimited: true }, profile)).toBeNull()
    expect(joinEligibility({ ...event, concluded: true }, profile, true)).toBeNull()
  })

  it('isolates RSVP lists when switching profiles, including legacy local RSVPs', () => {
    useSocialStore.setState({ goingIds: ['legacy-rsvp'] })
    useCommunityStore.getState().switchProfile('demo-salif')
    expect(useSocialStore.getState().goingIds).toEqual([])
    expect(useCommunityStore.getState().toggleJoin(event).ok).toBe(true)
    useCommunityStore.getState().switchProfile('you')
    expect(useSocialStore.getState().goingIds).toEqual(['legacy-rsvp'])
    useCommunityStore.getState().switchProfile('demo-salif')
    expect(useSocialStore.getState().goingIds).toEqual([event.id])
  })

  it('awards hosting once and gives the host access to the RSVP room', () => {
    const store = useCommunityStore.getState()
    store.recordHost(event)
    store.recordHost(event)
    expect(selectProfile(useCommunityStore.getState()).trustScore).toBe(665)
    expect(useCommunityStore.getState().hosted.you).toEqual([event.id])
    expect(useSocialStore.getState().goingIds).toContain(event.id)
  })

  it('requires an RSVP and a concluded event, then records attendance only once', () => {
    const review = {
      eventId: event.id,
      attended: true,
      rating: 5,
      compliments: [],
      notes: '',
      createdAt: new Date().toISOString(),
    }
    const store = useCommunityStore.getState()
    expect(store.reviewEvent(review, { ...event, concluded: true }).ok).toBe(false)
    store.toggleJoin(event)
    expect(store.reviewEvent(review, event).ok).toBe(false)
    expect(store.reviewEvent({ ...review, rating: NaN }, { ...event, concluded: true }).ok).toBe(
      false,
    )
    expect(store.reviewEvent(review, { ...event, concluded: true }).ok).toBe(true)
    expect(store.reviewEvent(review, { ...event, concluded: true }).ok).toBe(false)
    expect(selectProfile(useCommunityStore.getState()).trustScore).toBe(675)
    expect(reviewTrustDelta({ attended: false, rating: 5 })).toBe(-35)
  })

  it('does not reward repeated edits of the same beacon or allow guest editing to bypass the profile gate', () => {
    const store = useCommunityStore.getState()
    store.recordBeacon('beacon')
    store.recordBeacon('beacon')
    expect(selectProfile(useCommunityStore.getState()).trustScore).toBe(655)
    store.switchProfile('guest')
    store.saveProfile({ name: 'Bypass' })
    expect(selectProfile(useCommunityStore.getState()).isGuest).toBe(true)
  })

  it('follows and unfollows hosts independently for each profile', () => {
    const store = useCommunityStore.getState()
    store.toggleFollow(event)
    expect(useCommunityStore.getState().following.you).toContain(event.host!.id)
    store.switchProfile('demo-amal')
    expect(useCommunityStore.getState().following['demo-amal']).toBeUndefined()
    store.switchProfile('you')
    store.toggleFollow(event)
    expect(useCommunityStore.getState().following.you).toEqual([])
  })

  it('keeps unread actions scoped to the active local profile', () => {
    const store = useCommunityStore.getState()
    store.notify({ id: 'you-note', type: 'join', title: 'One', body: '' })
    store.switchProfile('demo-amal')
    store.notify({ id: 'amal-note', type: 'join', title: 'Two', body: '' })
    store.markRead()
    expect(useCommunityStore.getState().notifications.find((n) => n.id === 'you-note')?.read).toBe(
      false,
    )
    expect(useCommunityStore.getState().notifications.find((n) => n.id === 'amal-note')?.read).toBe(
      true,
    )
    expect(trustTier(860)).toBe('Community Pillar')
    expect(trustTier(500)).toBe('Trusted Explorer')
  })
})
