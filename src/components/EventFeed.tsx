import { useEffect, useRef, useState, useMemo, type UIEvent } from 'react'
import type { PulseEvent } from '../domain'
import { EventCard } from './EventCard'
import { ErrorBoundary } from './ErrorBoundary'

export function EventFeed({
  events,
  onSelect,
  selectedId,
  now,
  grid = false,
}: {
  events: PulseEvent[]
  onSelect: (e: PulseEvent) => void
  selectedId?: string
  now: number
  grid?: boolean
}) {
  const container = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ height: 700, width: 500, scroll: 0 })
  const rafRef = useRef<number | null>(null)

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

  useEffect(() => {
    if (container.current) container.current.scrollTop = 0
    setViewport((v) => (v.scroll === 0 ? v : { ...v, scroll: 0 }))
  }, [events])

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
  const totalRows = Math.ceil(events.length / columns)

  // Strictly clamp first and last rows to avoid any index out-of-bounds or negative array lengths:
  const first = virtual
    ? Math.max(0, Math.min(totalRows, Math.floor(viewport.scroll / rowHeight) - 2))
    : 0
  const last = virtual
    ? Math.max(first, Math.min(totalRows, Math.ceil((viewport.scroll + viewport.height) / rowHeight) + 2))
    : totalRows

  const visibleRowCount = Math.max(0, last - first)
  const visibleRows = useMemo(
    () => Array.from({ length: visibleRowCount }, (_, i) => first + i),
    [visibleRowCount, first],
  )

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    if (!virtual) return
    const top = e.currentTarget.scrollTop
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
    }
    rafRef.current = requestAnimationFrame(() => {
      setViewport((v) => (Math.abs(v.scroll - top) < 25 ? v : { ...v, scroll: top }))
    })
  }

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
            onClick={() => {
              if (container.current) container.current.scrollTop = 0
              setViewport((v) => ({ ...v, scroll: 0 }))
            }}
          >
            Scroll to top
          </button>
        </div>
      }
    >
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
    </ErrorBoundary>
  )
}
