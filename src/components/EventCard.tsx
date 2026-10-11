import { memo } from 'react'
import { ArrowUpRight, Bookmark, CalendarPlus, Globe2, MapPin, Users } from 'lucide-react'
import type { PulseEvent } from '../domain'
import { browserTime, cityTime, countdown, formatPrice, isLive } from '../services/time'
import { exportCalendar } from '../services/calendar'
import { Avatar, GenreTag } from './ui'
import { useEventsStore } from '../stores'
import { format } from 'date-fns'
import { EventImage } from './EventImage'
import { getPlatformDisplayInfo } from '../services/eventUrls'

export const EventCard = memo(function EventCard({
  event,
  onSelect,
  selected = false,
  compact = false,
  now = Date.now(),
}: {
  event: PulseEvent
  onSelect: (event: PulseEvent) => void
  selected?: boolean
  compact?: boolean
  now?: number
}) {
  if (!event || !event.id) return null

  const saved = useEventsStore((s) => s.savedIds.includes(event.id)),
    toggleSaved = useEventsStore((s) => s.toggleSaved)
  const live = isLive(event, now)

  const timeStr = (() => {
    try {
      const res = event.isOnline ? browserTime(event.startTime) : cityTime(event.startTime, event.city)
      return res || 'Time TBA'
    } catch {
      return 'Time TBA'
    }
  })()

  return (
    <article
      className={`event-card ${selected ? 'event-selected' : ''} ${compact ? 'event-compact' : ''}`}
    >
      <button
        className="event-image-button"
        onClick={() => onSelect(event)}
        aria-label={`View ${event.title || 'event'}`}
      >
        <EventImage
          genre={event.genre || 'social'}
          src={event.imageUrl}
          alt={`${event.genre || 'social'} gathering`}
          loading="lazy"
          width="320"
          height="200"
        />
        {live ? (
          <span className="live-label">
            <span className="status-dot" />
            LIVE NOW
          </span>
        ) : (
          <span className="image-date">
            {(() => {
              try {
                const d = new Date(event.startTime)
                return isNaN(d.getTime()) ? 'UPCOMING' : format(d, 'MMM d').toUpperCase()
              } catch {
                return 'UPCOMING'
              }
            })()}
          </span>
        )}
        <span className="image-shade" />
      </button>
      <button
        className={`save-button ${saved ? 'is-saved' : ''}`}
        aria-label={saved ? `Unsave ${event.title}` : `Save ${event.title}`}
        onClick={() => toggleSaved(event.id)}
      >
        <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />
      </button>
      <div className="event-card-body">
        <div className="event-meta-row">
          <GenreTag genre={event.genre || 'social'} />
          <span className="event-time">{timeStr}</span>
        </div>
        <button className="event-title-button" onClick={() => onSelect(event)}>
          <h3>{event.title || 'Community Event'}</h3>
          <ArrowUpRight size={17} />
        </button>
        <p className="event-venue">
          {event.isOnline ? <Globe2 size={13} /> : <MapPin size={13} />}{' '}
          {event.isOnline ? 'Online · join from anywhere' : (event.venueName || 'Local Venue')}
        </p>
        {event.isOnline && (
          <p className="online-countdown">
            <span className="status-dot" />
            {countdown(event.startTime, now)}
          </p>
        )}
        <div className="event-card-bottom">
          <div className="attendee-stack">
            {(!event.provenance || event.provenance === 'demo') && (
              <span className="stack-avatars">
                <Avatar name="Maya" color={1} />
                <Avatar name="Riya" color={2} />
                <Avatar name="Alex" color={3} />
              </span>
            )}
            <span>
              <Users size={12} />
              {event.attendeesCount} going
            </span>
          </div>
          <span className={`price ${event.priceTier === 'free' ? 'price-free' : ''}`}>
            {formatPrice(event)}
          </span>
        </div>
        {event.isOnline && (
          <div className="online-card-actions">
            {event.registrationUrl ? (
              <a
                href={event.registrationUrl}
                target="_blank"
                rel="noreferrer"
                title={`Open official direct event page on ${getPlatformDisplayInfo(event, live).name}`}
              >
                {getPlatformDisplayInfo(event, live).actionText}
                <ArrowUpRight size={13} />
              </a>
            ) : (
              <button className="text-button" onClick={() => onSelect(event)}>
                View session
                <ArrowUpRight size={13} />
              </button>
            )}
            <button
              className="icon-button"
              aria-label={`Add ${event.title} to calendar`}
              onClick={() => exportCalendar([event], event.id)}
            >
              <CalendarPlus size={15} />
            </button>
          </div>
        )}
      </div>
    </article>
  )
})
