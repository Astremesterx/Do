import { useState, useMemo } from 'react'
import {
  Bell,
  Check,
  ChevronRight,
  Compass,
  MapPin,
  MessageCircle,
  Pencil,
  ShieldCheck,
  Star,
  Trash2,
  UserPlus,
  Users,
  LogOut,
  Map,
  Route,
  Sparkles,
} from 'lucide-react'
import { format } from 'date-fns'
import type { EventGenre, PulseEvent } from '../domain'
import { GENRES, CITIES, getCity } from '../data/cities'
import { selectProfile, useCommunityStore } from '../communityStore'
import { useEventsStore, useSocialStore } from '../stores'
import { hostOf, trustTier } from '../services/community'
import { Avatar, EmptyState, GenreIcon, Modal } from './ui'
import { EventFeed } from './EventFeed'
import { cityTime, formatPrice, isLive } from '../services/time'
import { EventImage } from './EventImage'

export function GuestPreview({
  event,
  onClose,
  onUnlock,
}: {
  event: PulseEvent
  onClose: () => void
  onUnlock: () => void
}) {
  return (
    <Modal title={event.title} eyebrow="A LITTLE PREVIEW" onClose={onClose}>
      <div className="modal-content community-form">
        <EventImage
          genre={event.genre}
          className="guest-preview-cover"
          src={event.imageUrl}
          alt={event.title}
        />
        <div className="button-row">
          <span className="eyebrow">{GENRES.find((g) => g.id === event.genre)?.label}</span>
          <span>{formatPrice(event)}</span>
        </div>
        <p>
          {event.description.slice(0, 220)}
          {event.description.length > 220 ? '…' : ''}
        </p>
        <p className="fine-print">
          {event.isOnline ? 'Online' : getCity(event.city).name} ·{' '}
          {format(new Date(event.startTime), 'MMM d, yyyy')} ·{' '}
          {cityTime(event.startTime, event.city)} {getCity(event.city).timezone}
        </p>
        <div className="guest-lock">
          <ShieldCheck size={23} />
          <div>
            <strong>There’s more to the moment.</strong>
            <p>
              Choose a local profile to reveal venue details, RSVP, and join the event conversation.
            </p>
          </div>
        </div>
        <button className="primary-button" onClick={onUnlock}>
          Choose my profile
          <ChevronRight size={16} />
        </button>
      </div>
    </Modal>
  )
}

export function ProfileModal({
  onClose,
  notify,
  onOpenAuth,
}: {
  onClose: () => void
  notify: (message: string) => void
  onOpenAuth?: () => void
}) {
  const profile = useCommunityStore(selectProfile)
  const save = useCommunityStore((s) => s.saveProfile)
  const updateProfileDetails = useCommunityStore((s) => s.updateProfileDetails)
  const [name, setName] = useState(profile.name)
  let initialHandle = profile.handle || '@user'
  if (!initialHandle.startsWith('@')) initialHandle = `@${initialHandle}`
  const [handle, setHandle] = useState(initialHandle)
  const [bio, setBio] = useState(profile.bio || '')
  const [city, setCity] = useState(profile.city || 'bangalore')
  const [org, setOrg] = useState(Boolean(profile.isOrg))
  const [interests, setInterests] = useState<EventGenre[]>(profile.interests || [])
  const [error, setError] = useState('')

  if (profile.isGuest) {
    return (
      <Modal title="Join the DO Community" eyebrow="ACCOUNT ACCESS" onClose={onClose}>
        <div className="modal-content community-form">
          <p className="modal-intro">
            You are currently browsing as a guest. Log in to your account or create a new one to personalize your profile, RSVP to gatherings, and build your local reputation.
          </p>
          <div className="guest-modal-auth-actions">
            <button
              type="button"
              className="primary-button full-width"
              onClick={() => {
                onClose()
                onOpenAuth?.()
              }}
            >
              <UserPlus size={16} />
              <span>Log in or create account</span>
            </button>
            <button type="button" className="secondary-button full-width" onClick={onClose}>
              Continue browsing as guest
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Make yourself at home." eyebrow="YOUR DO PROFILE" onClose={onClose}>
      <form
        className="modal-content community-form"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) {
            setError('Please provide a display name.')
            return
          }
          try {
            const updates = {
              name: name.trim(),
              handle: handle.trim(),
              bio: bio.trim(),
              city,
              isOrg: org,
              interests,
            }
            if (updateProfileDetails) {
              await updateProfileDetails(updates)
            } else {
              save(updates)
            }
            notify('Profile saved.')
            onClose()
          } catch {
            setError('Failed to save profile.')
          }
        }}
      >
        <p className="modal-intro">
          Manage how you appear to other members on DO. Changes are saved securely to your account.
        </p>

        <div className="field-row">
          <label className="field-label">
            Display name
            <input value={name} maxLength={40} required onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field-label">
            Handle
            <input
              value={handle}
              maxLength={30}
              required
              placeholder="@yourname"
              onChange={(e) => setHandle(e.target.value)}
            />
          </label>
        </div>
        <label className="field-label">
          A little about you
          <textarea value={bio} maxLength={240} rows={3} onChange={(e) => setBio(e.target.value)} />
        </label>
        <label className="field-label">
          Home city
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            {CITIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}, {c.country}
              </option>
            ))}
          </select>
        </label>
        <div className="segmented">
          <button type="button" className={!org ? 'active' : ''} onClick={() => setOrg(false)}>
            Explorer
          </button>
          <button type="button" className={org ? 'active' : ''} onClick={() => setOrg(true)}>
            Host / organization
          </button>
        </div>
        <span className="field-label">Your interests</span>
        <div className="vibe-chips">
          {GENRES.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`vibe-chip ${interests.includes(g.id) ? 'active' : ''}`}
              aria-pressed={interests.includes(g.id)}
              onClick={() =>
                setInterests(
                  interests.includes(g.id)
                    ? interests.filter((i) => i !== g.id)
                    : [...interests, g.id],
                )
              }
            >
              <GenreIcon genre={g.id} />
              {g.label}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button">
            Save profile
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function ProfileWorkspace({
  onSelect,
  onEdit,
  onEditInterests,
  onLogin,
  onRegister,
  onLogout,
  onConsole,
  isAdmin = false,
  onEditHosted,
  onDeleteHosted,
  notify,
}: {
  onSelect: (event: PulseEvent) => void
  onEdit: () => void
  onEditInterests?: () => void
  onLogin?: () => void
  onRegister?: () => void
  onLogout?: () => void
  onConsole?: () => void
  isAdmin?: boolean
  onEditHosted?: (event: PulseEvent) => void
  onDeleteHosted?: (eventId: string) => void
  notify: (message: string) => void
}) {
  const profile = useCommunityStore(selectProfile),
    community = useCommunityStore(),
    events = useEventsStore((s) => s.events),
    legacyJoined = useSocialStore((s) => s.goingIds)
  const [tab, setTab] = useState<'joined' | 'hosted' | 'following'>('joined'),
    [reviewing, setReviewing] = useState<PulseEvent | null>(null)
  const joined = community.joined[profile.id] ?? legacyJoined,
    hosted = community.hosted[profile.id] ?? [],
    following = community.following[profile.id] ?? []
  const hostedEvents = useMemo(
    () => events.filter((e) => hosted.includes(e.id) || e.host?.id === profile.id),
    [events, hosted, profile.id],
  )
  const reviews = Object.entries(community.reviews)
      .filter(([key]) => key.startsWith(`${profile.id}:`))
      .map(([, value]) => value),
    attended = reviews.filter((r) => r.attended).length
  const list =
    tab === 'hosted'
      ? hostedEvents
      : events.filter((e) =>
          tab === 'joined' ? joined.includes(e.id) : following.includes(hostOf(e).id),
        )
  return (
    <div className="community-workspace">
      <div className="profile-hero">
        <Avatar name={profile.name} size="large" />
        <div>
          <span className="eyebrow">
            {profile.isGuest
              ? 'GUEST EXPLORER'
              : profile.isOrg
                ? 'ORGANIZER'
                : trustTier(profile.trustScore)}
          </span>
          <h2>
            {profile.name}
            <span>{profile.handle}</span>
          </h2>
          <p>{profile.bio}</p>
          <small>
            <MapPin size={13} />
            {getCity(profile.city).name}
          </small>
        </div>
        <div className="profile-hero-actions">
          {profile.isGuest ? (
            <div className="button-row">
              <button className="primary-button" onClick={onLogin ?? onEdit}>
                Log in
              </button>
              <button className="secondary-button" onClick={onRegister ?? onEdit}>
                Create account
              </button>
            </div>
          ) : (
            <div className="button-row">
              <button className="secondary-button" onClick={onEdit}>
                Edit profile
              </button>
              {onLogout && (
                <button className="secondary-button ghost" onClick={onLogout} title="Log out">
                  <LogOut size={16} />
                  <span>Log out</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="profile-stats">
        <article>
          <ShieldCheck size={21} />
          <strong>
            {profile.trustScore}
            <small>/ 1000</small>
          </strong>
          <span>Local trust index</span>
          <progress value={profile.trustScore} max={1000} />
        </article>
        <article>
          <Check size={21} />
          <strong>{attended}</strong>
          <span>
            Attended · {reviews.length ? Math.round((attended / reviews.length) * 100) : 100}%
            attendance
          </span>
        </article>
        <article>
          <Users size={21} />
          <strong>{hostedEvents.length}</strong>
          <span>Happenings hosted</span>
        </article>
        <article>
          <UserPlus size={21} />
          <strong>{following.length}</strong>
          <span>Hosts followed</span>
        </article>
      </div>
      <div className="profile-preferences">
        <div>
          <h3>Follow your curiosity.</h3>
          <p>Your interests help bring the right moments closer.</p>
        </div>
        <div className="vibe-chips">
          {profile.interests.map((g) => (
            <span className="vibe-chip active" key={g}>
              <GenreIcon genre={g} />
              {GENRES.find((i) => i.id === g)?.short}
            </span>
          ))}
          <button
            type="button"
            className="vibe-chip add-chip"
            onClick={onEditInterests ?? onEdit}
          >
            + Edit interests
          </button>
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={profile.highlightInterests}
            onChange={(e) => community.saveProfile({ highlightInterests: e.target.checked })}
          />
          Highlight matching moments on the map
        </label>
      </div>
      <div className="workspace-tabs">
        {(['joined', 'hosted', 'following'] as const).map((value) => (
          <button
            key={value}
            className={tab === value ? 'active' : ''}
            onClick={() => setTab(value)}
          >
            {value === 'joined' ? 'My RSVPs' : value === 'hosted' ? 'Hosting' : 'Following'}
          </button>
        ))}
      </div>
      {!list.length ? (
        <EmptyState
          title="Good company starts somewhere."
          description="RSVP to a gathering, host your own, or follow an organizer to see them here."
        />
      ) : (
        <div className="profile-event-list">
          {list.map((event) => {
            const review = community.reviews[`${profile.id}:${event.id}`],
              ended = event.concluded || +new Date(event.endTime) <= Date.now()
            return (
              <article key={event.id}>
                <button className="profile-event-main" onClick={() => onSelect(event)}>
                  <EventImage genre={event.genre} src={event.imageUrl} alt="" />
                  <span>
                    <strong>{event.title}</strong>
                    <small>
                      {getCity(event.city).name} · {format(new Date(event.startTime), 'MMM d')} ·{' '}
                      {ended ? 'Concluded' : isLive(event) ? 'Live now' : 'Upcoming'}
                    </small>
                  </span>
                </button>
                {tab === 'joined' && ended && (
                  <button
                    className="secondary-button"
                    disabled={!!review}
                    onClick={() => setReviewing(event)}
                  >
                    {review
                      ? review.attended
                        ? 'Attendance recorded ✓'
                        : 'No-show recorded'
                      : 'Rate & record attendance'}
                  </button>
                )}
                {tab === 'following' && (
                  <button
                    className="secondary-button"
                    onClick={() => community.toggleFollow(event)}
                  >
                    Unfollow host
                  </button>
                )}
                {tab === 'hosted' && (
                  <div
                    className="profile-hosted-actions"
                    style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
                  >
                    <button
                      type="button"
                      className="secondary-button"
                      style={{
                        padding: '0.4rem 0.75rem',
                        fontSize: '0.82rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                      onClick={() => onEditHosted?.(event)}
                      title="Edit this happening"
                    >
                      <Pencil size={13} />
                      <span>Edit happening</span>
                    </button>
                    <button
                      type="button"
                      className="secondary-button ghost"
                      style={{
                        padding: '0.4rem 0.75rem',
                        fontSize: '0.82rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        color: 'var(--coral, #f43f5e)',
                      }}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Are you sure you want to delete "${event.title}" from the map & database?`,
                          )
                        ) {
                          onDeleteHosted?.(event.id)
                        }
                      }}
                      title="Delete this happening"
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
      {isAdmin && onConsole && (
        <div className="local-console-link admin-console-link">
          <div>
            <span className="eyebrow" style={{ color: 'var(--mint, #10b981)' }}>
              ADMINISTRATOR ONLY
            </span>
            <h3>Site maintenance console</h3>
            <p>Manage events, collection sources, files, and snapshots.</p>
          </div>
          <button className="secondary-button" onClick={onConsole}>
            Open console
            <ChevronRight size={15} />
          </button>
        </div>
      )}
      {reviewing && (
        <RatingModal event={reviewing} onClose={() => setReviewing(null)} notify={notify} />
      )}
    </div>
  )
}

function RatingModal({
  event,
  onClose,
  notify,
}: {
  event: PulseEvent
  onClose: () => void
  notify: (message: string) => void
}) {
  const [attended, setAttended] = useState(true),
    [rating, setRating] = useState(5),
    [compliments, setCompliments] = useState<string[]>([]),
    [notes, setNotes] = useState(''),
    [error, setError] = useState('')
  const review = useCommunityStore((s) => s.reviewEvent)
  return (
    <Modal title="How was your moment?" eyebrow="ATTENDANCE & FEEDBACK" onClose={onClose}>
      <div className="modal-content community-form">
        <p className="modal-intro">{event.title}</p>
        <div className="segmented">
          <button className={attended ? 'active' : ''} onClick={() => setAttended(true)}>
            I attended · +20
          </button>
          <button className={!attended ? 'active' : ''} onClick={() => setAttended(false)}>
            I missed it · −35
          </button>
        </div>
        <span className="field-label">Rate your host</span>
        <div className="rating-stars">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              aria-label={`Rate ${value} stars`}
              aria-pressed={rating === value}
              onClick={() => setRating(value)}
            >
              <Star fill={value <= rating ? 'currentColor' : 'none'} />
            </button>
          ))}
        </div>
        <div className="vibe-chips">
          {['Great host', 'Punctual', 'Welcoming', 'Good company', 'Well organized'].map(
            (value) => (
              <button
                key={value}
                className={`vibe-chip ${compliments.includes(value) ? 'active' : ''}`}
                onClick={() =>
                  setCompliments(
                    compliments.includes(value)
                      ? compliments.filter((i) => i !== value)
                      : [...compliments, value],
                  )
                }
              >
                {value}
              </button>
            ),
          )}
        </div>
        <label className="field-label">
          Your notes
          <textarea value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <p className="fine-print">
          This prototype records your own attendance and local reputation. It is not independent
          verification.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="primary-button"
          onClick={() => {
            const result = review(
              {
                eventId: event.id,
                attended,
                rating,
                compliments,
                notes,
                createdAt: new Date().toISOString(),
              },
              event,
            )
            if (result.ok) {
              notify(result.message)
              onClose()
            } else setError(result.message)
          }}
        >
          Save feedback
        </button>
      </div>
    </Modal>
  )
}

export function ChatsWorkspace({
  onSelect,
}: {
  onSelect: (event: PulseEvent, discussion?: boolean) => void
}) {
  const events = useEventsStore((s) => s.events),
    joined = useSocialStore((s) => s.goingIds),
    messages = useSocialStore((s) => s.messages),
    [archived, setArchived] = useState(false)
  const list = events.filter(
    (e) =>
      joined.includes(e.id) &&
      Boolean(e.concluded || +new Date(e.endTime) <= Date.now()) === archived,
  )
  return (
    <div className="community-workspace">
      <div className="workspace-intro">
        <span className="eyebrow">MAKE A CONNECTION</span>
        <h2>
          Good conversations <em>start here.</em>
        </h2>
        <p>
          Your RSVP rooms, together in one place. Conversations become read-only when an event ends.
        </p>
      </div>
      <div className="workspace-tabs">
        <button className={!archived ? 'active' : ''} onClick={() => setArchived(false)}>
          Active rooms
        </button>
        <button className={archived ? 'active' : ''} onClick={() => setArchived(true)}>
          Archived rooms
        </button>
      </div>
      {!list.length ? (
        <EmptyState
          title={archived ? 'No archived conversations.' : 'Your next hello is waiting.'}
          description="RSVP to an event to unlock its community room."
        />
      ) : (
        <div className="chat-room-list">
          {list.map((event) => (
            <button className="chat-room" key={event.id} onClick={() => onSelect(event, true)}>
              <EventImage genre={event.genre} src={event.imageUrl} alt="" />
              <span>
                <strong>{event.title}</strong>
                <small>{messages[event.id]?.at(-1)?.body || 'Say hello to the group.'}</small>
              </span>
              <small>
                {archived
                  ? 'Archived'
                  : `${(messages[event.id]?.length ?? 0) + (!event.provenance || event.provenance === 'demo' ? 2 : 0)} messages`}
              </small>
              <MessageCircle size={18} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function NotificationsModal({
  onClose,
  onSelect,
}: {
  onClose: () => void
  onSelect: (event: PulseEvent) => void
}) {
  const all = useCommunityStore((s) => s.notifications),
    profile = useCommunityStore(selectProfile),
    markRead = useCommunityStore((s) => s.markRead),
    events = useEventsStore((s) => s.events)
  const notifications = all.filter((n) => !n.profileId || n.profileId === profile.id)
  return (
    <Modal title="A little heads-up." eyebrow="NOTIFICATIONS" drawer onClose={onClose}>
      <div className="modal-content">
        <div className="button-row">
          <span>{notifications.filter((n) => !n.read).length} unread</span>
          <button className="secondary-button" onClick={() => markRead()}>
            Mark all read
          </button>
        </div>
        {!notifications.length ? (
          <EmptyState
            title="All caught up."
            description="RSVPs, followed hosts, and upcoming reminders will appear here."
          />
        ) : (
          <div className="notification-list">
            {notifications.map((n) => (
              <button
                className={`notification-item ${n.read ? 'is-read' : ''}`}
                key={n.id}
                onClick={() => {
                  markRead(n.id)
                  const event = events.find((e) => e.id === n.eventId)
                  if (event) {
                    onClose()
                    onSelect(event)
                  }
                }}
              >
                <Bell size={18} />
                <span>
                  <strong>{n.title}</strong>
                  <p>{n.body}</p>
                  <small>{format(new Date(n.createdAt), 'MMM d · h:mm a')}</small>
                </span>
                {!n.read && <i />}
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

export function TourModal({
  onClose,
  onAdminAccess,
}: {
  onClose: () => void
  onAdminAccess?: () => void
}) {
  const [step, setStep] = useState(0),
    seen = useCommunityStore((s) => s.setTourSeen)

  const tutorialSteps = [
    {
      step: 1,
      tag: 'DISCOVER & EXPLORE',
      title: 'Find Live Happenings Anywhere',
      Icon: Compass,
      highlights: [
        'Explore verified happenings all over the world and nearby surroundings.',
        'Filter quickly by vibe (Music, Tech, Art, Food), time, free events, and radius.',
        'Switch to Online Events to tune into virtual gatherings across the globe.',
      ],
    },
    {
      step: 2,
      tag: 'INTERACTIVE MAP',
      title: 'Navigate Venues & Explore the Map',
      Icon: Map,
      highlights: [
        'Click venue pins to check exact timings, entry details, and directions.',
        'Toggle map layers anytime: Streets, Mono, and Satellite views.',
        'Use "Locate me" to find nearby events or maximize the map for full-screen exploration.',
      ],
    },
    {
      step: 3,
      tag: 'TRIP PLANNER',
      title: 'Plan Seamless Days & Weekends',
      Icon: Route,
      highlights: [
        'Auto-generate smart itineraries tailored to your pace and interests.',
        'Add personal detours or swap stops with nearby alternatives anytime.',
        'Export your schedule directly to Google Calendar, Apple iCal, or share a link.',
      ],
    },
    {
      step: 4,
      tag: 'COMMUNITY & NAVIGATION',
      title: 'Live Chats & Fast Navigation',
      Icon: MessageCircle,
      highlights: [
        'Join event conversation rooms to chat with hosts and fellow attendees.',
        'Use the left sidebar navigation to switch seamlessly between Explore, Trips, Chats, and Saved.',
        'Browse freely as a guest, or create a profile to host and save moments.',
      ],
    },
  ]

  const current = tutorialSteps[step]
  const close = () => {
    seen()
    onClose()
  }

  return (
    <Modal
      className="tour-modal"
      title={current.title}
      eyebrow={`QUICK TUTORIAL · STEP ${step + 1} OF ${tutorialSteps.length}`}
      onClose={close}
    >
      <div className="modal-content tour-content">
        <div className="tour-header-visual">
          <div className="tour-icon-wrap">
            <current.Icon size={22} />
          </div>
          <span className="tour-tag-pill">{current.tag}</span>
        </div>

        <ul className="tour-highlights">
          {current.highlights.map((text, idx) => (
            <li key={idx}>
              <span className="tour-check">
                <Check size={11} strokeWidth={2.5} />
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ul>

        <div className="tour-dots">
          {tutorialSteps.map((_, index) => (
            <button
              key={index}
              aria-label={`Step ${index + 1}`}
              className={index === step ? 'active' : ''}
              onClick={() => setStep(index)}
            />
          ))}
        </div>

        <div className="tour-actions">
          <button className="tour-skip-button" onClick={close}>
            Skip tutorial
          </button>
          <div className="tour-nav-buttons">
            {step > 0 && (
              <button
                className="secondary-button tour-back-btn"
                onClick={() => setStep(step - 1)}
              >
                Back
              </button>
            )}
            <button
              className="primary-button tour-next-btn"
              onClick={step === tutorialSteps.length - 1 ? close : () => setStep(step + 1)}
            >
              {step === tutorialSteps.length - 1 ? (
                <>
                  Get started <Sparkles size={14} />
                </>
              ) : (
                <>
                  Next <ChevronRight size={15} />
                </>
              )}
            </button>
          </div>
        </div>

        {onAdminAccess && (
          <div style={{ textAlign: 'center', marginTop: '4px' }}>
            <button
              type="button"
              className="tour-admin-link"
              onClick={() => {
                close()
                onAdminAccess()
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--ink-muted)',
                fontSize: '11px',
                cursor: 'pointer',
                opacity: 0.45,
              }}
            >
              Site maintenance
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

export function ExploreWorkspace({
  events,
  onSelect,
  now,
}: {
  events: PulseEvent[]
  onSelect: (event: PulseEvent) => void
  now: number
}) {
  return (
    <div className="explore-workspace">
      <div className="workspace-intro">
        <span className="eyebrow">GO WHERE YOUR INTERESTS TAKE YOU</span>
        <h2>
          A little more <em>possibility.</em>
        </h2>
        <p>{events.length} moments matching your discovery filters.</p>
      </div>
      {events.length ? (
        <EventFeed events={events} onSelect={onSelect} now={now} />
      ) : (
        <EmptyState
          title="Nothing here just yet."
          description="Try a wider location scope or clear a few filters."
        />
      )}
    </div>
  )
}
