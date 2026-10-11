import { useEffect, useRef, useState } from 'react'
import type { PulseEvent } from '../domain'
import { EventCard } from './EventCard'

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
  const container = useRef<HTMLDivElement>(null),
    [viewport, setViewport] = useState({ height: 700, width: 500, scroll: 0 })
  useEffect(() => {
    const el = container.current
    if (!el) return
    const observer = new ResizeObserver(() =>
      setViewport((v) => ({ ...v, height: el.clientHeight, width: el.clientWidth })),
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (container.current) container.current.scrollTop = 0
    setViewport((v) => ({ ...v, scroll: 0 }))
  }, [events])
  const virtual = events.length > 50,
    columns = grid ? (viewport.width > 680 ? 3 : viewport.width > 440 ? 2 : 1) : 1,
    rowHeight = grid ? 408 : 190,
    totalRows = Math.ceil(events.length / columns)
  const first = virtual ? Math.max(0, Math.floor(viewport.scroll / rowHeight) - 2) : 0,
    last = virtual
      ? Math.min(totalRows, Math.ceil((viewport.scroll + viewport.height) / rowHeight) + 2)
      : totalRows
  return (
    <div
      className={`event-feed ${grid ? 'feed-grid' : ''} ${virtual ? 'feed-virtual' : ''}`}
      ref={container}
      onScroll={(e) => {
        if (virtual) setViewport((v) => ({ ...v, scroll: e.currentTarget.scrollTop }))
      }}
    >
      {virtual ? (
        <div className="virtual-space" style={{ height: totalRows * rowHeight }}>
          {Array.from({ length: last - first }, (_, i) => first + i).map((row) => (
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
