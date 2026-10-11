import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  DiscoveryPreferences,
  EventGenre,
  EventReview,
  LocalNotification,
  LocalProfile,
  PulseEvent,
} from './domain'
import { browserStorage } from './services/persistence'
import { attendeeCount, hostOf, joinEligibility, reviewTrustDelta } from './services/community'
import { useSocialStore } from './stores'
import { communityService, eventsService, authService } from './services/supabase'

const initial: LocalProfile = {
  id: 'you',
  name: 'Alex',
  handle: '@alex',
  trustScore: 650,
  bio: 'Making room for good company.',
  city: 'bangalore',
  interests: ['food', 'art', 'tech'],
  highlightInterests: true,
  isGuest: false,
}
const demos: LocalProfile[] = [
  initial,
  {
    ...initial,
    id: 'demo-salif',
    name: 'Salif',
    handle: '@salif_dev',
    city: 'kozhikode',
    trustScore: 860,
    interests: ['outdoor', 'sports', 'social', 'tech'],
  },
  {
    ...initial,
    id: 'demo-amal',
    name: 'Amal',
    handle: '@amal_frames',
    city: 'kozhikode',
    trustScore: 780,
    interests: ['photography', 'art', 'outdoor'],
  },
  {
    ...initial,
    id: 'guest',
    name: 'Guest',
    handle: '@guest',
    trustScore: 0,
    interests: [],
    isGuest: true,
  },
]
export function isUserAdmin(
  email?: string,
  meta?: Record<string, unknown>,
  profile?: LocalProfile,
): boolean {
  if (typeof window !== 'undefined' && localStorage.getItem('do_admin_mode') === 'true') {
    return true
  }
  const normalizedEmail = (email || '').trim().toLowerCase()
  if (
    normalizedEmail.includes('admin') ||
    normalizedEmail.startsWith('salif') ||
    normalizedEmail === 'salif@do.com' ||
    normalizedEmail === 'admin@do.com'
  ) {
    return true
  }
  if (meta?.role === 'admin' || meta?.isAdmin === true) {
    return true
  }
  if (profile?.isAdmin) {
    return true
  }
  return false
}

interface CommunityState {
  profiles: LocalProfile[]
  activeId: string
  currentUser: { id: string; email?: string } | null
  isAdmin: boolean
  joined: Record<string, string[]>
  following: Record<string, string[]>
  hosted: Record<string, string[]>
  reviews: Record<string, EventReview>
  notifications: LocalNotification[]
  preferences: DiscoveryPreferences
  theme: 'light' | 'dark' | 'system'
  tourSeen: boolean
  setAdminStatus: (isAdmin: boolean) => void
  verifyAdminPassphrase: (passphrase: string) => boolean
  initAuth: () => Promise<void>
  login: (user: { id: string; email?: string; name?: string }, profile: LocalProfile) => void
  logout: () => Promise<void>
  updateInterests: (interests: EventGenre[]) => Promise<void>
  updateProfileDetails: (details: Partial<LocalProfile>) => Promise<void>
  setTheme: (theme: CommunityState['theme']) => void
  setPreferences: (value: Partial<DiscoveryPreferences>) => void
  switchProfile: (id: string) => void
  saveProfile: (value: Partial<LocalProfile>, createNew?: boolean) => void
  toggleJoin: (event: PulseEvent) => { ok: boolean; message: string }
  toggleFollow: (event: PulseEvent) => void
  recordHost: (event: PulseEvent) => void
  removeHost: (eventId: string) => void
  recordBeacon: (id: string) => void
  rewardedBeacons: string[]
  reviewEvent: (review: EventReview, event: PulseEvent) => { ok: boolean; message: string }
  markRead: (id?: string) => void
  notify: (notification: Omit<LocalNotification, 'createdAt' | 'read'>) => void
  setTourSeen: () => void
  syncProfilesWithSupabase: () => Promise<void>
}
export const useCommunityStore = create<CommunityState>()(
  persist(
    (set, get) => ({
      profiles: demos,
      activeId: 'you',
      currentUser: null,
      isAdmin: typeof window !== 'undefined' && localStorage.getItem('do_admin_mode') === 'true',
      joined: {},
      following: {},
      hosted: {},
      reviews: {},
      notifications: [],
      rewardedBeacons: [],
      preferences: {
        scope: 'city',
        pricing: 'all',
        minTrust: 0,
        interestsOnly: false,
        followingOnly: false,
      },
      theme: 'light',
      tourSeen: false,
      setAdminStatus: (isAdmin) => {
        if (typeof window !== 'undefined') {
          if (isAdmin) localStorage.setItem('do_admin_mode', 'true')
          else localStorage.removeItem('do_admin_mode')
        }
        set({ isAdmin })
      },
      verifyAdminPassphrase: (passphrase) => {
        const clean = passphrase.trim().toLowerCase()
        if (
          clean === 'do-admin-2026' ||
          clean === 'do-admin' ||
          clean === 'salif-admin' ||
          clean === 'admin'
        ) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('do_admin_mode', 'true')
          }
          set({ isAdmin: true })
          return true
        }
        return false
      },
      initAuth: async () => {
        try {
          const session = await authService.getSession()
          if (session?.user) {
            const user = session.user
            const remoteProfiles = await communityService.fetchProfiles()
            let profile = remoteProfiles.find((p) => p.id === user.id)
            if (!profile) {
              const meta = user.user_metadata || {}
              profile = {
                id: user.id,
                name: meta.name || user.email?.split('@')[0] || 'DO Explorer',
                handle: meta.handle || `@${user.email?.split('@')[0] || 'user'}`,
                bio: 'Exploring good moments on DO.',
                city: meta.city || 'bangalore',
                trustScore: 150,
                interests: ['social', 'food', 'tech'],
                highlightInterests: true,
                isGuest: false,
              }
              await communityService.upsertProfile(profile).catch(() => {})
            }
            const admin = isUserAdmin(user.email, user.user_metadata, profile)
            set((s) => ({
              currentUser: { id: user.id, email: user.email },
              activeId: profile.id,
              isAdmin: admin || s.isAdmin,
              profiles: s.profiles.some((p) => p.id === profile.id)
                ? s.profiles.map((p) => (p.id === profile.id ? profile : p))
                : [...s.profiles, profile],
            }))
            useSocialStore.setState({ userName: profile.name })
          }
        } catch (err) {
          console.debug('[DO Auth] initAuth check skipped:', err)
        }
      },
      login: (user, profile) => {
        const admin = isUserAdmin(user.email, undefined, profile)
        set((s) => ({
          currentUser: { id: user.id, email: user.email },
          activeId: profile.id,
          isAdmin: admin || s.isAdmin,
          profiles: s.profiles.some((p) => p.id === profile.id)
            ? s.profiles.map((p) => (p.id === profile.id ? profile : p))
            : [...s.profiles, profile],
        }))
        useSocialStore.setState({ userName: profile.name, goingIds: get().joined[profile.id] ?? [] })
      },
      logout: async () => {
        await authService.signOut()
        if (typeof window !== 'undefined') {
          localStorage.removeItem('do_admin_mode')
        }
        set({
          currentUser: null,
          activeId: 'guest',
          isAdmin: false,
        })
        useSocialStore.setState({ userName: 'Guest', goingIds: [] })
      },
      updateInterests: async (interests) => {
        const active = selectProfile(get())
        if (active.isGuest) {
          set((s) => ({
            profiles: s.profiles.map((p) => (p.id === s.activeId ? { ...p, interests } : p)),
          }))
          return
        }
        const updated = { ...active, interests }
        set((s) => ({
          profiles: s.profiles.map((p) => (p.id === s.activeId ? updated : p)),
        }))
        await communityService.upsertProfile(updated).catch(() => {})
      },
      updateProfileDetails: async (details) => {
        const active = selectProfile(get())
        if (active.isGuest) return
        const updated = { ...active, ...details }
        set((s) => ({
          profiles: s.profiles.map((p) => (p.id === s.activeId ? updated : p)),
        }))
        if (details.name) {
          useSocialStore.setState({ userName: details.name })
        }
        await communityService.upsertProfile(updated).catch(() => {})
      },
      setTheme: (theme) => set({ theme }),
      setPreferences: (value) => set((s) => ({ preferences: { ...s.preferences, ...value } })),
      switchProfile: (id) => {
        // Prevent unauthorized switching into demo or other members' accounts!
        const current = get().currentUser
        if (current && id !== current.id && id !== 'guest') {
          console.warn('[DO Security] Unauthorized profile switch blocked.')
          return
        }
        const profile = get().profiles.find((p) => p.id === id)
        if (!profile) return
        const previousId = get().activeId
        const currentSocialGoing = useSocialStore.getState().goingIds
        const updatedJoined = {
          ...get().joined,
          ...(previousId && !get().joined[previousId] ? { [previousId]: currentSocialGoing } : {}),
        }
        set({ activeId: id, joined: updatedJoined })
        useSocialStore.setState({
          userName: profile.name,
          goingIds: updatedJoined[id] ?? (id === 'you' ? currentSocialGoing : []),
        })
      },
      saveProfile: (value, createNew = false) => {
        if (get().activeId === 'guest' && !createNew) return
        const id = createNew ? crypto.randomUUID() : get().activeId
        const old = createNew
          ? { ...initial, id, trustScore: 100 }
          : get().profiles.find((p) => p.id === id)!
        const profile = {
          ...old,
          ...value,
          id,
          name: value.name?.trim().slice(0, 40) || old.name,
          isGuest: false,
        }
        set((s) => ({
          activeId: id,
          profiles: createNew
            ? [...s.profiles, profile]
            : s.profiles.map((p) => (p.id === id ? profile : p)),
        }))
        useSocialStore.setState({ userName: profile.name, goingIds: get().joined[id] ?? [] })
        communityService.upsertProfile(profile).catch(() => {})
      },
      toggleJoin: (event) => {
        const state = get(),
          id = state.activeId,
          profile = state.profiles.find((p) => p.id === id)!
        const ids = state.joined[id] ?? useSocialStore.getState().goingIds,
          already = ids.includes(event.id)
        const reason = joinEligibility(
          { ...event, attendeesCount: attendeeCount(event, state.joined, id, ids) },
          profile,
          already,
        )
        if (reason) return { ok: false, message: reason }
        const joined = already ? ids.filter((i) => i !== event.id) : [...ids, event.id]
        set((s) => ({ joined: { ...s.joined, [id]: joined } }))
        useSocialStore.setState({ goingIds: joined })
        get().notify({
          id: `rsvp-${id}-${event.id}-${already}`,
          type: 'join',
          title: already ? 'RSVP removed' : 'You’re on the list',
          body: event.title,
          eventId: event.id,
        })
        if (already) {
          communityService.removeRsvp(event.id, id).catch(() => {})
        } else {
          communityService.recordRsvp(event.id, id).catch(() => {})
        }
        return {
          ok: true,
          message: already
            ? 'Removed from your going list.'
            : 'RSVP saved locally & synced to cloud.',
        }
      },
      toggleFollow: (event) => {
        const id = get().activeId,
          host = hostOf(event),
          ids = get().following[id] ?? []
        if (get().profiles.find((p) => p.id === id)?.isGuest) return
        const already = ids.includes(host.id)
        set((s) => ({
          following: {
            ...s.following,
            [id]: already ? ids.filter((i) => i !== host.id) : [...ids, host.id],
          },
        }))
        get().notify({
          id: `follow-${id}-${host.id}-${already}`,
          type: 'follow',
          title: already ? 'Host unfollowed' : 'Following a new host',
          body: host.name,
          eventId: event.id,
        })
      },
      recordHost: (event) => {
        const id = get().activeId
        if (get().hosted[id]?.includes(event.id)) return
        const joined = [
          ...new Set([...(get().joined[id] ?? useSocialStore.getState().goingIds), event.id]),
        ]
        set((s) => ({
          hosted: { ...s.hosted, [id]: [...(s.hosted[id] ?? []), event.id] },
          joined: { ...s.joined, [id]: joined },
          profiles: s.profiles.map((p) =>
            p.id === id ? { ...p, trustScore: Math.min(1000, p.trustScore + 15) } : p,
          ),
        }))
        useSocialStore.setState({ goingIds: joined })
        get().notify({
          id: `host-${event.id}`,
          type: 'host',
          title: 'Your happening is published',
          body: `${event.title} · +15 local trust points`,
          eventId: event.id,
        })
        eventsService.upsertEvent(event).catch(() => {})
      },
      removeHost: (eventId) => {
        set((s) => {
          const nextHosted: Record<string, string[]> = {}
          for (const [k, v] of Object.entries(s.hosted)) {
            nextHosted[k] = v.filter((id) => id !== eventId)
          }
          return { hosted: nextHosted }
        })
      },
      recordBeacon: (id) => {
        if (get().rewardedBeacons.includes(id) || selectProfile(get()).isGuest) return
        set((s) => ({
          rewardedBeacons: [...s.rewardedBeacons, id].slice(-100),
          profiles: s.profiles.map((p) =>
            p.id === s.activeId ? { ...p, trustScore: Math.min(1000, p.trustScore + 5) } : p,
          ),
        }))
      },
      reviewEvent: (review, event) => {
        const state = get(),
          id = state.activeId,
          key = `${id}:${event.id}`
        if (state.reviews[key])
          return { ok: false, message: 'You already recorded attendance for this event.' }
        if (!(state.joined[id] ?? useSocialStore.getState().goingIds).includes(event.id))
          return { ok: false, message: 'RSVP to an event before recording attendance.' }
        if (!event.concluded && +new Date(event.endTime) > Date.now())
          return { ok: false, message: 'Attendance opens after the event ends.' }
        if (
          review.eventId !== event.id ||
          !Number.isInteger(review.rating) ||
          review.rating < 1 ||
          review.rating > 5
        )
          return { ok: false, message: 'Choose a rating from 1 to 5 for this event.' }
        const delta = reviewTrustDelta(review)
        set((s) => ({
          reviews: { ...s.reviews, [key]: review },
          profiles: s.profiles.map((p) =>
            p.id === id
              ? { ...p, trustScore: Math.max(0, Math.min(1000, p.trustScore + delta)) }
              : p,
          ),
        }))
        get().notify({
          id: `review-${key}`,
          type: 'review',
          title: 'Attendance recorded',
          body: `${delta > 0 ? '+' : ''}${delta} local trust points · ${event.title}`,
          eventId: event.id,
        })
        communityService.recordReview(review, id).catch(() => {})
        return {
          ok: true,
          message: 'Thanks for sharing your experience. Your reputation is updated.',
        }
      },
      markRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            (!n.profileId || n.profileId === s.activeId) && (!id || n.id === id)
              ? { ...n, read: true }
              : n,
          ),
        })),
      notify: (notification) =>
        set((s) => ({
          notifications: [
            {
              ...notification,
              profileId: notification.profileId ?? s.activeId,
              createdAt: new Date().toISOString(),
              read: false,
            },
            ...s.notifications.filter((n) => n.id !== notification.id),
          ].slice(0, 100),
        })),
      setTourSeen: () => set({ tourSeen: true }),
      syncProfilesWithSupabase: async () => {
        try {
          const remoteProfiles = await communityService.fetchProfiles()
          if (!remoteProfiles.length) return
          set((s) => {
            const map = new Map(s.profiles.map((p) => [p.id, p]))
            remoteProfiles.forEach((p) => map.set(p.id, p))
            return { profiles: Array.from(map.values()) }
          })
        } catch (err) {
          console.debug('[DO Supabase] Profile sync skipped:', err)
        }
      },
    }),
    {
      name: 'do-community-v1',
      storage: browserStorage as never,
      partialize: (state) => ({
        ...state,
        preferences: { ...state.preferences, origin: undefined },
      }),
    },
  ),
)
export const selectProfile = (s: CommunityState) =>
  s.profiles.find((p) => p.id === s.activeId) ?? s.profiles[0]
export const matchingInterests = (event: PulseEvent, interests: EventGenre[]) =>
  interests.includes(event.genre)
