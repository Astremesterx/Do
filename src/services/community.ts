import type { EventReview, LocalProfile, PulseEvent } from '../domain'

export function hostOf(event: PulseEvent) {
  return (
    event.host ?? {
      id: `source-${event.sourcePlatform}-${event.city}`,
      name: event.sourcePlatform,
      handle: `@${event.sourcePlatform.toLowerCase().replace(/\W/g, '')}`,
      trustScore: 650,
      isOrg: true,
    }
  )
}
export function trustTier(score: number) {
  return score >= 800 ? 'Community Pillar' : score >= 500 ? 'Trusted Explorer' : 'New Explorer'
}
export function joinEligibility(
  event: PulseEvent,
  profile: LocalProfile,
  joined = false,
  now = Date.now(),
) {
  if (joined) return null
  if (profile.isGuest) return 'Choose a local profile to RSVP and join the conversation.'
  if (event.archived || event.concluded || +new Date(event.endTime) <= now)
    return 'This event has ended.'
  if (event.registrationStatus === 'closed') return 'Registration has closed.'
  if (event.registrationStatus === 'waitlist')
    return 'This event is on a waitlist. Check the official registration page.'
  if (!event.unlimited && event.maxGuests && (event.attendeesCount ?? 0) >= event.maxGuests)
    return 'This gathering is full.'
  if (profile.trustScore < (event.minTrustScore ?? 0))
    return `This gathering requires ${event.minTrustScore} trust points. Your score is ${profile.trustScore}.`
  return null
}
export function reviewTrustDelta(review: Pick<EventReview, 'attended' | 'rating'>) {
  return review.attended ? 20 + (review.rating >= 4 ? 5 : 0) : -35
}
export function attendeeCount(
  event: PulseEvent,
  joined: Record<string, string[]>,
  activeId?: string,
  activeJoined?: string[],
) {
  const people = new Set(
    Object.entries(joined)
      .filter(([, ids]) => ids.includes(event.id))
      .map(([id]) => id),
  )
  if (activeId && activeJoined?.includes(event.id)) people.add(activeId)
  return (event.attendeesCount ?? 0) + people.size
}
