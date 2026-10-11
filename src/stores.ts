import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  DiscussionMessage,
  EventGenre,
  ImFreeBeacon,
  PulseEvent,
  TimeFilter,
  TravelPlan,
} from './domain'
import { generateBeacons, generateSeedEvents } from './data/mockEvents'
import { localDate } from './services/time'
import { verifyAndDeduplicate } from './services/eventTruthVerifier'
import { recalculateStops } from './services/itineraryEngine'
import { browserStorage } from './services/persistence'
import {
  eventsService,
  tripsService,
  beaconsService,
  messagesService,
} from './services/supabase'

interface EventsState {
  events: PulseEvent[]
  city: string
  genre: EventGenre | 'all'
  time: TimeFilter
  date: string
  radius: number
  savedIds: string[]
  lastSync: string | null
  supabaseSyncing: boolean
  setFilter: (
    filters: Partial<Pick<EventsState, 'city' | 'genre' | 'time' | 'date' | 'radius'>>,
  ) => void
  toggleSaved: (id: string) => void
  addEvents: (events: PulseEvent[]) => void
  updateEvent: (event: PulseEvent) => void
  archiveEvent: (id: string, archived: boolean) => void
  deleteEvent: (id: string) => void
  syncWithSupabase: () => Promise<{ ok: boolean; count: number; message?: string }>
}

export const useEventsStore = create<EventsState>()(
  persist(
    (set, get) => ({
      events: generateSeedEvents(),
      city: 'bangalore',
      genre: 'all',
      time: 'all',
      date: localDate(),
      radius: 0,
      savedIds: [],
      lastSync: null,
      supabaseSyncing: false,
      setFilter: (filters) => set(filters),
      toggleSaved: (id) =>
        set((state) => ({
          savedIds: state.savedIds.includes(id)
            ? state.savedIds.filter((s) => s !== id)
            : [...state.savedIds, id],
        })),
      addEvents: (events) =>
        set((state) => {
          const updates = new Map(
            events.filter((e) => e.provenance === 'collected').map((e) => [e.id, e]),
          )
          const refreshed = state.events.map((event) => {
            const update = updates.get(event.id)
            return update && event.provenance === 'collected'
              ? (verifyAndDeduplicate(
                  [{ ...update, archived: event.archived || update.archived }],
                  state.events.filter((e) => e.id !== event.id),
                ).events[0] ?? event)
              : event
          })
          const deduped = verifyAndDeduplicate(events, refreshed).events
          // Ensure any newly added community or user-hosted events are persisted to Supabase
          events
            .filter((e) => (e.provenance === 'community' || e.isCustom) && !e.id.startsWith('seed-') && !e.id.startsWith('online-'))
            .forEach((e) => {
              eventsService.upsertEvent(e).catch(() => {})
            })
          return {
            events: [...refreshed, ...deduped],
            lastSync: new Date().toISOString(),
          }
        }),
      updateEvent: (event) => {
        set((s) => ({
          events: s.events.map((e) =>
            e.id === event.id
              ? (verifyAndDeduplicate(
                  [event],
                  s.events.filter((other) => other.id !== event.id),
                ).events[0] ?? e)
              : e,
          ),
        }))
        // Background sync to Supabase
        eventsService.upsertEvent(event).catch(() => {})
      },
      archiveEvent: (id, archived) => {
        set((s) => ({ events: s.events.map((e) => (e.id === id ? { ...e, archived } : e)) }))
        // Background sync to Supabase
        eventsService.archiveEvent(id, archived).catch(() => {})
      },
      deleteEvent: (id) => {
        set((s) => ({ events: s.events.filter((e) => e.id !== id) }))
        // Background delete from Supabase
        eventsService.deleteEvent(id).catch(() => {})
      },
      syncWithSupabase: async () => {
        set({ supabaseSyncing: true })
        try {
          const remoteEvents = await eventsService.fetchEvents()
          if (!remoteEvents.length) {
            // Seed cloud database with initial verified local events
            const localToUpload = get().events.slice(0, 50)
            const uploaded = await eventsService.batchUpsertEvents(localToUpload)
            set({ supabaseSyncing: false, lastSync: new Date().toISOString() })
            return {
              ok: true,
              count: uploaded,
              message: `Connected to Supabase project Do. Populated ${uploaded} events to cloud database.`,
            }
          }
          const currentEvents = get().events
          // Merge remote updates into current events and add new remote events
          const remoteMap = new Map(remoteEvents.map((e) => [e.id, e]))
          const updatedCurrent = currentEvents.map((e) => remoteMap.get(e.id) ?? e)
          const newRemote = remoteEvents.filter((e) => !currentEvents.some((c) => c.id === e.id))
          const { events: newUnique } = verifyAndDeduplicate(newRemote, updatedCurrent)
          set({
            events: [...updatedCurrent, ...newUnique],
            lastSync: new Date().toISOString(),
            supabaseSyncing: false,
          })
          return {
            ok: true,
            count: remoteEvents.length,
            message: `Synced ${remoteEvents.length} events from Supabase.`,
          }
        } catch (err) {
          set({ supabaseSyncing: false })
          return {
            ok: false,
            count: 0,
            message: err instanceof Error ? err.message : 'Supabase sync failed.',
          }
        }
      },
    }),
    {
      name: 'pulse-events-v1',
      storage: browserStorage as never,
      version: 5,
      partialize: (state) => ({
        city: state.city,
        genre: state.genre,
        time: state.time,
        date: state.date,
        radius: state.radius,
        savedIds: state.savedIds,
        lastSync: state.lastSync,
        events: state.events.filter(
          (e) =>
            !e.id.startsWith('seed-') &&
            !e.id.startsWith('online-') &&
            !e.id.startsWith('scraped_') &&
            !e.id.startsWith('gdg_') &&
            !e.id.startsWith('devpost_') &&
            !e.id.startsWith('ingested-') &&
            (e.provenance === 'community' || e.isCustom),
        ),
      }),
      migrate: (persisted) => {
        const previous = persisted as Partial<EventsState>
        const refreshed = generateSeedEvents()
        const userCreated = (previous.events ?? []).filter(
          (e) =>
            (e.provenance === 'community' || e.isCustom) &&
            !e.id.startsWith('seed-') &&
            !e.id.startsWith('online-') &&
            !e.id.startsWith('scraped_') &&
            !e.id.startsWith('gdg_') &&
            !e.id.startsWith('devpost_') &&
            !e.id.startsWith('ingested-'),
        )
        return {
          city: previous.city ?? 'bangalore',
          genre: previous.genre ?? 'all',
          time: previous.time ?? 'all',
          date: previous.date ?? localDate(),
          radius: previous.radius ?? 0,
          savedIds: previous.savedIds ?? [],
          lastSync: previous.lastSync ?? null,
          events: [...refreshed, ...userCreated],
        }
      },
      merge: (persisted, current) => {
        const previous = persisted as Partial<EventsState> | undefined
        if (!previous?.events) return current
        const refreshed = generateSeedEvents()
        const userCreated = (previous.events ?? []).filter(
          (e) =>
            (e.provenance === 'community' || e.isCustom) &&
            !e.id.startsWith('seed-') &&
            !e.id.startsWith('online-') &&
            !e.id.startsWith('scraped_') &&
            !e.id.startsWith('gdg_') &&
            !e.id.startsWith('devpost_') &&
            !e.id.startsWith('ingested-'),
        )
        return { ...current, ...previous, events: [...refreshed, ...userCreated] }
      },
    },
  ),
)

interface TripState {
  plans: TravelPlan[]
  activeId: string | null
  addPlan: (plan: TravelPlan) => void
  setActive: (id: string) => void
  updatePlan: (plan: TravelPlan) => void
  deletePlan: (id: string) => void
  syncWithSupabase: (userId?: string) => Promise<void>
}

export const useTripStore = create<TripState>()(
  persist(
    (set, get) => ({
      plans: [],
      activeId: null,
      addPlan: (plan) => {
        set((s) => ({ plans: [plan, ...s.plans], activeId: plan.id }))
        tripsService.upsertPlan(plan).catch(() => {})
      },
      setActive: (id) => set({ activeId: id }),
      updatePlan: (plan) => {
        const recalculated = { ...plan, stops: recalculateStops(plan.stops) }
        set((s) => ({
          plans: s.plans.map((p) => (p.id === plan.id ? recalculated : p)),
        }))
        tripsService.upsertPlan(recalculated).catch(() => {})
      },
      deletePlan: (id) => {
        set((s) => ({
          plans: s.plans.filter((p) => p.id !== id),
          activeId: s.activeId === id ? null : s.activeId,
        }))
        tripsService.deletePlan(id).catch(() => {})
      },
      syncWithSupabase: async (userId = 'you') => {
        try {
          const remotePlans = await tripsService.fetchPlans(userId)
          if (!remotePlans.length) return
          const existingIds = new Set(get().plans.map((p) => p.id))
          const newPlans = remotePlans.filter((p) => !existingIds.has(p.id))
          if (newPlans.length) {
            set((s) => ({ plans: [...s.plans, ...newPlans] }))
          }
        } catch (err) {
          console.debug('[DO Supabase] Trip sync skipped:', err)
        }
      },
    }),
    { name: 'pulse-trips-v1', storage: browserStorage as never },
  ),
)

interface SocialState {
  userName: string
  beacons: ImFreeBeacon[]
  messages: Record<string, DiscussionMessage[]>
  goingIds: string[]
  setUserName: (name: string) => void
  publishBeacon: (beacon: ImFreeBeacon) => void
  removeBeacon: () => void
  purge: () => void
  addMessage: (eventId: string, message: DiscussionMessage) => void
  receiveMessage: (eventId: string, message: DiscussionMessage) => void
  loadEventMessages: (eventId: string) => Promise<void>
  syncBeacons: () => Promise<void>
  toggleGoing: (id: string) => void
}

export const useSocialStore = create<SocialState>()(
  persist(
    (set, get) => ({
      userName: 'Alex',
      beacons: generateBeacons(),
      messages: {},
      goingIds: [],
      setUserName: (userName) => set({ userName }),
      publishBeacon: (beacon) => {
        set((s) => ({
          beacons: [
            ...s.beacons.filter((b) => b.userId !== 'you' && +new Date(b.expiresAt) > Date.now()),
            beacon,
          ],
        }))
        beaconsService.publishBeacon(beacon).catch(() => {})
      },
      removeBeacon: () => {
        const currentBeacon = get().beacons.find((b) => b.userId === 'you')
        set((s) => ({ beacons: s.beacons.filter((b) => b.userId !== 'you') }))
        if (currentBeacon) {
          beaconsService.deleteBeacon(currentBeacon.id).catch(() => {})
        }
      },
      purge: () =>
        set((s) => ({ beacons: s.beacons.filter((b) => +new Date(b.expiresAt) > Date.now()) })),
      addMessage: (eventId, message) => {
        set((s) => {
          const list = s.messages[eventId] ?? []
          if (list.some((m) => m.id === message.id)) return s
          return {
            messages: { ...s.messages, [eventId]: [...list, message] },
          }
        })
        messagesService.postMessage(eventId, message).catch(() => {})
      },
      receiveMessage: (eventId, message) => {
        set((s) => {
          const current = s.messages[eventId] ?? []
          if (current.some((m) => m.id === message.id)) return s
          const updated = [...current, message].sort(
            (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
          )
          return {
            messages: { ...s.messages, [eventId]: updated },
          }
        })
      },
      loadEventMessages: async (eventId: string) => {
        try {
          const remoteMsgs = await messagesService.fetchMessagesForEvent(eventId)
          if (!remoteMsgs.length) return
          set((s) => {
            const current = s.messages[eventId] ?? []
            const map = new Map(current.map((m) => [m.id, m]))
            remoteMsgs.forEach((m) => map.set(m.id, m))
            return {
              messages: {
                ...s.messages,
                [eventId]: Array.from(map.values()).sort(
                  (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
                ),
              },
            }
          })
        } catch (err) {
          console.debug('[DO Supabase] Messages load skipped:', err)
        }
      },
      syncBeacons: async () => {
        try {
          const remoteBeacons = await beaconsService.fetchActiveBeacons()
          if (!remoteBeacons.length) return
          set((s) => {
            const map = new Map(s.beacons.map((b) => [b.id, b]))
            remoteBeacons.forEach((b) => map.set(b.id, b))
            return {
              beacons: Array.from(map.values()).filter(
                (b) => +new Date(b.expiresAt) > Date.now(),
              ),
            }
          })
        } catch (err) {
          console.debug('[DO Supabase] Beacons sync skipped:', err)
        }
      },
      toggleGoing: (id) =>
        set((s) => ({
          goingIds: s.goingIds.includes(id)
            ? s.goingIds.filter((e) => e !== id)
            : [...s.goingIds, id],
        })),
    }),
    { name: 'pulse-social-v1', storage: browserStorage as never },
  ),
)
