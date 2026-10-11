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
  const saved = useEventsStore((s) => s.savedIds.includes(event.id)),
    toggleSaved = useEventsStore((s) => s.toggleSaved)
  const live = isLive(event, now)
  return (
    <article
      className={`event-card ${selected ? 'event-selected' : ''} ${compact ? 'event-compact' : ''}`}
    >
      <button
        className="event-image-button"
        onClick={() => onSelect(event)}
        aria-label={`View ${event.title}`}
      >
        <EventImage
          genre={event.genre}
          src={event.imageUrl}
          alt={`${event.genre} gathering`}
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
            {format(new Date(event.startTime), 'MMM d').toUpperCase()}
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
          <GenreTag genre={event.genre} />
          <span className="event-time">
            {event.isOnline ? browserTime(event.startTime) : cityTime(event.startTime, event.city)}
          </span>
        </div>
        <button className="event-title-button" onClick={() => onSelect(event)}>
          <h3>{event.title}</h3>
          <ArrowUpRight size={17} />
        </button>
        <p className="event-venue">
          {event.isOnline ? <Globe2 size={13} /> : <MapPin size={13} />}{' '}
          {event.isOnline ? 'Online · join from anywhere' : event.venueName}
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
                title={`Open official direct event page on ${getPlatformDisplayInfo(event.sourcePlatform, event.registrationUrl, true, live).name}`}
              >
                {getPlatformDisplayInfo(event.sourcePlatform, event.registrationUrl, true, live).actionText}
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
