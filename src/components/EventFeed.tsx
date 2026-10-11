import { useEffect, useRef, useState, useMemo, type UIEvent } from 'react'
import type { PulseEvent } from '../domain'
import { EventCard } from './EventCard'
import { ErrorBoundary } from './ErrorBoundary'

export interface EventFeedProps {
  events: PulseEvent[]
  onSelect: (e: PulseEvent) => void
  selectedId?: string
  now: number
  grid?: boolean
  filterKey?: string
}

function EventFeedInner({
  events,
  onSelect,
  selectedId,
  now,
  grid = false,
  filterKey,
}: EventFeedProps) {
  const container = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ height: 700, width: 500, scroll: 0 })
  const rafRef = useRef<number | null>(null)
  const prevFilterKey = useRef<string | undefined>(filterKey)
  const prevFirstId = useRef<string | undefined>(events[0]?.id)
  const prevLength = useRef<number>(events.length)

  useEffect(() => {
    const el = container.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      const h = el.clientHeight
      const w = el.clientWidth
      if (h > 0 && w > 0) {
        setViewport((v) => (v.height === h && v.width === w ? v : { ...v, height: h, width: w }))
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Only reset scroll when filter criteria change or dataset changes significantly,
  // NOT on every 30s background timer tick or silent sync merge:
  useEffect(() => {
    let shouldReset = false
    if (filterKey !== undefined) {
      if (prevFilterKey.current !== undefined && prevFilterKey.current !== filterKey) {
        shouldReset = true
      }
      prevFilterKey.current = filterKey
    } else {
      const firstId = events[0]?.id
      const len = events.length
      if (
        (firstId !== prevFirstId.current && Math.abs(len - prevLength.current) > 5) ||
        (len === 0 && prevLength.current > 0)
      ) {
        shouldReset = true
      }
      prevFirstId.current = firstId
      prevLength.current = len
    }

    if (shouldReset) {
      if (container.current) container.current.scrollTop = 0
      setViewport((v) => (v.scroll === 0 ? v : { ...v, scroll: 0 }))
    }
  }, [filterKey, events])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  // For city event feeds (typically 50-200 events), native DOM rendering is vastly smoother,
  // supports native GPU compositing, avoids layout jitter, and eliminates render thrashing.
  // Virtualization is activated only for very large datasets (> 250 events).
  const virtual = events.length > 250
  const columns = grid ? (viewport.width > 680 ? 3 : viewport.width > 440 ? 2 : 1) : 1
  const rowHeight = grid ? 408 : 190
  const totalRows = Math.max(1, Math.ceil(events.length / columns))
  const safeScroll = Math.max(0, viewport.scroll || 0)
  const safeHeight = Math.max(100, viewport.height || 700)

  // Strictly clamp first and last rows to avoid any index out-of-bounds or negative array lengths:
  const first = virtual
    ? Math.max(0, Math.min(totalRows - 1, Math.floor(safeScroll / rowHeight) - 2))
    : 0
  const last = virtual
    ? Math.max(first, Math.min(totalRows, Math.ceil((safeScroll + safeHeight) / rowHeight) + 3))
    : totalRows

  const visibleRowCount = Math.max(0, last - first)
  const visibleRows = useMemo(
    () => Array.from({ length: visibleRowCount }, (_, i) => first + i),
    [visibleRowCount, first],
  )

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    if (!virtual) return
    const top = Math.max(0, e.currentTarget?.scrollTop ?? 0)
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
    }
    rafRef.current = requestAnimationFrame(() => {
      setViewport((v) => (Math.abs(v.scroll - top) < 25 ? v : { ...v, scroll: top }))
    })
  }

  return (
    <div
      className={`event-feed ${grid ? 'feed-grid' : ''} ${virtual ? 'feed-virtual' : ''}`}
      ref={container}
      onScroll={handleScroll}
    >
      {virtual ? (
        <div className="virtual-space" style={{ height: Math.max(1, totalRows * rowHeight) }}>
          {visibleRows.map((row) => (
            <div
              className="virtual-row"
              key={row}
              style={{
                top: row * rowHeight,
                height: rowHeight,
                gridTemplateColumns: `repeat(${columns},minmax(0,1fr))`,
              }}
            >
              {events.slice(row * columns, (row + 1) * columns).map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onSelect={onSelect}
                  selected={selectedId === event.id}
                  now={now}
                  compact={!grid}
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="event-feed-inner">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onSelect={onSelect}
              selected={selectedId === event.id}
              now={now}
              compact={!grid}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function EventFeed(props: EventFeedProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="event-feed-error" style={{ padding: '24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--ink-muted, #888)', fontSize: '13px', marginBottom: '12px' }}>
            Event list encountered an issue while scrolling.
          </p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => window.location.reload()}
          >
            Refresh feed
          </button>
        </div>
      }
    >
      <EventFeedInner {...props} />
    </ErrorBoundary>
  )
}
