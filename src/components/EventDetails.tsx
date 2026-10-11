import { useEffect, useRef, useState } from 'react'
import {
  ArrowUpRight,
  Bookmark,
  CalendarPlus,
  Check,
  Clock3,
  MapPin,
  MessageCircle,
  Pencil,
  Send,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { format } from 'date-fns'
import type { PulseEvent } from '../domain'
import { useEventsStore, useSocialStore } from '../stores'
import { browserTime, cityTime, countdown, formatPrice, isLive } from '../services/time'
import { exportCalendar } from '../services/calendar'
import { getCity } from '../data/cities'
import { Avatar, GenreTag, Modal } from './ui'
import { selectProfile, useCommunityStore } from '../communityStore'
import { attendeeCount, hostOf, joinEligibility } from '../services/community'
import { generateUUID } from '../services/uuid'
import { EventImage } from './EventImage'
import { getPlatformDisplayInfo } from '../services/eventUrls'
import { messagesService } from '../services/supabase/messagesService'

export function EventDetails({
  event: originalEvent,
  onClose,
  onEdit,
  notify,
  now,
  initialDiscussion = false,
}: {
  event: PulseEvent
  onClose: () => void
  onEdit?: (event: PulseEvent) => void
  notify: (message: string) => void
  now: number
  initialDiscussion?: boolean
}) {
  const event =
    useEventsStore((s) => s.events.find((e) => e.id === originalEvent.id)) ?? originalEvent
  const profile = useCommunityStore(selectProfile),
    following = useCommunityStore((s) => s.following[s.activeId]),
    toggleFollow = useCommunityStore((s) => s.toggleFollow),
    toggleJoin = useCommunityStore((s) => s.toggleJoin)
  const host = hostOf(event),
    ended = !!event.concluded || +new Date(event.endTime) <= now
  const live = isLive(event, now)
  const platformInfo = getPlatformDisplayInfo(
    event.sourcePlatform,
    event.registrationUrl,
    event.isOnline,
    live,
  )
  const isHost =
    !profile.isGuest &&
    Boolean((event.host?.id && event.host.id === profile.id) || host.id === profile.id)
  const [tab, setTab] = useState<'about' | 'discussion'>(
      initialDiscussion ? 'discussion' : 'about',
    ),
    [comment, setComment] = useState('')
  const saved = useEventsStore((s) => s.savedIds.includes(event.id)),
    toggleSaved = useEventsStore((s) => s.toggleSaved)
  const name = useSocialStore((s) => s.userName),
    localMessages = useSocialStore((s) => s.messages[event.id]),
    addMessage = useSocialStore((s) => s.addMessage),
    going = useSocialStore((s) => s.goingIds.includes(event.id))
  const canReveal = !event.privateVenue || going
  const joinedProfiles = useCommunityStore((s) => s.joined),
    joinedIds = useSocialStore((s) => s.goingIds)
  const attendees = attendeeCount(event, joinedProfiles, profile.id, joinedIds)
  const simulated = !event.provenance || event.provenance === 'demo'
  const messages = [
    ...(simulated
      ? [
          {
            id: 'seed-1',
            userName: 'Maya',
            avatar: 'M',
            body: 'Love this space! I’m heading over with a friend. Anyone else coming solo?',
            createdAt: new Date(now - 45 * 60000).toISOString(),
          },
          {
            id: 'seed-2',
            userName: 'Riya',
            avatar: 'R',
            body: 'I am! Looking forward to meeting everyone. Let’s say hi when we get there ✨',
            createdAt: new Date(now - 30 * 60000).toISOString(),
          },
        ]
      : []),
    ...(localMessages ?? []),
  ]

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const chatThreadRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (tab !== 'discussion' || !event.id) return
    void useSocialStore.getState().loadEventMessages(event.id)
    const unsub = messagesService.subscribeToMessages(event.id, (msg) => {
      useSocialStore.getState().receiveMessage(event.id, msg)
    })
    return () => {
      unsub()
    }
  }, [event.id, tab])

  useEffect(() => {
    if (tab === 'discussion') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length, tab])

  const send = () => {
    if (!comment.trim() || !going || ended) return
    const text = comment.trim()
    setComment('')
    addMessage(event.id, {
      id: generateUUID(),
      userName: name,
      avatar: name.slice(0, 1),
      body: text,
      createdAt: new Date().toISOString(),
    })
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 50)
  }
  const time = (date: string) => (event.isOnline ? browserTime(date) : cityTime(date, event.city))
  return (
    <Modal
      title="A moment worth showing up for."
      eyebrow={event.isOnline ? 'GOOD COMPANY, ANYWHERE' : 'IN YOUR CITY'}
      onClose={onClose}
      drawer
    >
      <div className="detail-scroll">
        <div className="detail-cover">
          <EventImage genre={event.genre} src={event.imageUrl} alt={`${event.genre} experience`} />
          {isLive(event, now) && (
            <span className="live-label">
              <span className="status-dot" />
              LIVE NOW
            </span>
          )}
          <button
            className={`detail-save ${saved ? 'is-saved' : ''}`}
            onClick={() => toggleSaved(event.id)}
            aria-label={saved ? 'Unsave event' : 'Save event'}
          >
            <Bookmark size={19} fill={saved ? 'currentColor' : 'none'} />
          </button>
        </div>
        <div className="detail-content">
          <div className="detail-tag-row">
            <GenreTag genre={event.genre} />
            <span className="verified">
              <ShieldCheck size={13} />
              Location checked
            </span>
            <span className="verified" title="Direct deep link verified to official event page">
              <ShieldCheck size={13} />
              {platformInfo.badgeText}
            </span>
          </div>
          <h2 className="detail-title">{event.title}</h2>
          <p className="detail-city">
            {event.isOnline
              ? 'A global conversation'
              : `${getCity(event.city).name}, ${event.country}`}
          </p>
          <div className="detail-facts">
            <div>
              <CalendarPlus size={18} />
              <p>
                <strong>{format(new Date(event.startTime), 'EEEE, MMMM d')}</strong>
                <span>
                  {time(event.startTime)} – {time(event.endTime)} ·{' '}
                  {event.isOnline
                    ? Intl.DateTimeFormat().resolvedOptions().timeZone
                    : getCity(event.city).timezone}
                </span>
              </p>
            </div>
            <div>
              <MapPin size={18} />
              <p>
                <strong>{event.venueName}</strong>
                <span>
                  {event.isOnline
                    ? countdown(event.startTime, now)
                    : canReveal
                      ? event.address
                      : `${getCity(event.city).name} · RSVP for exact instructions`}
                </span>
                {event.exactVenue && canReveal && <span>{event.exactVenue}</span>}
                {event.locationPrecision === 'city' && (
                  <small>Approximate city anchor · confirm venue on the source</small>
                )}
              </p>
              {!event.isOnline && canReveal && (
                <a
                  aria-label="Get directions in Google Maps"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ArrowUpRight size={17} />
                </a>
              )}
            </div>
            <div>
              <Users size={18} />
              <p>
                <strong>
                  {attendees}
                  {event.unlimited ? '' : event.maxGuests ? ` / ${event.maxGuests}` : ''} people
                  going
                </strong>
                <span>
                  {event.minTrustScore
                    ? `Requires ${event.minTrustScore} local trust points · your score ${profile.trustScore}`
                    : event.registrationStatus === 'closed'
                      ? 'Registration closed'
                      : event.registrationStatus === 'waitlist'
                        ? 'Waitlist · check the source'
                        : 'Good company is part of the plan.'}
                </span>
              </p>
              {simulated && (
                <span className="stack-avatars">
                  <Avatar name="Maya" color={1} />
                  <Avatar name="Riya" color={2} />
                  <Avatar name="Sam" color={3} />
                </span>
              )}
            </div>
          </div>
          <div className="detail-tabs">
            <button className={tab === 'about' ? 'active' : ''} onClick={() => setTab('about')}>
              The experience
            </button>
            <button
              className={tab === 'discussion' ? 'active' : ''}
              onClick={() => setTab('discussion')}
            >
              <MessageCircle size={14} />
              The conversation <span>{messages.length}</span>
            </button>
          </div>
          {tab === 'about' ? (
            <div className="about-content">
              <h3>A little about this moment</h3>
              <p>{event.description}</p>
              <div className="host-summary">
                <Avatar name={host.name} color={1} />
                <div>
                  <strong>
                    {host.name}
                    {host.isOrg ? ' · Organization' : ''}
                  </strong>
                  <span>
                    {host.handle} ·{' '}
                    {host.trustScore
                      ? `${host.trustScore} local trust`
                      : 'Trust not independently scored'}
                  </span>
                </div>
                {host.id !== profile.id && (
                  <button className="secondary-button" onClick={() => toggleFollow(event)}>
                    {following?.includes(host.id) ? 'Following ✓' : 'Follow host'}
                  </button>
                )}
              </div>
              {event.tags?.length ? (
                <div className="vibe-chips">
                  {event.tags.map((tag) => (
                    <span className="vibe-chip" key={tag}>
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}
              {event.officialLinks?.length ? (
                <div className="official-links">
                  <h3>Official pages & passes</h3>
                  {event.officialLinks.map((link, index) => (
                    <a
                      key={`${link.url}-${index}`}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {link.label}
                      <ArrowUpRight size={15} />
                    </a>
                  ))}
                </div>
              ) : null}
              {event.officialMentions?.length ? (
                <div className="official-links">
                  <h3>Source mentions</h3>
                  {event.officialMentions.map((link, index) => (
                    <a key={index} href={link.url} target="_blank" rel="noreferrer">
                      {link.title}
                      <ArrowUpRight size={15} />
                    </a>
                  ))}
                </div>
              ) : null}
              {event.meetingUrl && canReveal && (
                <a
                  className="secondary-button full-width"
                  href={event.meetingUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open meeting / stream
                  <ArrowUpRight size={15} />
                </a>
              )}
              {event.meetingUrl && !canReveal && (
                <p className="fine-print">The meeting link unlocks after local RSVP.</p>
              )}
              {event.verification && (
                <div className="verification-report">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                    <ShieldCheck size={15} />
                    <strong>Verified Direct Event Link · {event.verification.score}%</strong>
                  </div>
                  <p>
                    {event.registrationUrl
                      ? `Direct official link verified: opens the exact event registration page on ${platformInfo.name}.`
                      : 'Schedule and location structure checked. Join at the venue with the local community.'}
                  </p>
                  {event.verification.flags.map((flag) => (
                    <small key={flag}>{flag}</small>
                  ))}
                </div>
              )}
              {host.id === profile.id && !ended && (
                <button
                  className="secondary-button full-width"
                  onClick={() => {
                    useEventsStore.getState().updateEvent({ ...event, concluded: true })
                    notify(
                      'Event concluded. Its conversation is now archived and attendance feedback is open.',
                    )
                  }}
                >
                  Conclude event & open feedback
                </button>
              )}
              <button
                className="secondary-button full-width"
                onClick={() => {
                  exportCalendar([event], event.id)
                  notify('Calendar event downloaded.')
                }}
              >
                <CalendarPlus size={16} />
                Add to my calendar
              </button>
              <p className="fine-print">
                <Clock3 size={13} />
                Event times may change. Check the source before heading out.
              </p>
            </div>
          ) : (
            <div className="discussion chat-view">
              <div className="chat-room-header">
                <div className="chat-room-meta">
                  <h3>Attendee Conversation</h3>
                  <div className="chat-live-badge">
                    <span className="status-dot" />
                    <span>Live room · Synced with Supabase</span>
                  </div>
                </div>
                <div className="chat-attendee-badge">
                  <Users size={13} />
                  <span>{attendees} joined</span>
                </div>
              </div>

              {!going && (
                <div className="local-rsvp-gate">
                  <p>RSVP to join this live conversation and coordinate with other attendees.</p>
                  <button
                    className="primary-button"
                    onClick={() => notify(toggleJoin(event).message)}
                  >
                    <Users size={15} />
                    <span>Join room & RSVP</span>
                  </button>
                </div>
              )}

              {ended && (
                <p className="fine-print chat-ended-notice">
                  Archived room · this event has ended. Existing messages are preserved.
                </p>
              )}

              {going && (
                <>
                  <div className="chat-thread" ref={chatThreadRef}>
                    {!messages.length ? (
                      <div className="chat-empty-state">
                        <MessageCircle size={28} />
                        <p>No messages yet.</p>
                        <span>Be the first to say hello to everyone attending!</span>
                      </div>
                    ) : (
                      messages.map((m, i) => {
                        const isMine = m.userName === name
                        return (
                          <div
                            className={`chat-bubble-row ${isMine ? 'is-mine' : 'is-theirs'}`}
                            key={m.id}
                          >
                            {!isMine && <Avatar name={m.userName} color={i + 1} />}
                            <div className="chat-bubble-content">
                              <header className="chat-bubble-header">
                                <strong>{isMine ? 'You' : m.userName}</strong>
                                <span>{format(new Date(m.createdAt), 'h:mm a')}</span>
                              </header>
                              <div className="chat-bubble-body">
                                <p>{m.body}</p>
                              </div>
                            </div>
                            {isMine && <Avatar name={name} color={0} />}
                          </div>
                        )
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <form
                    className="chat-composer"
                    onSubmit={(e) => {
                      e.preventDefault()
                      send()
                    }}
                  >
                    <input
                      aria-label="Add a community comment"
                      placeholder="Say hello to everyone attending…"
                      value={comment}
                      maxLength={1000}
                      disabled={ended}
                      onChange={(e) => setComment(e.target.value)}
                    />
                    <button
                      className="chat-send-btn"
                      aria-label="Post comment"
                      type="submit"
                      disabled={!comment.trim() || ended}
                    >
                      <Send size={16} />
                    </button>
                  </form>
                  <div className="chat-footer-sync">
                    <span className="sync-indicator">
                      <span className="status-dot" />
                      Live community chat · Messages sync across all joined devices
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <footer className="detail-footer">
        <div>
          <span className="detail-price">{formatPrice(event)}</span>
          <small>
            {event.provenance === 'collected'
              ? 'Collected from public source'
              : event.provenance === 'pulse-import'
                ? 'Pulse reference archive'
                : event.sourcePlatform === 'Community'
                  ? 'Community hosted'
                  : 'Demo event · source listings'}
          </small>
        </div>
        {isHost && onEdit && (
          <button
            type="button"
            className="secondary-button"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={() => onEdit(event)}
            title="Edit your event details"
          >
            <Pencil size={15} />
            <span>Edit event</span>
          </button>
        )}
        <button
          className={`going-button ${going ? 'active' : ''}`}
          aria-label={going ? 'Remove from going list' : 'Add to going list'}
          onClick={() => {
            notify(toggleJoin(event).message)
          }}
        >
          {going ? <Check size={18} /> : <Users size={18} />}
          <span>{going ? 'Going' : joinEligibility(event, profile) ? 'RSVP' : 'Join'}</span>
        </button>
        <a
          className="primary-button"
          href={event.registrationUrl || undefined}
          target="_blank"
          rel="noreferrer"
          title={`Official direct link: opens event registration on ${platformInfo.name}`}
          onClick={
            event.registrationUrl
              ? undefined
              : (e) => {
                  e.preventDefault()
                  notify('This is a free meetup. You’re welcome to join at the venue.')
                }
          }
        >
          {platformInfo.actionText}
          <ArrowUpRight size={16} />
        </a>
      </footer>
    </Modal>
  )
}
