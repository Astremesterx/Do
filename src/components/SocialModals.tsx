import { useState } from 'react'
import { ArrowRight, Check, Coffee, MapPin, Radio, Sparkles } from 'lucide-react'
import { getCity } from '../data/cities'
import { useEventsStore, useSocialStore } from '../stores'
import { Modal } from './ui'
import { GENRES } from '../data/cities'
import type { EventGenre } from '../domain'
import { selectProfile, useCommunityStore } from '../communityStore'
import { generateUUID } from '../services/uuid'

export function FreeModal({
  onClose,
  notify,
}: {
  onClose: () => void
  notify: (message: string) => void
}) {
  const city = useEventsStore((s) => s.city),
    name = useSocialStore((s) => s.userName),
    setName = useSocialStore((s) => s.setUserName),
    publish = useSocialStore((s) => s.publishBeacon),
    remove = useSocialStore((s) => s.removeBeacon)
  const existing = useSocialStore((s) =>
    s.beacons.find((b) => b.userId === 'you' && +new Date(b.expiresAt) > Date.now()),
  )
  const [hours, setHours] = useState(2),
    [vibe, setVibe] = useState('Coffee & a good conversation'),
    [displayName, setDisplayName] = useState(name)
  const [radius, setRadius] = useState(10),
    [interests, setInterests] = useState<EventGenre[]>([])
  const submit = () => {
    if (!displayName.trim() || !vibe.trim()) return
    const community = useCommunityStore.getState()
    if (selectProfile(community).isGuest) {
      notify('Choose a local profile before publishing a beacon.')
      return
    }
    setName(displayName.trim())
    useCommunityStore.getState().saveProfile({ name: displayName.trim() })
    const point = getCity(city).districts[2].point
    const id = existing?.id ?? generateUUID()
    publish({
      id,
      userId: 'you',
      userName: displayName.trim(),
      userAvatar: displayName.trim()[0],
      city,
      latitude: point[0],
      longitude: point[1],
      vibeMessage: vibe.trim(),
      expiresAt: new Date(Date.now() + hours * 3600000).toISOString(),
      radiusKm: radius,
      interests,
    })
    community.recordBeacon(id)
    notify(`Your beacon is on for ${hours} hours. Good company awaits.`)
    onClose()
  }
  return (
    <Modal title="Good company, no big plan." eyebrow="PUT YOURSELF ON THE MAP" onClose={onClose}>
      <div className="modal-content">
        <div className="beacon-illustration">
          <span />
          <span />
          <span />
          <div>
            <Radio size={33} />
          </div>
        </div>
        <p className="modal-intro centered">
          Let nearby people know you’re open to a little spontaneity.
        </p>
        <label className="field-label">
          What should we call you?
          <input
            value={displayName}
            aria-label="Your display name"
            maxLength={30}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label className="field-label">Free for the next…</label>
        <div className="segmented">
          {[2, 4, 6].map((h) => (
            <button key={h} className={hours === h ? 'active' : ''} onClick={() => setHours(h)}>
              {h} hours
            </button>
          ))}
        </div>
        <label className="field-label">What are you in the mood for?</label>
        <div className="vibe-chips">
          {[
            'Coffee & a good conversation',
            'Exploring local galleries',
            'Finding the next great gig',
            'A walk with no destination',
          ].map((v, i) => (
            <button
              key={v}
              className={`vibe-chip ${vibe === v ? 'active' : ''}`}
              onClick={() => setVibe(v)}
            >
              {i === 0 ? <Coffee size={14} /> : <Sparkles size={14} />} {v}
              {vibe === v && <Check size={12} />}
            </button>
          ))}
        </div>
        <input
          className="full-width"
          aria-label="Custom meetup vibe"
          value={vibe}
          onChange={(e) => setVibe(e.target.value)}
          maxLength={100}
          placeholder="Or write your own vibe…"
        />
        <p className="beacon-location">
          <MapPin size={15} />
          Your beacon appears near {getCity(city).districts[2].name}.<br />
          It automatically disappears when your time is up.
        </p>
        <label className="field-label">
          Discovery radius · {radius} km
          <input
            type="range"
            min="1"
            max="100"
            value={radius}
            onChange={(e) => setRadius(+e.target.value)}
          />
        </label>
        <span className="field-label">Open to these interests</span>
        <div className="vibe-chips">
          {GENRES.map((g) => (
            <button
              key={g.id}
              className={`vibe-chip ${interests.includes(g.id) ? 'active' : ''}`}
              onClick={() =>
                setInterests(
                  interests.includes(g.id)
                    ? interests.filter((id) => id !== g.id)
                    : [...interests, g.id],
                )
              }
            >
              {g.short}
            </button>
          ))}
        </div>
        <p className="fine-print">
          Your beacon uses an approximate district anchor, rather than your device’s exact
          coordinates.
        </p>
        {existing && (
          <button
            className="text-button danger"
            onClick={() => {
              remove()
              notify('Your beacon is off.')
              onClose()
            }}
          >
            Turn off my current beacon
          </button>
        )}
      </div>
      <footer className="modal-footer">
        <button className="text-button" onClick={onClose}>
          Maybe later
        </button>
        <button
          className="primary-button"
          disabled={!displayName.trim() || !vibe.trim()}
          onClick={submit}
        >
          I’m free. Let’s go. <ArrowRight size={17} />
        </button>
      </footer>
    </Modal>
  )
}
