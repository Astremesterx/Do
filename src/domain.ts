export type EventGenre =
  | 'tech'
  | 'music'
  | 'nightlife'
  | 'food'
  | 'art'
  | 'sports'
  | 'business'
  | 'outdoor'
  | 'social'
  | 'photography'
  | 'gaming'
  | 'books'
export type PriceTier = 'free' | 'paid' | 'invite'
export type TimeFilter =
  | 'all'
  | 'live'
  | 'today'
  | 'tomorrow'
  | 'weekend'
  | 'date'
  | 'week'
  | 'upcoming'
export type Pace = 'chill' | 'balanced' | 'packed'
export type Budget = 'free' | 'budget' | 'all'
export type Slot = 'morning' | 'afternoon' | 'evening' | 'night'
export interface PulseEvent {
  id: string
  title: string
  description: string
  genre: EventGenre
  isOnline: boolean
  venueName: string
  address: string
  city: string
  country: string
  latitude: number
  longitude: number
  startTime: string
  endTime: string
  imageUrl: string
  registrationUrl: string
  priceTier: PriceTier
  priceAmount: number
  priceKnown?: boolean
  currency: string
  sourcePlatform: string
  sourceHash: string
  isVerified: boolean
  attendeesCount?: number
  rating: number
  isCustom?: boolean
  host?: HostProfile
  tags?: string[]
  state?: string
  exactVenue?: string
  privateVenue?: boolean
  meetingUrl?: string
  maxGuests?: number
  unlimited?: boolean
  minTrustScore?: number
  registrationStatus?: 'open' | 'closed' | 'waitlist'
  requiresRegistration?: boolean
  officialLinks?: { label: string; url: string; type?: string }[]
  officialMentions?: { title: string; url: string; platform?: string }[]
  provenance?: 'demo' | 'community' | 'collected' | 'pulse-import'
  collectedAt?: string
  locationPrecision?: 'venue' | 'district' | 'city' | 'online'
  verification?: { score: number; flags: string[]; checkedAt: string }
  concluded?: boolean
  archived?: boolean
}
export interface ItineraryStop {
  id: string
  slot: Slot
  event: PulseEvent
  dayNumber: number
  sortOrder: number
  customNotes?: string
  transitMinutesFromPrev: number
  distanceKmFromPrev: number
  tightConnection?: boolean
}
export interface TripConfig {
  destinationCity: string
  startDate: string
  endDate: string
  vibeTags: EventGenre[]
  pace: Pace
  budget: Budget
}
export interface TravelPlan extends TripConfig {
  id: string
  title: string
  stops: ItineraryStop[]
  createdAt: string
}
export interface ImFreeBeacon {
  id: string
  userId: string
  userName: string
  userAvatar: string
  latitude: number
  longitude: number
  city: string
  vibeMessage: string
  expiresAt: string
  radiusKm?: number
  interests?: EventGenre[]
}
export interface DiscussionMessage {
  id: string
  userName: string
  avatar: string
  body: string
  createdAt: string
}
export interface City {
  id: string
  name: string
  country: string
  timezone: string
  offset: string
  currency: string
  center: [number, number]
  mapCenter: [number, number]
  bounds: [number, number, number, number]
  districts: { name: string; point: [number, number] }[]
  state?: string
}

export interface HostProfile {
  id: string
  name: string
  handle: string
  trustScore: number
  isOrg?: boolean
  orgName?: string
  isAdmin?: boolean
}
export interface LocalProfile extends HostProfile {
  bio: string
  city: string
  interests: EventGenre[]
  highlightInterests: boolean
  isGuest: boolean
  isAdmin?: boolean
}
export interface LocalNotification {
  id: string
  profileId?: string
  title: string
  body: string
  eventId?: string
  createdAt: string
  read: boolean
  type: 'join' | 'follow' | 'reminder' | 'host' | 'review'
}
export interface EventReview {
  eventId: string
  attended: boolean
  rating: number
  compliments: string[]
  notes: string
  createdAt: string
}
export interface DiscoveryPreferences {
  scope: 'city' | 'nearby' | 'state' | 'country' | 'global'
  pricing: 'all' | 'free' | 'paid'
  minTrust: number
  interestsOnly: boolean
  followingOnly: boolean
  origin?: [number, number]
  district?: string
}
