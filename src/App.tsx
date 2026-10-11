import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownWideNarrow,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronRight,
  Compass,
  Globe2,
  HelpCircle,
  List,
  Map,
  MapPin,
  Plus,
  Radio,
  Route,
  Search,
  SlidersHorizontal,
  Sparkles,
  WifiOff,
  X,
  Bell,
  MessageCircle,
  UserRound,
  Grid2X2,
  Users,
  Maximize2,
  Minimize2,
  Building2,
  Calendar,
  LogOut,
  LogIn,
  Heart,
  UserPlus,
  ShieldAlert,
  Wrench,
  Database,
  Lock,
} from 'lucide-react'
import { format } from 'date-fns'
import type { PulseEvent } from './domain'
import { CITIES, GENRES, getCity, genreInfo } from './data/cities'
import { useEventsStore, useSocialStore, useTripStore } from './stores'
import { filterEvents } from './services/filters'
import { countdown, isLive, localDate } from './services/time'
import { validateTripConfig } from './services/calendar'
import { generateItinerary } from './services/itineraryEngine'
import { Avatar, Dropdown, EmptyState, GenreIcon, Toast } from './components/ui'
import { MapView } from './components/MapView'
import { EventFeed } from './components/EventFeed'
import { EventDetails } from './components/EventDetails'
import { TripCreationModal } from './components/TripCreationModal'
import { TripWorkspace } from './components/TripWorkspace'
import { FreeModal } from './components/SocialModals'
import { HostModal } from './components/HostModal'
import { DataPanel } from './components/DataPanel'
import { MobileSheetHandle, type SheetPosition } from './components/MobileSheetHandle'
import { ThemeToggle } from './components/ThemeToggle'
import {
  ChatsWorkspace,
  ExploreWorkspace,
  GuestPreview,
  NotificationsModal,
  ProfileModal,
  ProfileWorkspace,
  TourModal,
} from './components/CommunityViews'
import { EditInterestsModal } from './components/EditInterestsModal'
import { EditProfileModal } from './components/EditProfileModal'
import { AuthModal } from './components/AuthModal'
import { AdminAuthModal } from './components/AdminAuthModal'
import { DiscoveryControls } from './components/DiscoveryControls'
import { ConsoleModal } from './components/ConsoleModal'
import { selectProfile, useCommunityStore } from './communityStore'
import { normalizeCollection } from './services/collection'
import { hostOf } from './services/community'

type View = 'discover' | 'online' | 'trips' | 'saved' | 'explore' | 'chats' | 'profile'
type Dialog =
  | 'trip'
  | 'free'
  | 'host'
  | 'data'
  | 'profile'
  | 'notifications'
  | 'tour'
  | 'filters'
  | 'console'
  | 'auth'
  | 'interests'
  | 'edit-profile'
  | 'admin-auth'
  | null

interface SearchSuggestion {
  key: string
  type: 'district' | 'city' | 'venue' | 'event'
  title: string
  subtitle: string
  point: [number, number]
  cityId: string
  districtName?: string
  event?: PulseEvent
  zoom: number
}

export default function App() {
  const { events, city, genre, time, date, radius, setFilter, savedIds } = useEventsStore()
  const profile = useCommunityStore(selectProfile),
    preferences = useCommunityStore((s) => s.preferences),
    following = useCommunityStore((s) => s.following[s.activeId]),
    notifications = useCommunityStore((s) => s.notifications),
    isAdmin = useCommunityStore((s) => s.isAdmin)
  const [editingEvent, setEditingEvent] = useState<PulseEvent | undefined>(),
    [hostPoint, setHostPoint] = useState<[number, number] | undefined>(),
    [discussion, setDiscussion] = useState(false)
  const [guestPreview, setGuestPreview] = useState<PulseEvent | null>(null)
  const knownEventIds = useRef(new Set(events.map((event) => event.id)))
  const unread = notifications.filter(
    (n) => (!n.profileId || n.profileId === profile.id) && !n.read,
  ).length
  const purge = useSocialStore((s) => s.purge),
    name = useSocialStore((s) => s.userName)
  const plans = useTripStore((s) => s.plans),
    addPlan = useTripStore((s) => s.addPlan)
  const [view, setView] = useState<View>('discover'),
    [dialog, setDialog] = useState<Dialog>(null),
    [authInitialMode, setAuthInitialMode] = useState<'login' | 'register'>('login'),
    [selected, setSelected] = useState<PulseEvent | null>(null),
    [mapSelected, setMapSelected] = useState<PulseEvent | null>(null)
  const [sheet, setSheet] = useState<SheetPosition>('peek')
  const [query, setQuery] = useState(''),
    [citySearch, setCitySearch] = useState(''),
    [sort, setSort] = useState('recommended'),
    [mobileView, setMobileView] = useState<'map' | 'list'>('list'),
    [maximizedMap, setMaximizedMap] = useState(false),
    [now, setNow] = useState(Date.now()),
    [toast, setToast] = useState(''),
    [offline, setOffline] = useState(!navigator.onLine),
    [searchTarget, setSearchTarget] = useState<{
      point: [number, number]
      label: string
      zoom?: number
    } | null>(null)
  const notify = useCallback((message: string) => setToast(message), []),
    closeToast = useCallback(() => setToast(''), [])

  useEffect(() => {
    const handleAdminKey = (e: KeyboardEvent) => {
      // Ctrl+Shift+A or Alt+M opens maintenance access for site administrators
      if (
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') ||
        (e.altKey && e.key.toLowerCase() === 'm')
      ) {
        e.preventDefault()
        setDialog(isAdmin ? 'console' : 'admin-auth')
      }
    }
    window.addEventListener('keydown', handleAdminKey)
    return () => window.removeEventListener('keydown', handleAdminKey)
  }, [isAdmin])

  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      const adminParam = url.searchParams.get('admin')
      if (adminParam === 'true' || adminParam === 'maintenance') {
        setDialog(isAdmin ? 'console' : 'admin-auth')
        url.searchParams.delete('admin')
        window.history.replaceState({}, '', url)
      }
    } catch {
      // ignore
    }
  }, [isAdmin])
  useEffect(() => {
    if (!maximizedMap) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMaximizedMap(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [maximizedMap])
  useEffect(() => {
    if (view !== 'discover' && view !== 'saved') {
      setMaximizedMap(false)
    }
  }, [view])
  useEffect(() => {
    purge()
    const interval = setInterval(() => {
      setNow(Date.now())
      purge()
    }, 30000)
    const online = () => setOffline(!navigator.onLine)
    window.addEventListener('online', online)
    window.addEventListener('offline', online)
    return () => {
      clearInterval(interval)
      window.removeEventListener('online', online)
      window.removeEventListener('offline', online)
    }
  }, [purge])
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/data/collected-events.json', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json'))
          return
        const payload: unknown = await response.json()
        const result = normalizeCollection(payload, useEventsStore.getState().events)
        useEventsStore.getState().addEvents([...result.events, ...result.updates])
      })
      .catch(() => {
        /* Collection is optional; local seeds remain available. */
      })

    // Cloud Database: background sync with Supabase project DO
    void useEventsStore
      .getState()
      .syncWithSupabase()
      .then((res) => {
        if (res.ok && res.count > 0) {
          notify(`Synchronized ${res.count} cloud events from Supabase`)
        }
      })
      .catch(() => {})
    void useTripStore.getState().syncWithSupabase().catch(() => {})
    void useSocialStore.getState().syncBeacons().catch(() => {})
    void useCommunityStore.getState().syncProfilesWithSupabase().catch(() => {})
    void useCommunityStore.getState().initAuth().catch(() => {})

    return () => {
      controller.abort()
    }
  }, [notify])
  useEffect(() => {
    if (selected?.id) {
      void useSocialStore.getState().loadEventMessages(selected.id)
    }
  }, [selected?.id])
  useEffect(() => {
    const joined = useSocialStore.getState().goingIds
    const community = useCommunityStore.getState()
    for (const event of events) {
      const minutes = (+new Date(event.startTime) - now) / 60000
      const id = `reminder-${profile.id}-${event.id}`
      if (
        joined.includes(event.id) &&
        minutes > 0 &&
        minutes <= 60 &&
        !event.archived &&
        !community.notifications.some((n) => n.id === id)
      )
        community.notify({
          id,
          type: 'reminder',
          title: 'A good moment is getting closer',
          body: `${event.title} starts in about ${Math.ceil(minutes)} minutes.`,
          eventId: event.id,
        })
    }
  }, [events, now, profile.id])
  useEffect(() => {
    const community = useCommunityStore.getState()
    for (const event of events) {
      if (knownEventIds.current.has(event.id)) continue
      knownEventIds.current.add(event.id)
      if (
        event.archived ||
        event.concluded ||
        +new Date(event.endTime) <= Date.now() ||
        event.provenance === 'demo'
      )
        continue
      for (const [profileId, hosts] of Object.entries(community.following))
        if (hosts.includes(hostOf(event).id))
          community.notify({
            id: `new-host-event-${profileId}-${event.id}`,
            profileId,
            type: 'follow',
            title: 'A host you follow has a new moment',
            body: event.title,
            eventId: event.id,
          })
    }
  }, [events])
  useEffect(() => {
    const url = new URL(window.location.href),
      shared = url.searchParams.get('trip')
    if (shared) {
      try {
        const config: unknown = JSON.parse(shared)
        if (!validateTripConfig(config)) throw new Error('Invalid shared trip')
        const plan = generateItinerary(useEventsStore.getState().events, config)
        addPlan(plan)
        setView('trips')
        notify('A shared adventure, ready to make your own.')
      } catch {
        notify('That trip link could not be loaded. Try importing the trip JSON.')
      }
      url.searchParams.delete('trip')
      window.history.replaceState({}, '', url)
    }
  }, [addPlan, notify])
  const filtered = useMemo(() => {
    const list = filterEvents(
      events,
      {
        city,
        genre,
        time,
        date,
        query,
        radius,
        online: view === 'online',
        saved: view === 'saved' ? savedIds : undefined,
        preferences,
        interests: profile.interests,
        following,
      },
      new Date(now),
    )
    return sort === 'popular'
      ? [...list].sort((a, b) => (b.attendeesCount ?? 0) - (a.attendeesCount ?? 0))
      : sort === 'free'
        ? [...list].sort((a, b) => a.priceAmount - b.priceAmount)
        : list
  }, [
    events,
    city,
    genre,
    time,
    date,
    query,
    radius,
    view,
    savedIds,
    now,
    sort,
    preferences,
    profile.interests,
    following,
  ])
  const cityEvents = useMemo(
      () =>
        events.filter(
          (e) =>
            e.city === city &&
            !e.isOnline &&
            !e.archived &&
            !e.concluded &&
            +new Date(e.endTime) > now,
        ),
      [events, city, now],
    ),
    liveCount = cityEvents.filter((e) => isLive(e, now)).length

  const showEvent = (event: PulseEvent, conversation = false) => {
    if (profile.isGuest) {
      setGuestPreview(event)
      return
    }
    setDiscussion(conversation)
    setMapSelected(event)
    setSelected(event)
  }
  const changeView = (next: View) => {
    setView(next)
    setMapSelected(null)
    setQuery('')
    if (next !== 'discover') setSearchTarget(null)
    if (next === 'saved') setFilter({ time: 'all', genre: 'all' })
    else if (next === 'online') setFilter({ time: 'all' })
    else if (next === 'discover') setFilter({ time: 'all' })
  }
  const reset = () => {
    setQuery('')
    setSearchTarget(null)
    setFilter({ genre: 'all', time: 'all', radius: 0 })
  }
  const cityLabel = getCity(city)
  const profileView = view === 'profile' || view === 'chats'
  const openHost = () => {
    setEditingEvent(undefined)
    setHostPoint(undefined)
    if (profile.isGuest) {
      setAuthInitialMode('login')
      setDialog('auth')
    } else {
      setDialog('host')
    }
  }

  const suggestions = useMemo<SearchSuggestion[]>(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []

    const results: SearchSuggestion[] = []
    const seen = new Set<string>()

    // Worldwide global entry
    if (q.includes('world') || q.includes('global') || q.includes('earth') || q === 'all') {
      results.push({
        key: 'worldwide',
        type: 'city',
        title: 'Worldwide',
        subtitle: 'All events happening across the globe',
        point: [20, 0],
        cityId: 'all',
        zoom: 2.2,
      })
    }

    // 1. Districts in all CITIES (e.g. Indiranagar, Technopark, Varkala, Shibuya, etc.)
    for (const c of CITIES) {
      for (const d of c.districts) {
        if (d.name.toLowerCase().includes(q)) {
          const key = `district-${c.id}-${d.name}`
          if (!seen.has(key)) {
            seen.add(key)
            results.push({
              key,
              type: 'district',
              title: d.name,
              subtitle: `${c.name}, ${c.state ? `${c.state}, ` : ''}${c.country}`,
              point: d.point,
              cityId: c.id,
              districtName: d.name,
              zoom: 15,
            })
          }
        }
      }
    }

    // 2. Primary Cities & States
    for (const c of CITIES) {
      const matchCity =
        c.name.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        (c.state && c.state.toLowerCase().includes(q)) ||
        (c.id === 'trivandrum' && 'thiruvananthapuram'.includes(q)) ||
        (c.id === 'kozhikode' && 'calicut'.includes(q)) ||
        (c.id === 'kochi' && ('cochin'.includes(q) || 'ernakulam'.includes(q))) ||
        (c.id === 'bangalore' && 'bengaluru'.includes(q)) ||
        (c.id === 'alappuzha' && 'alleppey'.includes(q)) ||
        (c.id === 'kollam' && 'quilon'.includes(q)) ||
        (c.id === 'thrissur' && 'trichur'.includes(q)) ||
        (c.id === 'kannur' && 'cannanore'.includes(q)) ||
        (c.id === 'palakkad' && 'palghat'.includes(q))

      if (matchCity) {
        const key = `city-${c.id}`
        if (!seen.has(key)) {
          seen.add(key)
          results.push({
            key,
            type: 'city',
            title: c.name,
            subtitle: `${c.state ? `${c.state}, ` : ''}${c.country}`,
            point: c.mapCenter,
            cityId: c.id,
            zoom: 13,
          })
        }
      }
    }

    // 3. Venues from events
    for (const e of events) {
      if (e.venueName && e.venueName.toLowerCase().includes(q)) {
        const key = `venue-${e.venueName.toLowerCase()}`
        if (!seen.has(key)) {
          seen.add(key)
          results.push({
            key,
            type: 'venue',
            title: e.venueName,
            subtitle: `${getCity(e.city).name} · ${e.address}`,
            point: [e.latitude, e.longitude],
            cityId: e.city,
            event: e,
            zoom: 16,
          })
        }
      }
    }

    // 4. Events matching title
    for (const e of events) {
      if (e.title.toLowerCase().includes(q)) {
        const key = `event-${e.id}`
        if (!seen.has(key)) {
          seen.add(key)
          results.push({
            key,
            type: 'event',
            title: e.title,
            subtitle: `${getCity(e.city).name} · ${e.venueName}`,
            point: [e.latitude, e.longitude],
            cityId: e.city,
            event: e,
            zoom: 16,
          })
        }
      }
    }

    return results.slice(0, 6)
  }, [query, events])

  const handleSelectDistrict = (cityId: string, districtName: string, point: [number, number]) => {
    setFilter({ city: cityId })
    useCommunityStore.getState().setPreferences({ scope: 'city', district: districtName })
    setSearchTarget({
      point,
      label: `${districtName}, ${getCity(cityId).name}`,
      zoom: 15,
    })
    setMapSelected(null)
    setCitySearch('')
    if (view !== 'discover') setView('discover')
  }

  const handleSelectCity = (cityId: string) => {
    if (cityId === 'all') {
      setFilter({ city: 'all' })
      useCommunityStore.getState().setPreferences({ scope: 'global', district: undefined })
      setSearchTarget(null)
      setMapSelected(null)
      setCitySearch('')
      if (view !== 'discover') setView('discover')
      return
    }
    const targetCity = getCity(cityId)
    setFilter({ city: cityId })
    useCommunityStore.getState().setPreferences({ scope: 'city', district: undefined })
    setSearchTarget({
      point: targetCity.mapCenter,
      label: targetCity.name,
      zoom: 13,
    })
    setMapSelected(null)
    setCitySearch('')
    if (view !== 'discover') setView('discover')
  }

  const switcherMatches = useMemo(() => {
    const q = citySearch.trim().toLowerCase()
    if (!q) {
      return {
        districts:
          city !== 'all'
            ? (cityLabel.districts || []).map((d) => ({ city: cityLabel, district: d }))
            : [],
        cities: CITIES.slice(0, 50),
      }
    }
    const matchedDistricts: { city: (typeof CITIES)[0]; district: (typeof CITIES)[0]['districts'][0] }[] = []
    const matchedCities: (typeof CITIES)[0][] = []

    for (const c of CITIES) {
      const matchCity =
        c.name.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        (c.state && c.state.toLowerCase().includes(q)) ||
        (c.id === 'trivandrum' && 'thiruvananthapuram'.includes(q)) ||
        (c.id === 'kozhikode' && 'calicut'.includes(q)) ||
        (c.id === 'kochi' && ('cochin'.includes(q) || 'ernakulam'.includes(q))) ||
        (c.id === 'bangalore' && 'bengaluru'.includes(q)) ||
        (c.id === 'alappuzha' && 'alleppey'.includes(q)) ||
        (c.id === 'kollam' && 'quilon'.includes(q)) ||
        (c.id === 'thrissur' && 'trichur'.includes(q)) ||
        (c.id === 'kannur' && 'cannanore'.includes(q)) ||
        (c.id === 'palakkad' && 'palghat'.includes(q))

      if (matchCity) {
        matchedCities.push(c)
      }
      for (const d of c.districts) {
        if (d.name.toLowerCase().includes(q)) {
          matchedDistricts.push({ city: c, district: d })
        }
      }
    }

    return {
      districts: matchedDistricts,
      cities: matchedCities,
    }
  }, [citySearch, city, cityLabel])

  const handleSelectSuggestion = (item: SearchSuggestion) => {
    if (item.type === 'district' && item.districtName) {
      handleSelectDistrict(item.cityId, item.districtName, item.point)
    } else if (item.type === 'city') {
      handleSelectCity(item.cityId)
    } else {
      setFilter({ city: item.cityId })
      setSearchTarget({
        point: item.point,
        label: item.title,
        zoom: item.zoom,
      })
      if (item.event) {
        setMapSelected(item.event)
      } else {
        setMapSelected(null)
      }
    }
    setQuery('')
    setView('discover')
  }

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const q = query.trim()
    if (!q) return

    const lower = q.toLowerCase()
    if (lower === 'worldwide' || lower === 'world' || lower === 'global' || lower === 'all') {
      handleSelectCity('all')
      setQuery('')
      return
    }

    if (suggestions.length > 0) {
      handleSelectSuggestion(suggestions[0])
      return
    }

    const matchedDist = CITIES.flatMap((c) =>
      c.districts.map((d) => ({ city: c, district: d })),
    ).find((item) => item.district.name.toLowerCase().includes(lower))

    if (matchedDist) {
      handleSelectDistrict(matchedDist.city.id, matchedDist.district.name, matchedDist.district.point)
      setQuery('')
      return
    }

    const matchedCity = CITIES.find((c) => c.name.toLowerCase().includes(lower))
    if (matchedCity) {
      handleSelectCity(matchedCity.id)
      setQuery('')
      return
    }

    const matching = cityEvents.filter(
      (ev) =>
        ev.title.toLowerCase().includes(lower) ||
        ev.venueName.toLowerCase().includes(lower) ||
        ev.address.toLowerCase().includes(lower),
    )

    if (matching.length > 0) {
      const first = matching[0]
      setSearchTarget({
        point: [first.latitude, first.longitude],
        label: first.title,
        zoom: 15,
      })
      setMapSelected(first)
      setView('discover')
      return
    }

    setView('discover')
  }

  return (
    <div className={`app-shell view-${view}`}>
      <header className="global-header">
        <button className="wordmark" aria-label="DO home" onClick={() => changeView('discover')}>
          <span className="do-wordmark">
            DO<span className="do-period">.</span>
          </span>
          <span className="brand-caption">
            MAKE TIME
            <br />
            FOR A GOOD TIME.
          </span>
        </button>
        <form role="search" className="global-search" onSubmit={handleSearchSubmit}>
          <button
            type="submit"
            className="search-icon-btn"
            aria-label="Submit search"
            title="Search places or happenings"
          >
            <Search size={18} />
          </button>
          <input
            aria-label="Search events"
            placeholder="A moment, a place, a little adventure…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              if (view === 'trips' || profileView) setView('discover')
            }}
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery('')
                setSearchTarget(null)
              }}
            >
              <X size={14} />
            </button>
          ) : (
            <button type="submit" className="search-hint-btn" title="Explore matching places">
              <span className="search-hint">Explore</span>
            </button>
          )}
          {query.trim().length >= 2 && suggestions.length > 0 && (
            <div className="place-suggestions" role="listbox">
              {suggestions.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="suggestion-item"
                  onClick={() => handleSelectSuggestion(item)}
                >
                  <span className={`suggestion-icon icon-${item.type}`}>
                    {item.type === 'district' ? (
                      <MapPin size={13} />
                    ) : item.type === 'city' ? (
                      <Globe2 size={13} />
                    ) : item.type === 'venue' ? (
                      <Building2 size={13} />
                    ) : (
                      <Calendar size={13} />
                    )}
                  </span>
                  <div className="suggestion-text">
                    <strong>{item.title}</strong>
                    <span>{item.subtitle}</span>
                  </div>
                  <small className="suggestion-type-tag">
                    {item.type === 'district'
                      ? 'District'
                      : item.type === 'city'
                        ? 'City'
                        : item.type === 'venue'
                          ? 'Place'
                          : 'Event'}
                  </small>
                </button>
              ))}
            </div>
          )}
        </form>
        <div className="header-actions">
          <button className="host-button" aria-label="Host a happening" onClick={openHost}>
            <Plus size={16} />
            <span>Host a happening</span>
          </button>

          <ThemeToggle />
          <button
            className="icon-button notifications-trigger"
            aria-label={`Notifications, ${unread} unread`}
            onClick={() => setDialog('notifications')}
          >
            <Bell size={18} />
            {unread > 0 && <i />}
          </button>
          <Dropdown
            className="profile-trigger"
            width={240}
            align="right"
            ariaLabel="Open profile menu"
            label={<Avatar name={name} />}
          >
            {(close) => (
              <>
                <div className="profile-menu-header">
                  <strong>{profile.isGuest ? 'Guest Explorer' : `Hey, ${name}.`}</strong>
                  <span>{profile.isGuest ? 'Join DO to RSVP & connect.' : 'Make a little room for good things.'}</span>
                </div>
                {profile.isGuest ? (
                  <>
                    <button
                      className="menu-item primary-menu-item"
                      onClick={() => {
                        close()
                        setAuthInitialMode('login')
                        setDialog('auth')
                      }}
                    >
                      <LogIn size={15} />
                      Log in to account
                    </button>
                    <button
                      className="menu-item"
                      onClick={() => {
                        close()
                        setAuthInitialMode('register')
                        setDialog('auth')
                      }}
                    >
                      <UserPlus size={15} />
                      Create account
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="menu-item"
                      onClick={() => {
                        close()
                        setDialog('interests')
                      }}
                    >
                      <Heart size={15} />
                      Edit interests
                    </button>
                    <button
                      className="menu-item"
                      onClick={() => {
                        close()
                        setDialog('edit-profile')
                      }}
                    >
                      <Users size={15} />
                      Edit profile details
                    </button>
                  </>
                )}
                <button
                  className="menu-item"
                  onClick={() => {
                    close()
                    changeView('profile')
                  }}
                >
                  <UserRound size={15} />
                  My profile & reputation
                </button>
                <button
                  className="menu-item"
                  onClick={() => {
                    close()
                    changeView('chats')
                  }}
                >
                  <MessageCircle size={15} />
                  My conversations
                </button>
                <button
                  className="menu-item"
                  onClick={() => {
                    close()
                    changeView('saved')
                  }}
                >
                  <Bookmark size={15} />
                  Saved moments <small>{savedIds.length}</small>
                </button>
                {isAdmin && (
                  <div className="admin-menu-section">
                    <span className="menu-eyebrow admin-eyebrow">
                      <ShieldAlert size={12} />
                      ADMIN MAINTENANCE
                    </span>
                    <button
                      className="menu-item admin-menu-item"
                      onClick={() => {
                        close()
                        setDialog('console')
                      }}
                    >
                      <Wrench size={15} />
                      Site Maintenance Console
                    </button>
                    <button
                      className="menu-item admin-menu-item"
                      onClick={() => {
                        close()
                        setDialog('data')
                      }}
                    >
                      <Database size={15} />
                      Data Control Room
                    </button>
                    <button
                      className="menu-item admin-lock-btn"
                      onClick={() => {
                        close()
                        useCommunityStore.getState().setAdminStatus(false)
                        notify('Admin maintenance locked.')
                      }}
                    >
                      <Lock size={15} />
                      Lock Admin Mode
                    </button>
                  </div>
                )}
                {!profile.isGuest && (
                  <button
                    className="menu-item danger-menu-item"
                    onClick={async () => {
                      close()
                      await useCommunityStore.getState().logout()
                      notify('You have been logged out.')
                    }}
                  >
                    <LogOut size={15} />
                    Log out
                  </button>
                )}
              </>
            )}
          </Dropdown>
        </div>
      </header>
      <div className="app-body">
        <aside className="sidebar">
          <nav aria-label="Main navigation">
            {(
              [
                { id: 'discover', label: 'Discover', Icon: Compass },
                { id: 'online', label: 'Online events', Icon: Globe2 },
                { id: 'trips', label: 'My trips', Icon: Route },
                { id: 'saved', label: 'Saved moments', Icon: Bookmark },
                { id: 'explore', label: 'Explore all events', Icon: Grid2X2 },
                { id: 'chats', label: 'My conversations', Icon: MessageCircle },
                { id: 'profile', label: 'My profile', Icon: UserRound },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                className={`sidebar-item ${view === item.id ? 'active' : ''}`}
                onClick={() => changeView(item.id)}
                aria-label={item.label}
                title={item.label}
              >
                <item.Icon size={21} />
                {item.id === 'saved' && savedIds.length > 0 && <i />}
                <span>
                  {item.id === 'discover'
                    ? 'Explore'
                    : item.id === 'online'
                      ? 'Online'
                      : item.id === 'trips'
                        ? 'Trips'
                        : item.id === 'saved'
                          ? 'Saved'
                          : item.id === 'explore'
                            ? 'Browse'
                            : item.id === 'chats'
                              ? 'Chats'
                              : 'You'}
                </span>
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <button
              className="sidebar-item"
              aria-label="About DO"
              title="About & data"
              onClick={() => setDialog('tour')}
            >
              <HelpCircle size={20} />
            </button>
            {isAdmin && (
              <button
                className="sidebar-item admin-sidebar-btn"
                aria-label="Site Maintenance Console"
                title="Site Maintenance Console"
                onClick={() => setDialog('console')}
              >
                <Wrench size={20} />
              </button>
            )}
            <span className="sidebar-line" />
            <span className="sidebar-tiny-pulse">✳</span>
          </div>
        </aside>
        <main className="main-area">
          <section className="discovery-heading">
            <div>
              <span className="eyebrow">
                <span className="tiny-star">✳</span>
                {view === 'trips'
                  ? 'SOMEWHERE NEW. SOMETHING YOU.'
                  : view === 'profile'
                    ? 'YOUR LITTLE CORNER OF THE WORLD'
                    : view === 'chats'
                      ? 'MAKE TIME FOR A CONVERSATION'
                      : view === 'online'
                        ? 'GOOD CONNECTIONS KNOW NO BORDERS'
                        : view === 'saved'
                          ? 'A LITTLE COLLECTION OF POSSIBILITIES'
                          : 'GO OUT. TUNE IN. FEEL SOMETHING.'}
              </span>
              <h1>
                {view === 'profile' ? (
                  <>
                    Make yourself <span>at home.</span>
                  </>
                ) : view === 'chats' ? (
                  <>
                    A place for <span>your people.</span>
                  </>
                ) : view === 'online' ? (
                  <>
                    A world of <span>good company.</span>
                  </>
                ) : view === 'saved' ? (
                  <>
                    Keep the <span>good ones close.</span>
                  </>
                ) : view === 'trips' ? (
                  <>
                    Let your <span>curiosity lead.</span>
                  </>
                ) : (
                  <>
                    Find your next <span>moment.</span>
                  </>
                )}
              </h1>
            </div>
            <button className="primary-button plan-button" onClick={() => setDialog('trip')}>
              <Route size={17} />
              Plan a trip
              <ArrowUpRight size={17} />
            </button>
          </section>
          <div className="view-bar">
            <nav aria-label="Views">
              <button
                className={view === 'discover' && city !== 'all' ? 'active' : ''}
                onClick={() => {
                  if (city === 'all') handleSelectCity('bangalore')
                  changeView('discover')
                }}
              >
                <Compass size={16} />
                Nearby happenings
                {liveCount > 0 && <span className="tab-badge">{liveCount} LIVE</span>}
              </button>
              <button
                className={view === 'discover' && city === 'all' ? 'active' : ''}
                onClick={() => {
                  handleSelectCity('all')
                  if (view !== 'discover') changeView('discover')
                }}
                title="View all events happening across the world at once"
              >
                <Globe2 size={16} />
                Worldwide
                <span className="tab-badge">Global</span>
              </button>
              <button
                className={view === 'chats' ? 'active' : ''}
                onClick={() => changeView('chats')}
              >
                <MessageCircle size={16} />
                <span>Chats</span>
              </button>
              <button
                className={view === 'profile' ? 'active' : ''}
                onClick={() => changeView('profile')}
              >
                <UserRound size={16} />
                <span>My profile</span>
              </button>
              <button
                className={view === 'online' ? 'active' : ''}
                onClick={() => changeView('online')}
              >
                <Globe2 size={16} />
                Online events
              </button>
              <button
                className={view === 'trips' ? 'active' : ''}
                onClick={() => changeView('trips')}
              >
                <Route size={16} />
                My trips{plans.length > 0 && <span className="small-count">{plans.length}</span>}
              </button>
            </nav>
            <Dropdown
              className="city-switcher"
              align="right"
              width={320}
              label={
                city === 'all' ? (
                  <>
                    <Globe2 size={15} />
                    <strong>Worldwide</strong>
                    <span>All events</span>
                  </>
                ) : preferences.district ? (
                  <>
                    <MapPin size={15} />
                    <strong>{preferences.district}</strong>
                    <span>{cityLabel.name}</span>
                  </>
                ) : (
                  <>
                    <MapPin size={15} />
                    <strong>{cityLabel.name}</strong>
                    <span>{cityLabel.country}</span>
                  </>
                )
              }
            >
              {(close) => (
                <>
                  <span className="menu-eyebrow">EXPLORE BY PLACE</span>
                  <div className="menu-search">
                    <Search size={14} />
                    <input
                      aria-label="Search supported cities and districts"
                      value={citySearch}
                      onChange={(e) => setCitySearch(e.target.value)}
                      placeholder="Search city, district, or place..."
                    />
                    {citySearch && (
                      <button
                        type="button"
                        className="clear-search-btn"
                        onClick={() => setCitySearch('')}
                        aria-label="Clear place search"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <button
                    className={`menu-item worldwide-menu-item ${city === 'all' ? 'active-item' : ''}`}
                    onClick={() => {
                      handleSelectCity('all')
                      close()
                    }}
                  >
                    <Globe2 size={15} />
                    <div className="menu-item-text">
                      <strong>Worldwide</strong>
                      <small>All events happening around the world at once</small>
                    </div>
                    {city === 'all' && <Check size={14} />}
                  </button>
                  <button
                    className="menu-item"
                    onClick={() => {
                      close()
                      setDialog('filters')
                    }}
                  >
                    <SlidersHorizontal size={14} />
                    <div className="menu-item-text">
                      <span>Location scopes & filters</span>
                    </div>
                  </button>
                  {!citySearch.trim() ? (
                    <>
                      {city !== 'all' && cityLabel.districts && cityLabel.districts.length > 0 && (
                        <>
                          <span className="menu-eyebrow">
                            DISTRICTS IN {cityLabel.name.toUpperCase()} ({cityLabel.districts.length})
                          </span>
                          <div className="switcher-district-grid">
                            {cityLabel.districts.map((d) => (
                              <button
                                key={d.name}
                                className={`menu-item district-menu-item ${preferences.district === d.name ? 'active-item' : ''}`}
                                onClick={() => {
                                  handleSelectDistrict(city, d.name, d.point)
                                  close()
                                }}
                              >
                                <MapPin size={13} />
                                <div className="menu-item-text">
                                  <span>{d.name}</span>
                                </div>
                                {preferences.district === d.name && <Check size={13} />}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                      <span className="menu-eyebrow">MAJOR CITIES & REGIONS</span>
                      {CITIES.slice(0, 50).map((c) => (
                        <button
                          className={`menu-item ${c.id === city && !preferences.district ? 'active-item' : ''}`}
                          key={c.id}
                          onClick={() => {
                            handleSelectCity(c.id)
                            close()
                          }}
                        >
                          <MapPin size={14} />
                          <div className="menu-item-text">
                            <span>{c.name}</span>
                            <small>
                              {c.state ? `${c.state}, ` : ''}
                              {c.country}
                              {c.districts && c.districts.length > 0
                                ? ` · ${c.districts.length} districts`
                                : ''}
                            </small>
                          </div>
                          {c.id === city && !preferences.district && <Check size={14} />}
                        </button>
                      ))}
                    </>
                  ) : (
                    <>
                      {switcherMatches.districts.length > 0 && (
                        <>
                          <span className="menu-eyebrow">
                            MATCHING DISTRICTS & LOCAL PLACES ({switcherMatches.districts.length})
                          </span>
                          {switcherMatches.districts.slice(0, 30).map(({ city: c, district: d }) => (
                            <button
                              key={`${c.id}-${d.name}`}
                              className={`menu-item district-menu-item ${preferences.district === d.name && c.id === city ? 'active-item' : ''}`}
                              onClick={() => {
                                handleSelectDistrict(c.id, d.name, d.point)
                                close()
                              }}
                            >
                              <MapPin size={13} />
                              <div className="menu-item-text">
                                <strong>{d.name}</strong>
                                <small>
                                  {c.name}, {c.state ? `${c.state}, ` : ''}{c.country}
                                </small>
                              </div>
                              {preferences.district === d.name && c.id === city && (
                                <Check size={13} />
                              )}
                            </button>
                          ))}
                        </>
                      )}
                      {switcherMatches.cities.length > 0 && (
                        <>
                          <span className="menu-eyebrow">
                            MATCHING CITIES & REGIONS ({switcherMatches.cities.length})
                          </span>
                          {switcherMatches.cities.slice(0, 30).map((c) => (
                            <button
                              className={`menu-item ${c.id === city && !preferences.district ? 'active-item' : ''}`}
                              key={c.id}
                              onClick={() => {
                                handleSelectCity(c.id)
                                close()
                              }}
                            >
                              <Globe2 size={14} />
                              <div className="menu-item-text">
                                <strong>{c.name}</strong>
                                <small>
                                  {c.state ? `${c.state}, ` : ''}{c.country}
                                  {c.districts && c.districts.length > 0
                                    ? ` · ${c.districts.length} districts`
                                    : ''}
                                </small>
                              </div>
                              {c.id === city && !preferences.district && <Check size={14} />}
                            </button>
                          ))}
                        </>
                      )}
                      {switcherMatches.cities.length === 0 &&
                        switcherMatches.districts.length === 0 && (
                          <div className="menu-empty">
                            No cities or districts found for &ldquo;{citySearch}&rdquo;
                          </div>
                        )}
                    </>
                  )}
                </>
              )}
            </Dropdown>
          </div>
          {offline && (
            <div className="offline-banner">
              <WifiOff size={14} />
              You’re offline. Your saved events and trips are still available.
            </div>
          )}
          {view === 'profile' ? (
            <ProfileWorkspace
              onSelect={showEvent}
              onEdit={() => setDialog(profile.isGuest ? 'auth' : 'edit-profile')}
              onEditInterests={() => setDialog('interests')}
              onLogin={() => {
                setAuthInitialMode('login')
                setDialog('auth')
              }}
              onRegister={() => {
                setAuthInitialMode('register')
                setDialog('auth')
              }}
              onLogout={async () => {
                await useCommunityStore.getState().logout()
                notify('You have been logged out.')
              }}
              isAdmin={isAdmin}
              onConsole={isAdmin ? () => setDialog('console') : undefined}
              onEditHosted={(event) => {
                setEditingEvent(event)
                setHostPoint([event.latitude, event.longitude])
                setDialog('host')
              }}
              onDeleteHosted={(eventId) => {
                useEventsStore.getState().deleteEvent(eventId)
                useCommunityStore.getState().removeHost(eventId)
                notify('Happening removed from database & profile.')
              }}
              notify={notify}
            />
          ) : view === 'chats' ? (
            <ChatsWorkspace onSelect={showEvent} />
          ) : view === 'trips' ? (
            <TripWorkspace
              onCreate={() => setDialog('trip')}
              onSelect={showEvent}
              notify={notify}
            />
          ) : (
            <>
              <div className="filter-bar">
                <div className="time-filters">
                  {(
                    [
                      { id: 'live', label: 'Live now' },
                      { id: 'today', label: 'Today' },
                      { id: 'tomorrow', label: 'Tomorrow' },
                      { id: 'weekend', label: 'This weekend' },
                      { id: 'week', label: 'This week' },
                      { id: 'upcoming', label: 'Upcoming' },
                      { id: 'all', label: 'Anytime' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      className={`time-pill ${time === t.id ? 'active' : ''}`}
                      onClick={() => setFilter({ time: t.id })}
                    >
                      {t.id === 'live' && <span className="status-dot" />}
                      {t.label}
                    </button>
                  ))}
                  <Dropdown
                    width={235}
                    className={`time-pill date-pill ${time === 'date' ? 'active' : ''}`}
                    label={
                      <>
                        {time === 'date'
                          ? format(new Date(`${date}T12:00`), 'MMM d')
                          : 'Pick a date'}
                      </>
                    }
                  >
                    {(close) => (
                      <div className="date-popover">
                        <span className="field-label">A day to look forward to</span>
                        <input
                          aria-label="Filter by date"
                          type="date"
                          min={localDate()}
                          value={date}
                          onChange={(e) => {
                            if (e.target.value) {
                              setFilter({ date: e.target.value, time: 'date' })
                              close()
                            }
                          }}
                        />
                        <p>Event times use your browser’s timezone.</p>
                      </div>
                    )}
                  </Dropdown>
                </div>
                <div className="genre-filters">
                  <button
                    className="genre-dropdown advanced-filters"
                    aria-label="Discovery filters and location scope"
                    onClick={() => setDialog('filters')}
                  >
                    <SlidersHorizontal size={14} />
                    <span>{preferences.scope === 'global' ? 'Worldwide' : 'Filters'}</span>
                  </button>
                  <Dropdown
                    width={240}
                    align="right"
                    className={`genre-dropdown ${genre !== 'all' ? 'active' : ''}`}
                    label={
                      <>
                        <SlidersHorizontal size={14} />
                        {genre === 'all' ? 'All vibes' : genreInfo(genre).short}
                      </>
                    }
                  >
                    {(close) => (
                      <>
                        <span className="menu-eyebrow">FOLLOW YOUR VIBE</span>
                        <button
                          className="menu-item"
                          onClick={() => {
                            setFilter({ genre: 'all' })
                            close()
                          }}
                        >
                          <Sparkles size={15} />
                          All vibes{genre === 'all' && <Check size={14} />}
                        </button>
                        {GENRES.map((g) => (
                          <button
                            key={g.id}
                            className="menu-item"
                            onClick={() => {
                              setFilter({ genre: g.id })
                              close()
                            }}
                          >
                            <span style={{ color: g.color }}>
                              <GenreIcon genre={g.id} />
                            </span>
                            {g.label}
                            {genre === g.id && <Check size={14} />}
                          </button>
                        ))}
                      </>
                    )}
                  </Dropdown>
                  {view !== 'online' && (
                    <Dropdown
                      width={210}
                      align="right"
                      className="radius-dropdown"
                      label={
                        <>
                          <MapPin size={14} />
                          {radius ? `Within ${radius} km` : 'City-wide'}
                        </>
                      }
                    >
                      {(close) => (
                        <>
                          {[0, 2, 5, 10, 25].map((r) => (
                            <button
                              className="menu-item"
                              key={r}
                              onClick={() => {
                                setFilter({ radius: r })
                                close()
                              }}
                            >
                              {r ? `Within ${r} km of center` : 'Anywhere in the city'}
                              {radius === r && <Check size={14} />}
                            </button>
                          ))}
                        </>
                      )}
                    </Dropdown>
                  )}
                  {view !== 'online' && (
                    <button
                      type="button"
                      className={`genre-dropdown map-toggle-btn ${maximizedMap ? 'active' : ''}`}
                      onClick={() => setMaximizedMap((prev) => !prev)}
                      aria-label={maximizedMap ? 'Restore split view' : 'Maximize full-size map'}
                      title={maximizedMap ? 'Restore split view (Esc)' : 'Maximize full-size map'}
                    >
                      {maximizedMap ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                      <span>{maximizedMap ? 'Split view' : 'Full map'}</span>
                    </button>
                  )}
                </div>
              </div>
              {view === 'explore' ? (
                <ExploreWorkspace events={filtered} onSelect={showEvent} now={now} />
              ) : view === 'online' ? (
                <section className="online-workspace">
                  <div className="online-intro">
                    <div>
                      <span className="eyebrow">
                        <span className="status-dot" />
                        THE INTERNET, A LITTLE MORE HUMAN
                      </span>
                      <h2>
                        Your people are out there.
                        <br />
                        <span>Sometimes, they’re online.</span>
                      </h2>
                      <p>
                        Live conversations, shared ideas, and a chance to find your crowd.
                        <br />
                        Every time is local to you:{' '}
                        {Intl.DateTimeFormat().resolvedOptions().timeZone}.
                      </p>
                    </div>
                    <div className="online-orbit">
                      <Globe2 size={58} />
                      <span />
                      <span />
                    </div>
                  </div>
                  <div className="feed-header">
                    <h2>{filtered.length} ways to tune in</h2>
                    <span className="timezone-label">
                      Local time · {format(new Date(now), 'h:mm a')}
                    </span>
                  </div>
                  {filtered.length ? (
                    <div className="online-feed-wrapper">
                      <EventFeed events={filtered} onSelect={showEvent} now={now} grid />
                    </div>
                  ) : (
                    <EmptyState
                      title="It’s a little quiet here."
                      description="Try a different date or vibe to find your next conversation."
                      action={
                        <button className="secondary-button" onClick={reset}>
                          Explore all online events
                        </button>
                      }
                    />
                  )}
                  {filtered.some((e) => isLive(e, now)) && (
                    <div className="online-live-footer">
                      <Radio size={15} />
                      {countdown(filtered[0].startTime, now)} · Drop into a conversation.
                    </div>
                  )}
                </section>
              ) : (
                <div
                  className={`discovery-workspace mobile-show-${mobileView} sheet-${sheet} ${maximizedMap ? 'is-map-maximized' : ''}`}
                >
                  <section className="discovery-map">
                    <MapView
                      city={city}
                      events={filtered}
                      selected={mapSelected}
                      onSelect={showEvent}
                      onPlan={() => setDialog('trip')}
                      onHostAt={(point) => {
                        setHostPoint(point)
                        setEditingEvent(undefined)
                        setDialog(profile.isGuest ? 'profile' : 'host')
                      }}
                      now={now}
                      isMaximized={maximizedMap}
                      searchTarget={searchTarget}
                      onClearSearchTarget={() => setSearchTarget(null)}
                      onToggleMaximize={() => {
                        setMaximizedMap((prev) => {
                          const next = !prev
                          if (next) setMobileView('map')
                          return next
                        })
                      }}
                    />
                  </section>
                  <section className="discovery-feed">
                    <MobileSheetHandle position={sheet} onChange={setSheet} />
                    <header className="feed-header">
                      <div>
                        <span className="eyebrow">
                          {view === 'saved' ? 'YOUR SAVED MOMENTS' : 'RIGHT PLACE. RIGHT NOW.'}
                        </span>
                        <h2>
                          {view === 'saved'
                            ? 'For another good day.'
                            : preferences.scope === 'global'
                              ? 'The world is alive.'
                              : preferences.scope === 'country' || preferences.scope === 'state'
                                ? 'Good things, all around.'
                                : 'The city is alive.'}
                          <span className="heading-spark">✳</span>
                        </h2>
                        <p>
                          {filtered.length} happenings
                          {query
                            ? ` matching “${query}”`
                            : time === 'today'
                              ? ' worth stepping out for'
                              : ' to make room for'}
                        </p>
                      </div>
                      <Dropdown
                        align="right"
                        width={200}
                        className="sort-trigger icon-button"
                        ariaLabel="Sort events"
                        label={<ArrowDownWideNarrow size={18} />}
                      >
                        {(close) => (
                          <>
                            {[
                              { id: 'recommended', label: 'Soonest first' },
                              { id: 'popular', label: 'Most popular' },
                              { id: 'free', label: 'Price: low to high' },
                            ].map((s) => (
                              <button
                                key={s.id}
                                className="menu-item"
                                onClick={() => {
                                  setSort(s.id)
                                  close()
                                }}
                              >
                                {s.label}
                                {sort === s.id && <Check size={14} />}
                              </button>
                            ))}
                          </>
                        )}
                      </Dropdown>
                    </header>
                    {filtered.length ? (
                      <EventFeed
                        events={filtered}
                        onSelect={showEvent}
                        selectedId={mapSelected?.id}
                        now={now}
                      />
                    ) : (
                      <EmptyState
                        title={
                          view === 'saved'
                            ? 'A little space for your favorites.'
                            : 'A little quiet, for now.'
                        }
                        description={
                          view === 'saved'
                            ? 'Tap the bookmark on any event to keep it close.'
                            : 'Try a different day, loosen your filters, or follow another vibe.'
                        }
                        action={
                          <button
                            className="secondary-button"
                            onClick={view === 'saved' ? () => changeView('discover') : reset}
                          >
                            {view === 'saved' ? 'Find a moment' : 'Show more possibilities'}
                            <ArrowRight size={15} />
                          </button>
                        }
                      />
                    )}
                    <footer className="feed-footer">
                      <span className="feed-footer-symbol">
                        <Sparkles size={17} />
                      </span>
                      <p>
                        Make a weekend of it.<span>Good moments make great itineraries.</span>
                      </p>
                      <button aria-label="Plan a weekend trip" onClick={() => setDialog('trip')}>
                        <ChevronRight size={20} />
                      </button>
                    </footer>
                  </section>
                  <button
                    className="mobile-view-toggle"
                    onClick={() => setMobileView(mobileView === 'list' ? 'map' : 'list')}
                  >
                    {mobileView === 'list' ? <Map size={16} /> : <List size={16} />}{' '}
                    {mobileView === 'list' ? 'Explore map' : 'See happenings'}
                  </button>
                </div>
              )}
            </>
          )}
          <footer className="app-footer">
            <span>
              <span className="status-dot" />
              GOOD THINGS ARE HAPPENING <i>·</i>
              <span className="footer-demo">CURATED DEMO</span>
            </span>
            <span>
              {format(new Date(now), 'EEE, MMM d')}
              <i>·</i>Made for showing up.
            </span>
            <span className="footer-local">
              Your world. A little more connected.
              <ArrowUpRight size={11} />
            </span>
          </footer>
        </main>
      </div>
      {selected && (
        <EventDetails
          event={selected}
          initialDiscussion={discussion}
          onClose={() => setSelected(null)}
          onEdit={(event) => {
            setSelected(null)
            setEditingEvent(event)
            setHostPoint([event.latitude, event.longitude])
            setDialog('host')
          }}
          notify={notify}
          now={now}
        />
      )}{' '}
      {dialog === 'trip' && (
        <TripCreationModal
          onClose={() => setDialog(null)}
          onCreated={() => {
            setDialog(null)
            setView('trips')
          }}
        />
      )}
      {dialog === 'free' && <FreeModal onClose={() => setDialog(null)} notify={notify} />}{' '}
      {dialog === 'host' && (
        <HostModal
          initialEvent={editingEvent}
          initialPoint={hostPoint}
          onClose={() => setDialog(null)}
          notify={notify}
          onPublished={(event) => {
            setDialog(null)
            setFilter({ city: event.city, time: 'all', genre: 'all' })
            setView(event.isOnline ? 'online' : 'discover')
            setMapSelected(event)
            setSelected(event)
          }}
        />
      )}
      {guestPreview && (
        <GuestPreview
          event={guestPreview}
          onClose={() => setGuestPreview(null)}
          onUnlock={() => {
            setGuestPreview(null)
            setAuthInitialMode('login')
            setDialog('auth')
          }}
        />
      )}
      {dialog === 'profile' && (
        <ProfileModal
          onClose={() => setDialog(null)}
          notify={notify}
          onOpenAuth={() => {
            setAuthInitialMode('login')
            setDialog('auth')
          }}
        />
      )}
      {dialog === 'interests' && (
        <EditInterestsModal onClose={() => setDialog(null)} notify={notify} />
      )}
      {dialog === 'edit-profile' && (
        <EditProfileModal onClose={() => setDialog(null)} notify={notify} />
      )}
      {dialog === 'auth' && (
        <AuthModal
          initialMode={authInitialMode}
          onClose={() => setDialog(null)}
          notify={notify}
        />
      )}
      {dialog === 'notifications' && (
        <NotificationsModal onClose={() => setDialog(null)} onSelect={showEvent} />
      )}
      {dialog === 'tour' && (
        <TourModal
          onClose={() => setDialog(null)}
          onAdminAccess={() => setDialog(isAdmin ? 'console' : 'admin-auth')}
        />
      )}
      {dialog === 'filters' && <DiscoveryControls onClose={() => setDialog(null)} />}
      {dialog === 'console' &&
        (isAdmin ? (
          <ConsoleModal
            onClose={() => setDialog(null)}
            notify={notify}
            onEdit={(event) => {
              setEditingEvent(event)
              setHostPoint(undefined)
              setDialog('host')
            }}
          />
        ) : (
          <AdminAuthModal
            onClose={() => setDialog(null)}
            notify={notify}
            onUnlocked={() => setDialog('console')}
          />
        ))}
      {dialog === 'data' &&
        (isAdmin ? (
          <DataPanel
            onClose={() => setDialog(null)}
            notify={notify}
            onImport={() => setView('trips')}
          />
        ) : (
          <AdminAuthModal
            onClose={() => setDialog(null)}
            notify={notify}
            onUnlocked={() => setDialog('data')}
          />
        ))}
      {dialog === 'admin-auth' && (
        <AdminAuthModal
          onClose={() => setDialog(null)}
          notify={notify}
          onUnlocked={() => setDialog('console')}
        />
      )}{' '}
      {toast && <Toast message={toast} onClose={closeToast} />}
    </div>
  )
}
