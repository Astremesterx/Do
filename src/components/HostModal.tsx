import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ImagePlus, MapPin } from 'lucide-react'
import type { EventGenre, PulseEvent } from '../domain'
import { CITIES, GENRES, getCity } from '../data/cities'
import { PHOTOS } from '../data/mockEvents'
import { useEventsStore } from '../stores'
import { addDate, cityDate, cityTime, zonedISO } from '../services/time'
import { selectProfile, useCommunityStore } from '../communityStore'
import { safeHTTPS } from '../services/collection'
import { verifyEvent } from '../services/eventTruthVerifier'
import { generateUUID } from '../services/uuid'
import { getUserLocation } from '../services/geolocation'
import { Dropdown, GenreIcon, Modal } from './ui'
import { MapView } from './MapView'

export function HostModal({
  onClose,
  notify,
  onPublished,
  initialEvent,
  initialPoint,
}: {
  onClose: () => void
  notify: (message: string) => void
  onPublished: (event: PulseEvent) => void
  initialEvent?: PulseEvent
  initialPoint?: [number, number]
}) {
  const profile = useCommunityStore(selectProfile),
    recordHost = useCommunityStore((s) => s.recordHost)
  const currentCity = useEventsStore((s) => s.city),
    addEvents = useEventsStore((s) => s.addEvents)
  const [step, setStep] = useState(0),
    [title, setTitle] = useState(initialEvent?.title ?? ''),
    [description, setDescription] = useState(initialEvent?.description ?? ''),
    [genre, setGenre] = useState<EventGenre>(initialEvent?.genre ?? 'food'),
    [city, setCity] = useState(initialEvent?.city ?? currentCity)
  const [image, setImage] = useState(initialEvent?.imageUrl ?? ''),
    [start, setStart] = useState(
      initialEvent
        ? `${cityDate(initialEvent.startTime, city)}T${cityTime(initialEvent.startTime, city)}`
        : `${addDate(cityDate(new Date(), city), 1)}T18:00`,
    ),
    [end, setEnd] = useState(
      initialEvent
        ? `${cityDate(initialEvent.endTime, city)}T${cityTime(initialEvent.endTime, city)}`
        : `${addDate(cityDate(new Date(), city), 1)}T20:00`,
    ),
    [guests, setGuests] = useState(initialEvent?.maxGuests ?? 20),
    [url, setUrl] = useState(initialEvent?.registrationUrl ?? ''),
    [amount, setAmount] = useState(initialEvent?.priceAmount ?? 0)
  const [online, setOnline] = useState(initialEvent?.isOnline ?? false),
    [unlimited, setUnlimited] = useState(initialEvent?.unlimited ?? false),
    [minimumTrust, setMinimumTrust] = useState(initialEvent?.minTrustScore ?? 0),
    [privateVenue, setPrivateVenue] = useState(initialEvent?.privateVenue ?? false),
    [exactVenue, setExactVenue] = useState(initialEvent?.exactVenue ?? ''),
    [meetingUrl, setMeetingUrl] = useState(initialEvent?.meetingUrl ?? ''),
    [status, setStatus] = useState(initialEvent?.registrationStatus ?? 'open'),
    [major, setMajor] = useState(!!initialEvent?.host?.isOrg)
  const [venue, setVenue] = useState(initialEvent?.venueName ?? ''),
    [address, setAddress] = useState(initialEvent?.address ?? ''),
    [point, setPoint] = useState<[number, number]>(
      initialPoint ??
        (initialEvent
          ? [initialEvent.latitude, initialEvent.longitude]
          : getCity(city).districts[2].point),
    ),
    [error, setError] = useState('')
  const validate = () => {
    if (step === 0 && (!title.trim() || description.trim().length < 20)) {
      setError('Add a title and a description of at least 20 characters.')
      return false
    }
    if (step === 1) {
      if (
        !start ||
        !end ||
        (!initialEvent &&
          new Date(zonedISO(start.split('T')[0], start.split('T')[1], city)) <= new Date()) ||
        new Date(end) <= new Date(start)
      ) {
        setError('Choose a future start time and an end time after it.')
        return false
      }
      if (!unlimited && (guests < 2 || guests > 100000)) {
        setError('Choose a guest limit between 2 and 100,000.')
        return false
      }
      if (url && !safeHTTPS(url)) {
        setError('Ticket links must start with https://.')
        return false
      }
    }
    setError('')
    return true
  }
  const publish = () => {
    if (!online && (!venue.trim() || !address.trim())) {
      setError('Add a venue name and address so people can find you.')
      return
    }
    const [minLat, maxLat, minLng, maxLng] = getCity(city).bounds
    if (
      !online &&
      (point[0] < minLat || point[0] > maxLat || point[1] < minLng || point[1] > maxLng)
    ) {
      setError('Choose a location inside your selected city.')
      return
    }
    if (meetingUrl && !safeHTTPS(meetingUrl)) {
      setError('Meeting links must be valid HTTPS URLs.')
      return
    }
    if (profile.isGuest) {
      setError('Choose a local profile before hosting.')
      return
    }
    if (major && (profile.trustScore < 750 || !profile.isOrg) && !initialEvent) {
      setError(
        'Major events require an organization profile with 750 local trust points. You can host a casual gathering.',
      )
      return
    }
    const event: PulseEvent = {
      ...initialEvent,
      id: initialEvent?.id ?? generateUUID(),
      title: title.trim(),
      description: description.trim(),
      genre,
      isOnline: online,
      venueName: online ? 'Online · community session' : venue.trim(),
      address: online ? 'Online' : address.trim(),
      city,
      country: getCity(city).country,
      latitude: online ? 0 : point[0],
      longitude: online ? 0 : point[1],
      startTime: zonedISO(start.split('T')[0], start.split('T')[1], city),
      endTime: zonedISO(end.split('T')[0], end.split('T')[1], city),
      imageUrl: image || PHOTOS[genre],
      registrationUrl: url.trim(),
      priceTier: amount > 0 ? 'paid' : 'free',
      priceAmount: amount,
      priceKnown: true,
      currency: getCity(city).currency,
      sourcePlatform: initialEvent?.sourcePlatform ?? 'Community',
      sourceHash: '',
      isVerified: false,
      attendeesCount: initialEvent?.attendeesCount ?? 0,
      rating: initialEvent?.rating ?? 0,
      host: initialEvent?.host ?? {
        id: profile.id,
        name: profile.name,
        handle: profile.handle,
        trustScore: profile.trustScore,
        isOrg: major,
      },
      maxGuests: unlimited ? undefined : guests,
      unlimited,
      minTrustScore: minimumTrust,
      privateVenue,
      exactVenue: exactVenue.trim(),
      meetingUrl: meetingUrl.trim(),
      registrationStatus: status,
      provenance: initialEvent?.provenance ?? 'community',
      state: getCity(city).state,
      locationPrecision: online ? 'online' : 'district',
      tags: [genre],
    }
    try {
      const verified = verifyEvent(event)
      if (initialEvent) useEventsStore.getState().updateEvent(verified.event)
      else {
        addEvents([verified.event])
        recordHost(verified.event)
      }
      onPublished(verified.event)
      notify(
        initialEvent
          ? 'Your event changes are saved.'
          : verified.repaired
            ? 'Meetup published. The pin was placed at the nearest verified district.'
            : 'Your meetup is on the map. Let the good times begin.',
      )
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <Modal title="Make something happen." eyebrow="HOST A LITTLE GOOD TIME" onClose={onClose} wide>
      <div className="wizard-steps">
        {['The idea', 'The details', 'The place'].map((s, i) => (
          <span key={s} className={step >= i ? 'active' : ''}>
            <i>{step > i ? <Check size={12} /> : i + 1}</i>
            {s}
          </span>
        ))}
      </div>
      <div className="modal-content host-content" key={step}>
        {step === 0 ? (
          <>
            {!initialEvent && (
              <>
                <span className="field-label">Start with an idea</span>
                <div className="host-templates">
                  {(
                    [
                      ['sports', 'A friendly 5-a-side match'],
                      ['tech', 'Build an AI project together'],
                      ['social', 'Coffee & a good conversation'],
                      ['photography', 'Golden hour photo walk'],
                      ['gaming', 'Community game night'],
                      ['music', 'Acoustic sunset jam'],
                      ['books', 'Silent reading & book swap'],
                      ['food', 'The neighborhood food crawl'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      className="vibe-chip"
                      key={value}
                      onClick={() => {
                        setGenre(value)
                        setTitle(label)
                        setDescription(
                          `Join a welcoming local gathering for ${label.toLowerCase()}. All experience levels are welcome. Bring your curiosity and meet some new people.`,
                        )
                        setOnline(value === 'gaming')
                        setGuests(value === 'sports' ? 10 : 20)
                      }}
                    >
                      <GenreIcon genre={value} size={14} />
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="segmented">
              <button className={!online ? 'active' : ''} onClick={() => setOnline(false)}>
                In person
              </button>
              <button className={online ? 'active' : ''} onClick={() => setOnline(true)}>
                Online
              </button>
            </div>
            <div className="segmented">
              <button className={!major ? 'active' : ''} onClick={() => setMajor(false)}>
                Casual gathering
              </button>
              <button
                className={major ? 'active' : ''}
                disabled={!initialEvent && (!profile.isOrg || profile.trustScore < 750)}
                onClick={() => setMajor(true)}
              >
                Major / organization event
              </button>
            </div>
            {!initialEvent && (!profile.isOrg || profile.trustScore < 750) && (
              <p className="fine-print">
                Major events open to organization profiles with at least 750 local trust points.
              </p>
            )}
            <label className="field-label">
              Give it a name
              <input
                autoFocus
                value={title}
                maxLength={100}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Coffee, cameras & a city walk"
              />
            </label>
            <label className="field-label">
              What’s the plan?
              <textarea
                value={description}
                maxLength={3000}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Tell people what to expect, what to bring, and what makes it special."
              />
            </label>
            <label className="field-label">Choose your vibe</label>
            <div className="vibe-chips">
              {GENRES.map((g) => (
                <button
                  key={g.id}
                  className={`vibe-chip ${genre === g.id ? 'active' : ''}`}
                  onClick={() => setGenre(g.id)}
                >
                  <GenreIcon genre={g.id} />
                  {g.short}
                </button>
              ))}
            </div>
            <label className="upload-cover">
              <img src={image || PHOTOS[genre]} alt="Meetup cover preview" />
              <span>
                <ImagePlus size={20} />
                Add a cover photo<small>JPG, PNG, or WebP · up to 2 MB</small>
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-label="Upload event cover photo"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  if (
                    file.size > 2 * 1024 * 1024 ||
                    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
                  ) {
                    setError('Please choose a JPG, PNG, or WebP image smaller than 2 MB.')
                    return
                  }
                  const reader = new FileReader()
                  reader.onload = () => {
                    const result = String(reader.result),
                      preview = new Image()
                    preview.onload = () => {
                      setImage(result)
                      setError('')
                    }
                    preview.onerror = () =>
                      setError('This file could not be decoded as an image. Choose another photo.')
                    preview.src = result
                  }
                  reader.onerror = () =>
                    setError('The image could not be read. Choose another photo.')
                  reader.readAsDataURL(file)
                }}
              />
            </label>
          </>
        ) : step === 1 ? (
          <>
            <label className="field-label">
              City
              <Dropdown
                className="field-select"
                label={
                  <>
                    <MapPin size={17} />
                    <span>{getCity(city).name}</span>
                  </>
                }
              >
                {(close) => (
                  <>
                    {CITIES.map((c) => (
                      <button
                        key={c.id}
                        className="menu-item"
                        onClick={() => {
                          setCity(c.id)
                          setPoint(c.districts[2].point)
                          close()
                        }}
                      >
                        {c.name}
                        {city === c.id && <Check size={14} />}
                      </button>
                    ))}
                  </>
                )}
              </Dropdown>
            </label>
            <p className="fine-print">
              Times below are local to {getCity(city).name} ({getCity(city).timezone}).
            </p>
            <div className="field-row">
              <label className="field-label">
                Starts
                <input
                  type="datetime-local"
                  value={start}
                  onInput={(e) => setStart(e.currentTarget.value)}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label className="field-label">
                Ends
                <input
                  type="datetime-local"
                  value={end}
                  onInput={(e) => setEnd(e.currentTarget.value)}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
            </div>
            <div className="field-row">
              <label className="field-label">
                Guest limit
                <input
                  type="number"
                  min="2"
                  max="100000"
                  disabled={unlimited}
                  value={guests}
                  onChange={(e) => setGuests(Number(e.target.value))}
                />
              </label>
              <label className="field-label">
                Price ({getCity(city).currency})
                <input
                  type="number"
                  min="0"
                  max="100000"
                  value={amount}
                  onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                />
                <small>Leave at 0 for free entry.</small>
              </label>
            </div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={unlimited}
                onChange={(e) => setUnlimited(e.target.checked)}
              />
              Unlimited attendance
            </label>
            <div className="button-row">
              {[1, 2, 3, 6].map((hours) => (
                <button
                  className="vibe-chip"
                  key={hours}
                  onClick={() => {
                    if (!start) return
                    const value = new Date(`${start}:00Z`)
                    value.setUTCHours(value.getUTCHours() + hours)
                    setEnd(value.toISOString().slice(0, 16))
                  }}
                >
                  + {hours}h duration
                </button>
              ))}
            </div>
            <label className="field-label">
              Minimum local trust · {minimumTrust}
              <input
                type="range"
                min="0"
                max="1000"
                step="50"
                value={minimumTrust}
                onChange={(e) => setMinimumTrust(+e.target.value)}
              />
            </label>
            <label className="field-label">
              Registration status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'open' | 'closed' | 'waitlist')}
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="waitlist">Waitlist</option>
              </select>
            </label>
            <label className="field-label">
              Ticket or registration link <span className="label-hint">Optional</span>
              <input
                type="url"
                value={url}
                placeholder="https://…"
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>
          </>
        ) : online ? (
          <>
            <label className="field-label">
              Meeting / stream URL
              <input
                type="url"
                placeholder="https://meet.google.com/…"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={privateVenue}
                onChange={(e) => setPrivateVenue(e.target.checked)}
              />
              Reveal the meeting link after local RSVP
            </label>
            <p className="fine-print">
              Online events appear only in the online feed. Times use the selected host city’s
              timezone.
            </p>
          </>
        ) : (
          <>
            <label className="field-label">
              Venue name
              <input
                value={venue}
                maxLength={100}
                placeholder="e.g. Third Wave Coffee"
                onChange={(e) => setVenue(e.target.value)}
              />
            </label>
            <label className="field-label">
              Exact meeting instructions
              <input
                value={exactVenue}
                placeholder="Gate, floor, table, or meeting point"
                maxLength={250}
                onChange={(e) => setExactVenue(e.target.value)}
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={privateVenue}
                onChange={(e) => setPrivateVenue(e.target.checked)}
              />
              Reveal exact instructions after local RSVP
            </label>
            <button
              className="secondary-button"
              type="button"
              onClick={async () => {
                try {
                  const val = await getUserLocation()
                  setPoint(val)
                  setError('')
                } catch {
                  setError('Location access was unavailable. Pick a point on the map instead.')
                }
              }}
            >
              Use device location
            </button>
            <label className="field-label">
              Street address
              <input
                value={address}
                maxLength={200}
                placeholder="Street and neighborhood"
                onChange={(e) => setAddress(e.target.value)}
              />
            </label>
            <div className="location-map">
              <MapView city={city} events={[]} picker point={point} onPick={setPoint} />
            </div>
            <p className="fine-print">
              <MapPin size={14} />
              {point[0].toFixed(5)}, {point[1].toFixed(5)} · Pins outside known land anchors are
              adjusted to a verified district.
            </p>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <footer className="modal-footer">
        <button
          className="text-button"
          onClick={() => {
            if (step > 0) {
              setStep(step - 1)
              setError('')
            } else onClose()
          }}
        >
          {step > 0 ? (
            <>
              <ArrowLeft size={15} />
              Back
            </>
          ) : (
            'Maybe later'
          )}
        </button>
        <button
          className="primary-button"
          onClick={() => {
            if (step < 2) {
              if (validate()) setStep(step + 1)
            } else publish()
          }}
        >
          {step === 2 ? (initialEvent ? 'Save changes' : 'Publish meetup') : 'Keep going'}
          <ArrowRight size={17} />
        </button>
      </footer>
    </Modal>
  )
}
