import { memo, useEffect, useMemo, useRef, useState } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Tooltip,
  Polyline,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import {
  ArrowUpRight,
  Crosshair,
  Layers3,
  Minus,
  Plus,
  Radio,
  X,
  Navigation,
  Maximize2,
  Minimize2,
  MapPin,
} from 'lucide-react'
import type { ImFreeBeacon, ItineraryStop, PulseEvent } from '../domain'
import { GENRES, getCity } from '../data/cities'
import { spreadMarkers } from '../services/geo'
import { formatPrice, isLive } from '../services/time'
import { GenreIcon } from './ui'
import { createCustomPinIcon } from '../services/markers'
import { selectProfile, useCommunityStore } from '../communityStore'
import { useSocialStore } from '../stores'
import { getUserLocation } from '../services/geolocation'

const cartoKey = import.meta.env.VITE_CARTO_API_KEY as string | undefined
function MapController({
  city,
  selected,
  stops,
  fitEvents: _fitEvents,
  scope,
  origin,
  isMaximized,
  searchTarget,
  activeMobileView,
  isVisible,
}: {
  city: string
  selected: PulseEvent | null
  stops?: ItineraryStop[]
  fitEvents?: PulseEvent[]
  scope?: string
  origin?: [number, number]
  isMaximized?: boolean
  searchTarget?: { point: [number, number]; label?: string; zoom?: number } | null
  activeMobileView?: 'map' | 'list'
  isVisible?: boolean
}) {
  const map = useMap(),
    joined = useSocialStore((s) => s.goingIds)
  const prevCityRef = useRef(city)
  const prevSelectedIdRef = useRef<string | null>(null)
  const prevSearchTargetRef = useRef(searchTarget)
  const prevStopsLengthRef = useRef(stops?.length ?? 0)
  const prevOriginRef = useRef(origin)
  const isFirstMountRef = useRef(true)

  useEffect(() => {
    const handleInvalidate = () => {
      map.invalidateSize({ pan: false, debounceMoveend: true })
    }
    const t1 = setTimeout(handleInvalidate, 50)
    const t2 = setTimeout(handleInvalidate, 200)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [isMaximized, activeMobileView, isVisible, map])

  useEffect(() => {
    const container = map.getContainer()
    let prevW = container.clientWidth
    let prevH = container.clientHeight

    const handleResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      map.invalidateSize({ pan: false, debounceMoveend: true })

      if ((!prevW || !prevH) && w > 0 && h > 0) {
        if (city === 'all' || scope === 'global' || searchTarget?.label === 'Worldwide') {
          map.setView([20, 0], 2.2, { animate: false })
        } else {
          const target = origin ?? getCity(city).mapCenter
          map.setView(target, 13, { animate: false })
        }
      }
      prevW = w
      prevH = h
    }
    const observer = new ResizeObserver(handleResize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [map, city, scope, origin, searchTarget])

  useEffect(() => {
    const container = map.getContainer()
    if (!container.clientWidth || !container.clientHeight) return

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const stopsChanged = (stops?.length ?? 0) !== prevStopsLengthRef.current
    const selectedChanged = selected?.id !== prevSelectedIdRef.current
    const searchTargetChanged = searchTarget !== prevSearchTargetRef.current
    const cityChanged = city !== prevCityRef.current
    const originChanged = origin !== prevOriginRef.current
    const isFirst = isFirstMountRef.current

    // Update refs
    prevCityRef.current = city
    prevSelectedIdRef.current = selected?.id ?? null
    prevSearchTargetRef.current = searchTarget
    prevStopsLengthRef.current = stops?.length ?? 0
    prevOriginRef.current = origin
    isFirstMountRef.current = false

    // Avoid overriding user's manual map pans when filters or other props change
    if (
      !isFirst &&
      !stopsChanged &&
      !selectedChanged &&
      !searchTargetChanged &&
      !cityChanged &&
      !originChanged
    ) {
      return
    }

    if (stops?.length) {
      const bounds = L.latLngBounds(
        stops.map((s) => [s.event.latitude, s.event.longitude] as [number, number]),
      )
      if (!isFirst && !reduced)
        map.flyToBounds(bounds, { padding: [65, 65], maxZoom: 15, duration: 0.8 })
      else map.fitBounds(bounds, { padding: [65, 65], maxZoom: 15, animate: false })
    } else if (searchTarget?.point) {
      const zoom = searchTarget.zoom ?? 15
      if (!isFirst && !reduced) map.flyTo(searchTarget.point, zoom, { duration: 0.8 })
      else map.setView(searchTarget.point, zoom, { animate: false })
    } else if (selected && !selected.isOnline) {
      const isPrivateHidden = Boolean(selected.privateVenue && !joined.includes(selected.id))
      const target: [number, number] = isPrivateHidden
        ? [Math.round(selected.latitude * 100) / 100, Math.round(selected.longitude * 100) / 100]
        : [selected.latitude, selected.longitude]
      if (!isFirst && !reduced) map.flyTo(target, 15, { duration: 0.75 })
      else map.setView(target, 15, { animate: false })
    } else if (city === 'all' || scope === 'global' || searchTarget?.label === 'Worldwide') {
      const worldCenter: [number, number] = [20, 0]
      const worldZoom = 2.2
      if (!isFirst && !reduced) map.flyTo(worldCenter, worldZoom, { duration: 0.8 })
      else map.setView(worldCenter, worldZoom, { animate: false })
    } else {
      const target: [number, number] = origin ?? getCity(city).mapCenter
      const zoom = 13
      if (!isFirst && !reduced) map.flyTo(target, zoom, { duration: 0.7 })
      else map.setView(target, zoom, { animate: false })
    }
  }, [city, selected, stops, map, scope, origin, joined, searchTarget, activeMobileView, isVisible])
  return null
}
function MapControls({
  city,
  events,
  onError,
  onLocation,
  isMaximized,
  onToggleMaximize,
}: {
  city: string
  events: PulseEvent[]
  onError: (message: string) => void
  onLocation: (point: [number, number]) => void
  isMaximized?: boolean
  onToggleMaximize?: () => void
}) {
  const map = useMap()
  const [locating, setLocating] = useState(false)
  return (
    <div className="map-controls">
      <button aria-label="Zoom in" title="Zoom in" onClick={() => map.zoomIn()}>
        <Plus size={18} />
      </button>
      <button aria-label="Zoom out" title="Zoom out" onClick={() => map.zoomOut()}>
        <Minus size={18} />
      </button>
      <span />
      {onToggleMaximize && (
        <button
          type="button"
          aria-label={isMaximized ? 'Restore split view' : 'Maximize full-size map'}
          title={isMaximized ? 'Restore split view (Esc)' : 'Maximize full-size map'}
          className={isMaximized ? 'active-maximize' : ''}
          onClick={onToggleMaximize}
        >
          {isMaximized ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>
      )}
      <button
        type="button"
        aria-label="Locate me on map"
        title="Locate me on map"
        disabled={locating}
        onClick={async () => {
          setLocating(true)
          try {
            const point = await getUserLocation()
            map.flyTo(point, 14)
            onLocation(point)
          } catch (err) {
            onError((err as Error).message || 'Location access was unavailable. Use a city or drop a pin instead.')
          } finally {
            setLocating(false)
          }
        }}
      >
        <Navigation size={16} />
      </button>
      <button
        type="button"
        aria-label="Center map view"
        title="Center map view"
        onClick={() => {
          if (city === 'all') {
            map.flyTo([20, 0], 2.2)
          } else if (events.length === 1) {
            map.flyTo([events[0].latitude, events[0].longitude], 14)
          } else if (events.length > 1) {
            map.fitBounds(
              L.latLngBounds(events.map((e) => [e.latitude, e.longitude] as [number, number])),
              { padding: [50, 50], maxZoom: 14 },
            )
          } else {
            map.flyTo(getCity(city).mapCenter, 13)
          }
        }}
      >
        <Crosshair size={18} />
      </button>
    </div>
  )
}
function MapClick({ onPick }: { onPick?: (point: [number, number]) => void }) {
  useMapEvents({ click: (e) => onPick?.([e.latlng.lat, e.latlng.lng]) })
  return null
}
export interface MapViewProps {
  city: string
  events: PulseEvent[]
  selected?: PulseEvent | null
  onSelect?: (e: PulseEvent) => void
  beacons?: ImFreeBeacon[]
  stops?: ItineraryStop[]
  onPlan?: () => void
  picker?: boolean
  point?: [number, number]
  onPick?: (point: [number, number]) => void
  now?: number
  onHostAt?: (point: [number, number]) => void
  isMaximized?: boolean
  onToggleMaximize?: () => void
  searchTarget?: { point: [number, number]; label?: string; zoom?: number } | null
  onClearSearchTarget?: () => void
  activeMobileView?: 'map' | 'list'
  isVisible?: boolean
}
const clusterIconCache = new Map<number, L.DivIcon>()
function getClusterIcon(count: number): L.DivIcon {
  let icon = clusterIconCache.get(count)
  if (!icon) {
    icon = L.divIcon({
      className: 'do-cluster-marker',
      iconSize: [42, 42],
      iconAnchor: [21, 21],
      html: `<span>${count}</span>`,
    })
    clusterIconCache.set(count, icon)
  }
  return icon
}

function EventMarkers({
  events,
  points,
  selected,
  onSelect,
  stops,
  now,
}: {
  events: PulseEvent[]
  points: globalThis.Map<string, [number, number]>
  selected: PulseEvent | null
  onSelect?: (event: PulseEvent) => void
  stops?: ItineraryStop[]
  now: number
}) {
  const map = useMap(),
    [zoom, setZoom] = useState(() => map.getZoom()),
    [bounds, setBounds] = useState(() => map.getBounds()),
    profile = useCommunityStore(selectProfile),
    joined = useSocialStore((s) => s.goingIds)

  useEffect(() => {
    const update = () => {
      const b = map.getBounds()
      if (b && b.isValid()) setBounds(b)
      setZoom(map.getZoom())
    }
    map.on('resize', update)
    map.on('viewreset', update)
    map.on('moveend', update)
    map.on('zoomend', update)
    map.whenReady(update)
    return () => {
      map.off('resize', update)
      map.off('viewreset', update)
      map.off('moveend', update)
      map.off('zoomend', update)
    }
  }, [map])

  useMapEvents({
    moveend: () => {
      setBounds(map.getBounds())
      setZoom(map.getZoom())
    },
    zoomend: () => {
      setBounds(map.getBounds())
      setZoom(map.getZoom())
    },
  })

  // Viewport culling: only process events within or near the visible map bounds (plus 40% margin)
  const visibleEvents = useMemo(() => {
    if (
      zoom <= 4 ||
      stops?.length ||
      !bounds ||
      !bounds.isValid() ||
      bounds.getNorthEast().equals(bounds.getSouthWest())
    ) {
      return events
    }
    const padded = bounds.pad(0.4)
    return events.filter((e) => {
      if (selected && e.id === selected.id) return true
      const pt = points.get(e.id) ?? [e.latitude, e.longitude]
      return padded.contains(L.latLng(pt[0], pt[1]))
    })
  }, [events, points, bounds, zoom, stops, selected])

  const clusters = useMemo(() => {
    // At city, neighborhood, and street zoom (zoom > 5) or when following an itinerary, show every event at its authentic place
    if (stops?.length || zoom > 5) {
      return visibleEvents.map((e) => [e])
    }
    // Only cluster at macro world / continent view (zoom <= 5) to keep global navigation clear
    const cellSize = 60
    const groups = new Map<string, PulseEvent[]>()

    for (const event of visibleEvents) {
      const pt = points.get(event.id) ?? [event.latitude, event.longitude]
      const screenPt = map.project(L.latLng(pt[0], pt[1]), zoom)
      const cellX = Math.floor(screenPt.x / cellSize)
      const cellY = Math.floor(screenPt.y / cellSize)
      const key = `${cellX}:${cellY}`
      const existing = groups.get(key)
      if (existing) {
        existing.push(event)
      } else {
        groups.set(key, [event])
      }
    }
    return Array.from(groups.values())
  }, [visibleEvents, points, zoom, stops, map])

  return (
    <>
      {clusters.map((group) => {
        if (group.length > 1) {
          const center: [number, number] = [
            group.reduce((sum, e) => {
              const pt = points.get(e.id) ?? [e.latitude, e.longitude]
              return sum + pt[0]
            }, 0) / group.length,
            group.reduce((sum, e) => {
              const pt = points.get(e.id) ?? [e.latitude, e.longitude]
              return sum + pt[1]
            }, 0) / group.length,
          ]
          return (
            <Marker
              key={`cluster-${group[0].id}-${group.length}`}
              title={`${group.length} events · click to zoom in`}
              position={center}
              icon={getClusterIcon(group.length)}
              eventHandlers={{
                click: () => {
                  const coords = group.map((e) => {
                    const pt = points.get(e.id) ?? [e.latitude, e.longitude]
                    return pt as [number, number]
                  })
                  const b = L.latLngBounds(coords)
                  if (b.getNorthEast().equals(b.getSouthWest())) {
                    map.setView(b.getCenter(), Math.min(18, zoom + 2))
                  } else {
                    map.fitBounds(b, {
                      padding: [60, 60],
                      maxZoom: Math.min(18, zoom + 3),
                    })
                  }
                },
              }}
            />
          )
        }
        const event = group[0],
          raw = points.get(event.id) ?? [event.latitude, event.longitude],
          isPrivateHidden = Boolean(event.privateVenue && !joined.includes(event.id)),
          position: [number, number] = isPrivateHidden
            ? [Math.round(raw[0] * 100) / 100, Math.round(raw[1] * 100) / 100]
            : raw
        return (
          <Marker
            key={event.id}
            title={event.title}
            alt={event.title}
            position={position}
            icon={createCustomPinIcon(
              event.genre,
              isLive(event, now),
              selected?.id === event.id ||
                (profile.highlightInterests && profile.interests.includes(event.genre)),
              stops?.find((s) => s.event.id === event.id)?.sortOrder !== undefined
                ? stops.find((s) => s.event.id === event.id)!.sortOrder + 1
                : undefined,
            )}
            eventHandlers={{ click: () => onSelect?.(event) }}
          >
            <Tooltip direction="top" className="pulse-tooltip">
              <strong>{event.title}</strong>
              <span>
                {isPrivateHidden
                  ? `${getCity(event.city).name} · private venue`
                  : event.venueName}{' '}
                · {formatPrice(event)}
              </span>
            </Tooltip>
          </Marker>
        )
      })}
    </>
  )
}
export const MapView = memo(function MapView({
  city,
  events,
  selected = null,
  onSelect,
  stops,
  onPlan,
  picker = false,
  point,
  onPick,
  now = Date.now(),
  onHostAt,
  isMaximized = false,
  onToggleMaximize,
  searchTarget,
  onClearSearchTarget,
  activeMobileView,
  isVisible,
}: MapViewProps) {
  const [legend, setLegend] = useState(false),
    [tileError, setTileError] = useState(false),
    [storyDismissed, setStoryDismissed] = useState(false)
  const theme = useCommunityStore((s) => s.theme),
    preferences = useCommunityStore((s) => s.preferences)
  const [style, setStyle] = useState<'auto' | 'streets' | 'dark' | 'satellite'>('auto'),
    [dropped, setDropped] = useState<[number, number] | null>(null),
    [mapMessage, setMapMessage] = useState('')
  const [deviceDark, setDeviceDark] = useState(
      () => matchMedia('(prefers-color-scheme:dark)').matches,
    ),
    [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme:dark)')
    const update = () => setDeviceDark(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (!mapMessage) return
    const timer = setTimeout(() => setMapMessage(''), 5000)
    return () => clearTimeout(timer)
  }, [mapMessage])
  const dark = theme === 'dark' || (theme === 'system' && deviceDark),
    mapStyle = style === 'auto' ? (dark ? 'dark' : 'streets') : style
  const physical = useMemo(() => events.filter((e) => !e.isOnline), [events]),
    points = useMemo(() => spreadMarkers(physical), [physical])
  const origin = picker
    ? undefined
    : preferences.scope === 'nearby'
      ? preferences.origin
      : preferences.scope === 'city'
        ? getCity(city).districts.find((d) => d.name === preferences.district)?.point
        : undefined
  const positions = useMemo(
    () => stops?.map((s) => [s.event.latitude, s.event.longitude] as [number, number]) ?? [],
    [stops],
  )
  const currentCity = getCity(city)
  const scopeTitle = stops
    ? currentCity.name
    : city === 'all' || preferences.scope === 'global'
      ? 'Worldwide Happenings'
      : preferences.scope === 'country'
        ? currentCity.country
        : preferences.scope === 'state'
          ? (currentCity.state ?? currentCity.name)
          : preferences.scope === 'nearby'
            ? preferences.origin
              ? 'Near you'
              : `Near ${currentCity.name}`
            : preferences.district || currentCity.name
  return (
    <div
      className={`map-view ${picker ? 'map-picker' : ''} map-style-${mapStyle} ${!cartoKey ? 'map-osm' : ''}`}
    >
      <MapContainer
        center={getCity(city).mapCenter}
        zoom={city === 'all' ? 2 : 13}
        minZoom={2}
        maxZoom={18}
        zoomSnap={0.5}
        zoomDelta={0.5}
        wheelDebounceTime={50}
        maxBounds={[
          [-85, -180],
          [85, 180],
        ]}
        maxBoundsViscosity={1}
        zoomControl={false}
        attributionControl={!picker}
        preferCanvas
      >
        <TileLayer
          url={
            mapStyle === 'satellite'
              ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
              : cartoKey
                ? `https://{s}.basemaps.cartocdn.com/${mapStyle === 'dark' ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(cartoKey)}`
                : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
          }
          subdomains={cartoKey ? 'abcd' : 'abc'}
          maxZoom={19}
          keepBuffer={4}
          noWrap
          attribution={
            mapStyle === 'satellite'
              ? 'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community'
              : `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>${cartoKey ? ' &copy; <a href="https://carto.com/attributions">CARTO</a>' : ''}`
          }
          eventHandlers={{
            tileerror: () => setTileError(true),
            tileload: () => setTileError(false),
          }}
        />
        <MapController
          city={city}
          selected={selected}
          stops={stops}
          fitEvents={picker ? undefined : physical}
          scope={picker ? 'city' : preferences.scope}
          origin={origin}
          isMaximized={isMaximized}
          searchTarget={searchTarget}
          activeMobileView={activeMobileView}
          isVisible={isVisible}
        />
        <MapControls
          city={city}
          events={physical}
          onError={setMapMessage}
          onLocation={setUserLocation}
          isMaximized={isMaximized}
          onToggleMaximize={onToggleMaximize}
        />
        <MapClick onPick={picker ? onPick : setDropped} />
        {!picker && (
          <EventMarkers
            events={physical}
            points={points}
            selected={selected}
            onSelect={onSelect}
            stops={stops}
            now={now}
          />
        )}
        {userLocation && (
          <Marker
            position={userLocation}
            title="You are here"
            icon={L.divIcon({
              className: 'user-location-marker',
              iconSize: [22, 22],
              html: '<span></span>',
            })}
          >
            <Tooltip>Your location · only kept in memory</Tooltip>
          </Marker>
        )}
        {dropped && !picker && (
          <Marker
            position={dropped}
            title="Dropped pin"
            icon={createCustomPinIcon('social', false, true)}
          />
        )}

        {positions.length > 1 && (
          <>
            <Polyline
              positions={positions}
              pathOptions={{
                color: mapStyle === 'streets' ? '#222222' : '#f5f5f3',
                weight: 10,
                opacity: 0.12,
              }}
            />
            <Polyline
              positions={positions}
              pathOptions={{
                color: mapStyle === 'streets' ? '#222222' : '#f5f5f3',
                weight: 3,
                opacity: 0.9,
                dashArray: '8, 12',
                className: 'route-trail',
              }}
            />
          </>
        )}
        {picker && point && (
          <Marker
            title="Selected meetup location"
            position={point}
            icon={createCustomPinIcon('food', false, true)}
          />
        )}
        {searchTarget &&
          city !== 'all' &&
          preferences.scope !== 'global' &&
          searchTarget.label !== 'Worldwide' &&
          !(searchTarget.point[0] === 20 && searchTarget.point[1] === 0) && (
          <Marker
            position={searchTarget.point}
            title={searchTarget.label || 'Search destination'}
            icon={L.divIcon({
              className: 'search-target-marker',
              iconSize: [36, 36],
              iconAnchor: [18, 36],
              html: `<div class="search-target-pin"><span class="pin-pulse"></span><span class="pin-core">📍</span></div>`,
            })}
          >
            {searchTarget.label && (
              <Tooltip permanent direction="top" offset={[0, -28]} className="search-target-tooltip">
                <span>{searchTarget.label}</span>
              </Tooltip>
            )}
          </Marker>
        )}
      </MapContainer>
      {!picker && (
        <>
          <div className="map-city-card glass">
            <span className="map-city-symbol">
              <Radio size={15} />
            </span>
            <div>
              <strong>{scopeTitle}</strong>
              <span>
                {stops ? 'Your day, connected' : `${physical.length} matching happenings`}
              </span>
            </div>
            {preferences.scope !== 'global' && (
              <span className="city-country">{currentCity.country}</span>
            )}
          </div>
          <div className="map-style-switch glass">
            {(['auto', 'streets', 'dark', 'satellite'] as const).map((value) => (
              <button
                key={value}
                className={style === value ? 'active' : ''}
                aria-pressed={style === value}
                onClick={() => setStyle(value)}
              >
                {value === 'auto'
                  ? 'Auto'
                  : value === 'satellite'
                    ? 'Satellite'
                    : value === 'streets'
                      ? 'Streets'
                      : 'Mono'}
              </button>
            ))}
          </div>
          {searchTarget &&
            city !== 'all' &&
            preferences.scope !== 'global' &&
            searchTarget.label !== 'Worldwide' &&
            !(searchTarget.point[0] === 20 && searchTarget.point[1] === 0) && (
            <div className="map-top-actions">
              <div className="map-search-target-chip glass">
                <MapPin size={13} />
                <span>{searchTarget.label}</span>
                {onClearSearchTarget && (
                  <button
                    type="button"
                    aria-label="Clear location filter"
                    title="Clear location filter"
                    onClick={onClearSearchTarget}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}
          {!stops && !dropped && !storyDismissed && (
            <div className="map-story glass">
              <button
                type="button"
                className="map-story-close"
                aria-label="Dismiss message"
                title="Dismiss message"
                onClick={() => setStoryDismissed(true)}
              >
                <X size={12} />
              </button>
              <span className="eyebrow">
                <span className="tiny-star">✳</span> GOOD PLANS START HERE
              </span>
              <h3>
                Less scrolling.
                <br />
                More <span>being there.</span>
              </h3>
              <p>Your next favorite memory is closer than you think.</p>
              <button onClick={onPlan}>
                Make a little adventure <ArrowUpRight size={13} />
              </button>
            </div>
          )}
          <button
            className="map-legend-toggle glass"
            onClick={() => setLegend(!legend)}
            aria-label="Toggle map legend"
          >
            <Layers3 size={17} />
            {legend ? 'Hide legend' : 'Map legend'}
          </button>
          {legend && (
            <div className="map-legend glass">
              {GENRES.map((g) => (
                <span key={g.id} style={{ color: g.color }}>
                  <GenreIcon genre={g.id} />
                  {g.short}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {dropped && !picker && (
        <div className="dropped-pin-card glass">
          <button
            className="icon-button"
            aria-label="Clear dropped pin"
            onClick={() => setDropped(null)}
          >
            <X size={15} />
          </button>
          <span className="eyebrow">A PLACE TO START</span>
          <strong>
            {dropped[0].toFixed(5)}, {dropped[1].toFixed(5)}
          </strong>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${dropped.join(',')}`}
            target="_blank"
            rel="noreferrer"
          >
            Open in Google Maps ↗
          </a>
          {onHostAt && (
            <button className="primary-button" onClick={() => onHostAt(dropped)}>
              Host here
            </button>
          )}
        </div>
      )}
      {mapMessage && (
        <div className="map-offline" role="status">
          {mapMessage}
          <button aria-label="Dismiss map message" onClick={() => setMapMessage('')}>
            <X size={14} />
          </button>
        </div>
      )}
      {tileError && (
        <div className="map-offline">
          Map tiles are unavailable. Your events and saved plans are still here.
        </div>
      )}
      {picker && <div className="picker-instruction">Click the map to choose a meetup spot</div>}
    </div>
  )
})
