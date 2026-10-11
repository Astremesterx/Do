import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CalendarPlus,
  Car,
  Check,
  ChevronRight,
  Download,
  Footprints,
  MapPin,
  Plus,
  Repeat2,
  Route,
  Share2,
  Sparkles,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { format } from 'date-fns'
import type { ItineraryStop, PulseEvent, TravelPlan } from '../domain'
import { getCity } from '../data/cities'
import { PHOTOS } from '../data/mockEvents'
import { useEventsStore, useTripStore } from '../stores'
import { addDate, cityTime, eventSlot, formatPrice, zonedISO } from '../services/time'
import { dayCount, recalculateStops, swapAlternatives } from '../services/itineraryEngine'
import { exportCalendar, exportPlan, shareURL } from '../services/calendar'
import { generateUUID } from '../services/uuid'
import { MapView } from './MapView'
import { Dropdown, EmptyState, GenreTag, Modal } from './ui'

export function TripWorkspace({
  onCreate,
  onSelect,
  notify,
}: {
  onCreate: () => void
  onSelect: (e: PulseEvent) => void
  notify: (message: string) => void
}) {
  const plans = useTripStore((s) => s.plans),
    activeId = useTripStore((s) => s.activeId),
    setActive = useTripStore((s) => s.setActive),
    update = useTripStore((s) => s.updatePlan),
    deletePlan = useTripStore((s) => s.deletePlan),
    events = useEventsStore((s) => s.events)
  const plan = plans.find((p) => p.id === activeId) ?? plans[0]
  const [day, setDay] = useState(1),
    [swap, setSwap] = useState<ItineraryStop | null>(null),
    [custom, setCustom] = useState(false),
    [share, setShare] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false)
  const activeDay = plan ? Math.min(day, dayCount(plan.startDate, plan.endDate)) : 1
  const stops = useMemo(
    () => plan?.stops.filter((s) => s.dayNumber === activeDay) ?? [],
    [plan, activeDay],
  )
  const alternatives = useMemo(
    () => (swap && plan ? swapAlternatives(swap, plan, events) : []),
    [swap, plan, events],
  )
  if (!plan)
    return (
      <div className="trips-empty">
        <div className="trips-empty-orbit">
          <Route size={48} />
        </div>
        <span className="eyebrow">TAKE THE SCENIC ROUTE</span>
        <h1>
          Good trips are made
          <br />
          of <span>great moments.</span>
        </h1>
        <p>
          Turn the things you love into a thoughtful day-by-day adventure.
          <br />
          We’ll find the events and connect the dots.
        </p>
        <button className="primary-button" onClick={onCreate}>
          Plan my first trip <ArrowUpRight size={18} />
        </button>
        <div className="trips-benefits">
          <span>
            <MapPin size={17} />
            Real local happenings
          </span>
          <span>
            <Route size={17} />
            Routes that make sense
          </span>
          <span>
            <CalendarDays size={17} />A little room to wander
          </span>
        </div>
      </div>
    )
  const totalKm = stops.reduce((n, s) => n + s.distanceKmFromPrev, 0),
    totalTime = stops.reduce((n, s) => n + s.transitMinutesFromPrev, 0)
  return (
    <div className="trip-workspace">
      <header className="trip-header">
        <div>
          <span className="eyebrow">
            <Sparkles size={13} /> YOUR NEXT CHAPTER
          </span>
          <div className="trip-title-row">
            <h1>
              {getCity(plan.destinationCity).name}, <span>your way.</span>
            </h1>
          </div>
          <p>
            {format(new Date(`${plan.startDate}T12:00`), 'MMM d')} –{' '}
            {format(new Date(`${plan.endDate}T12:00`), 'MMM d, yyyy')}
            <span>·</span>
            {dayCount(plan.startDate, plan.endDate)} days<span>·</span>
            {plan.pace} pace
          </p>
        </div>
        <div className="trip-header-actions">
          <Dropdown
            ariaLabel="Select a saved trip"
            label={
              <>
                <Route size={15} />
                <span>My trips ({plans.length})</span>
              </>
            }
            align="right"
            width={280}
          >
            {(close) => (
              <>
                {plans.map((p) => (
                  <button
                    key={p.id}
                    className="menu-item"
                    onClick={() => {
                      setActive(p.id)
                      setDay(1)
                      close()
                    }}
                  >
                    {getCity(p.destinationCity).name}
                    <small>{format(new Date(`${p.startDate}T12:00`), 'MMM d')}</small>
                    {plan.id === p.id && <Check size={14} />}
                  </button>
                ))}
                <div className="menu-divider" />
                <button
                  className="menu-item"
                  onClick={() => {
                    close()
                    onCreate()
                  }}
                >
                  <Plus size={15} />
                  Plan another trip
                </button>
              </>
            )}
          </Dropdown>
          <button
            className="secondary-button delete-trip-action-btn"
            aria-label="Delete this trip"
            title="Delete this trip"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={15} />
            <span>Delete trip</span>
          </button>
          <button
            className="secondary-button"
            aria-label="Export itinerary calendar"
            onClick={() => {
              exportCalendar(
                plan.stops.map((s) => s.event),
                `do-${plan.destinationCity}`,
              )
              notify('Your itinerary calendar is ready.')
            }}
          >
            <CalendarPlus size={16} />
            <span>Export calendar</span>
          </button>
          <button className="primary-button" aria-label="Share trip" onClick={() => setShare(true)}>
            <Share2 size={15} />
            <span>Share trip</span>
          </button>
        </div>
      </header>
      <div className="day-tabs">
        {Array.from({ length: dayCount(plan.startDate, plan.endDate) }, (_, i) => (
          <button
            key={i}
            className={activeDay === i + 1 ? 'active' : ''}
            onClick={() => setDay(i + 1)}
          >
            <span>DAY {String(i + 1).padStart(2, '0')}</span>
            <strong>{format(new Date(`${addDate(plan.startDate, i)}T12:00`), 'EEE, MMM d')}</strong>
            <small>{plan.stops.filter((s) => s.dayNumber === i + 1).length} moments</small>
          </button>
        ))}
      </div>
      <div className="trip-body">
        <section className="trip-stops-panel">
          <header className="day-overview">
            <div>
              <h2>
                {
                  ['A good day to get lost.', 'Let curiosity lead.', 'Make a little more room.'][
                    (activeDay - 1) % 3
                  ]
                }
              </h2>
              <p>
                {stops.length} stops <span>·</span> {totalKm.toFixed(1)} km <span>·</span> ~
                {totalTime} min in transit
              </p>
            </div>
            <button
              className="icon-button"
              onClick={() => setCustom(true)}
              aria-label="Add a custom stop"
            >
              <Plus size={20} />
            </button>
          </header>
          <div className="trip-stops-scroll">
            {stops.length ? (
              stops.map((stop, i) => (
                <div key={stop.id} className="stop-group">
                  {i > 0 && (
                    <div
                      className={`transit-connector ${stop.tightConnection ? 'transit-warning' : ''}`}
                    >
                      <span className="transit-line" />
                      {stop.distanceKmFromPrev < 1 ? <Footprints size={14} /> : <Car size={14} />}
                      <span>
                        ~{stop.transitMinutesFromPrev} min · {stop.distanceKmFromPrev.toFixed(1)} km
                      </span>
                      {stop.tightConnection && (
                        <strong>
                          <TriangleAlert size={12} />
                          Tight connection — try swapping
                        </strong>
                      )}
                    </div>
                  )}
                  <article className="stop-card">
                    <div className="stop-sequence">{String(i + 1).padStart(2, '0')}</div>
                    <div className="stop-content">
                      <div className="stop-time">
                        <span>
                          {cityTime(stop.event.startTime, plan.destinationCity)} –{' '}
                          {cityTime(stop.event.endTime, plan.destinationCity)}
                        </span>
                        <small>{stop.slot}</small>
                      </div>
                      <button className="stop-title" onClick={() => onSelect(stop.event)}>
                        <h3>{stop.event.title}</h3>
                        <ArrowUpRight size={15} />
                      </button>
                      <p className="event-venue">
                        <MapPin size={13} />
                        {stop.event.venueName}
                      </p>
                      <GenreTag genre={stop.event.genre} />
                      {stop.customNotes && <p className="stop-notes">{stop.customNotes}</p>}
                      <div className="stop-actions">
                        <a
                          className="stop-ticket"
                          href={
                            stop.event.registrationUrl ||
                            `https://www.google.com/maps/search/?api=1&query=${stop.event.latitude},${stop.event.longitude}`
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          {stop.event.isCustom ? 'View place' : 'View tickets'}
                          <ArrowUpRight size={12} />
                          <span>{formatPrice(stop.event)}</span>
                        </a>
                        <button
                          className="icon-button"
                          aria-label={`Swap ${stop.event.title}`}
                          onClick={() => setSwap(stop)}
                        >
                          <Repeat2 size={15} />
                        </button>
                        <button
                          className="icon-button stop-delete"
                          aria-label={`Remove ${stop.event.title}`}
                          onClick={() =>
                            update({ ...plan, stops: plan.stops.filter((s) => s.id !== stop.id) })
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <img className="stop-photo" src={stop.event.imageUrl} alt={stop.event.genre} />
                  </article>
                </div>
              ))
            ) : (
              <EmptyState
                title="A day with room to wander."
                description="No matching events for this day. Add a custom stop, or create a trip with more vibes."
              />
            )}
            <button className="add-stop-button" onClick={() => setCustom(true)}>
              <Plus size={16} />
              Add your own little detour
            </button>
            <div className="itinerary-note">
              <Sparkles size={16} />
              <p>
                Plans are a starting point.
                <br />
                <strong>Leave a little space for the unexpected.</strong>
              </p>
            </div>
          </div>
          <footer className="day-navigation">
            <button
              className="text-button"
              disabled={activeDay === 1}
              onClick={() => setDay(activeDay - 1)}
            >
              <ArrowLeft size={14} />
              Previous day
            </button>
            <button
              className="text-button"
              disabled={activeDay === dayCount(plan.startDate, plan.endDate)}
              onClick={() => setDay(activeDay + 1)}
            >
              Next day
              <ArrowRight size={14} />
            </button>
          </footer>
        </section>
        <section className="trip-map">
          <MapView
            city={plan.destinationCity}
            events={stops.map((s) => s.event)}
            stops={stops}
            onSelect={onSelect}
          />
          <div className="route-summary glass">
            <Route size={20} />
            <div>
              <strong>One day. A few good directions.</strong>
              <span>
                {stops.length} stops connected · Times in {getCity(plan.destinationCity).timezone}
              </span>
            </div>
          </div>
        </section>
      </div>
      {swap && (
        <Modal
          title="A different kind of moment."
          eyebrow="A LITTLE CHANGE OF PLAN"
          onClose={() => setSwap(null)}
        >
          <div className="modal-content">
            <p className="modal-intro">Same time of day. Within 5 km. Enough time to get there.</p>
            {alternatives.length ? (
              alternatives.map((event) => (
                <button
                  key={event.id}
                  className="swap-option"
                  onClick={() => {
                    update({
                      ...plan,
                      stops: plan.stops.map((s) =>
                        s.id === swap.id ? { ...s, event, slot: eventSlot(event)! } : s,
                      ),
                    })
                    setSwap(null)
                    notify('A new moment, same great day.')
                  }}
                >
                  <img src={event.imageUrl} alt={event.genre} />
                  <div>
                    <GenreTag genre={event.genre} />
                    <strong>{event.title}</strong>
                    <span>
                      {cityTime(event.startTime, event.city)} · {event.venueName} ·{' '}
                      {formatPrice(event)}
                    </span>
                  </div>
                  <ChevronRight size={17} />
                </button>
              ))
            ) : (
              <EmptyState
                title="You’ve found a rare one."
                description="No other events match this time, vibe, and route. Try a custom stop or keep this moment."
              />
            )}
          </div>
        </Modal>
      )}
      {custom && (
        <CustomStopModal
          plan={plan}
          day={activeDay}
          onClose={() => setCustom(false)}
          onSave={(stop) => {
            update({ ...plan, stops: recalculateStops([...plan.stops, stop]) })
            setCustom(false)
            notify('Your little detour is on the itinerary.')
          }}
        />
      )}
      {share && <ShareTripModal plan={plan} onClose={() => setShare(false)} notify={notify} />}{' '}
      {confirmDelete && (
        <Modal
          title="Let this adventure go?"
          eyebrow="YOUR SAVED TRIPS"
          onClose={() => setConfirmDelete(false)}
        >
          <div className="modal-content">
            <p className="modal-intro">
              This removes your {getCity(plan.destinationCity).name} itinerary from this device.
              Export a copy first if you’d like to keep it.
            </p>
          </div>
          <footer className="modal-footer">
            <button className="text-button" onClick={() => setConfirmDelete(false)}>
              Keep the trip
            </button>
            <button
              className="danger-button"
              onClick={() => {
                deletePlan(plan.id)
                setConfirmDelete(false)
                setDay(1)
                notify('Trip removed.')
              }}
            >
              Delete trip
            </button>
          </footer>
        </Modal>
      )}
    </div>
  )
}

function ShareTripModal({
  plan,
  onClose,
  notify,
}: {
  plan: TravelPlan
  onClose: () => void
  notify: (s: string) => void
}) {
  const url = shareURL(plan),
    [copied, setCopied] = useState(false)
  return (
    <Modal
      title="Good adventures are better shared."
      eyebrow="SEND A LITTLE INSPIRATION"
      onClose={onClose}
    >
      <div className="modal-content">
        <p className="modal-intro">
          This link rebuilds a trip from your city, dates, vibes, and pace. Use JSON to preserve
          every custom stop and edit.
        </p>
        <label className="field-label">
          Trip configuration link
          <input
            aria-label="Shareable trip link"
            value={url}
            readOnly
            onFocus={(e) => e.target.select()}
          />
        </label>
        <button
          className="primary-button full-width"
          onClick={() => {
            void navigator.clipboard
              .writeText(url)
              .then(() => {
                setCopied(true)
                notify('Trip link copied.')
              })
              .catch(() => notify('Select the link above to copy it manually.'))
          }}
        >
          {copied ? <Check size={16} /> : <Share2 size={16} />}{' '}
          {copied ? 'Copied to clipboard' : 'Copy trip link'}
        </button>
        <button
          className="secondary-button full-width"
          onClick={() => {
            exportPlan(plan)
            notify('Your complete trip is saved as JSON.')
          }}
        >
          <Download size={16} />
          Download complete trip
        </button>
      </div>
    </Modal>
  )
}
function CustomStopModal({
  plan,
  day,
  onClose,
  onSave,
}: {
  plan: TravelPlan
  day: number
  onClose: () => void
  onSave: (stop: ItineraryStop) => void
}) {
  const [title, setTitle] = useState(''),
    [venue, setVenue] = useState(''),
    [start, setStart] = useState('12:30'),
    [end, setEnd] = useState('13:30'),
    [notes, setNotes] = useState(''),
    [point, setPoint] = useState<[number, number]>(
      getCity(plan.destinationCity).districts[0].point,
    ),
    [error, setError] = useState('')
  const save = () => {
    if (!title.trim() || !venue.trim() || !start || !end) {
      setError('Add a title, venue, and times for your stop.')
      return
    }
    const date = addDate(plan.startDate, day - 1),
      startTime = zonedISO(start < '02:00' ? addDate(date, 1) : date, start, plan.destinationCity),
      endTime = zonedISO(
        end < start || start < '02:00' ? addDate(date, 1) : date,
        end,
        plan.destinationCity,
      )
    if (+new Date(endTime) <= +new Date(startTime)) {
      setError('The end time must be after the start time.')
      return
    }
    const event: PulseEvent = {
      id: generateUUID(),
      title: title.trim(),
      description: notes || 'A little room for your own plans.',
      genre: 'food',
      isOnline: false,
      venueName: venue.trim(),
      address: `${venue.trim()}, ${getCity(plan.destinationCity).name}`,
      city: plan.destinationCity,
      country: getCity(plan.destinationCity).country,
      latitude: point[0],
      longitude: point[1],
      startTime,
      endTime,
      imageUrl: PHOTOS.food,
      registrationUrl: '',
      priceTier: 'free',
      priceAmount: 0,
      currency: getCity(plan.destinationCity).currency,
      sourcePlatform: 'Your plans',
      sourceHash: '',
      isVerified: true,
      isCustom: true,
      rating: 5,
    }
    const slot = eventSlot(event)
    if (!slot) {
      setError('Choose a start between 08:30 and 02:00 the next morning.')
      return
    }
    onSave({
      id: generateUUID(),
      event,
      slot,
      dayNumber: day,
      sortOrder: 0,
      customNotes: notes,
      transitMinutesFromPrev: 0,
      distanceKmFromPrev: 0,
    })
  }
  return (
    <Modal
      title="Make room for your own plans."
      eyebrow={`DAY ${day} · A PERSONAL DETOUR`}
      onClose={onClose}
    >
      <div className="modal-content">
        <label className="field-label">
          What’s the plan?
          <input
            value={title}
            placeholder="e.g. Dinner with an old friend"
            maxLength={100}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="field-label">
          Venue or address
          <input
            value={venue}
            placeholder="e.g. The neighborhood café"
            maxLength={200}
            onChange={(e) => setVenue(e.target.value)}
          />
        </label>
        <label className="field-label">
          Neighborhood
          <Dropdown
            className="field-select"
            label={
              <>
                <MapPin size={16} />
                {getCity(plan.destinationCity).districts.find((d) => d.point === point)?.name ??
                  'Choose a district'}
              </>
            }
          >
            {(close) => (
              <>
                {getCity(plan.destinationCity).districts.map((d) => (
                  <button
                    key={d.name}
                    className="menu-item"
                    onClick={() => {
                      setPoint(d.point)
                      close()
                    }}
                  >
                    {d.name}
                  </button>
                ))}
              </>
            )}
          </Dropdown>
        </label>
        <div className="field-row">
          <label className="field-label">
            Starts
            <input
              aria-label="Custom stop start time"
              type="time"
              value={start}
              onInput={(e) => setStart(e.currentTarget.value)}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="field-label">
            Ends
            <input
              aria-label="Custom stop end time"
              type="time"
              value={end}
              onInput={(e) => setEnd(e.currentTarget.value)}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
        <label className="field-label">
          A note to yourself
          <textarea
            value={notes}
            rows={2}
            maxLength={1000}
            placeholder="Anything worth remembering…"
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <p className="fine-print">
          Your pin uses a verified neighborhood anchor. Tight connections will be flagged in your
          day plan.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <footer className="modal-footer">
        <button className="text-button" onClick={onClose}>
          Cancel
        </button>
        <button className="primary-button" onClick={save}>
          Add to my day
          <Plus size={16} />
        </button>
      </footer>
    </Modal>
  )
}
