import { useMemo, useState } from 'react'
import {
  ArrowRight,
  Check,
  Coffee,
  Flame,
  MapPin,
  Route,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import type { Budget, EventGenre, Pace, TravelPlan } from '../domain'
import { CITIES, GENRES, getCity } from '../data/cities'
import { useEventsStore, useTripStore } from '../stores'
import { addDate, cityDate } from '../services/time'
import { dayCount, eligibleEvents, generateItinerary } from '../services/itineraryEngine'
import { Dropdown, GenreIcon, Modal } from './ui'

export function TripCreationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (plan: TravelPlan) => void
}) {
  const currentCity = useEventsStore((s) => s.city),
    events = useEventsStore((s) => s.events),
    addPlan = useTripStore((s) => s.addPlan)
  const [city, setCity] = useState(currentCity),
    [citySearch, setCitySearch] = useState(''),
    [start, setStart] = useState(addDate(cityDate(new Date(), currentCity), 1)),
    [end, setEnd] = useState(addDate(cityDate(new Date(), currentCity), 3))
  const [vibes, setVibes] = useState<EventGenre[]>(['food', 'art', 'music']),
    [pace, setPace] = useState<Pace>('balanced'),
    [budget, setBudget] = useState<Budget>('all'),
    [error, setError] = useState('')
  const config = {
    destinationCity: city,
    startDate: start,
    endDate: end,
    vibeTags: vibes,
    pace,
    budget,
  }
  const matches = useMemo(
    () =>
      eligibleEvents(events, {
        destinationCity: city,
        startDate: start,
        endDate: end,
        vibeTags: vibes,
        pace,
        budget,
      }).length,
    [events, city, start, end, vibes, pace, budget],
  )
  const generate = () => {
    setError('')
    if (!start || !end || dayCount(start, end) < 1 || dayCount(start, end) > 14) {
      setError('Choose a date range between 1 and 14 days.')
      return
    }
    if (start < cityDate(new Date(), city)) {
      setError('Start your trip today or on a future date.')
      return
    }
    if (!vibes.length) {
      setError('Choose at least one vibe for your trip.')
      return
    }
    try {
      const plan = generateItinerary(events, config)
      if (!plan.stops.length) {
        setError(
          'No matching events on these dates. Try the next 10 days, more vibes, or a different budget.',
        )
        return
      }
      addPlan(plan)
      onCreated(plan)
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
        void confetti({
          particleCount: 65,
          spread: 65,
          colors: ['#202020', '#a4a4a0', '#e5e5e1'],
          origin: { y: 0.65 },
        })
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <Modal
      title="A trip that feels like you."
      eyebrow="FOLLOW YOUR CURIOSITY"
      onClose={onClose}
      wide
    >
      <div className="modal-content trip-creation">
        <p className="modal-intro">Pick a city. Find your people. We’ll connect the moments.</p>
        <label className="field-label">Where are we going?</label>
        <Dropdown
          className="field-select"
          width={400}
          label={
            <>
              <MapPin size={18} />
              <span>
                {getCity(city).name}
                <small>{getCity(city).country}</small>
              </span>
            </>
          }
        >
          {(close) => (
            <>
              <div className="menu-search">
                <Search size={15} />
                <input
                  autoFocus
                  placeholder="Search a city…"
                  aria-label="Search destination city"
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                />
              </div>
              {CITIES.filter((c) => c.name.toLowerCase().includes(citySearch.toLowerCase())).map(
                (c) => (
                  <button
                    className="menu-item"
                    key={c.id}
                    onClick={() => {
                      setCity(c.id)
                      setCitySearch('')
                      close()
                    }}
                  >
                    <MapPin size={15} />
                    {c.name}
                    <small>{c.country}</small>
                    {city === c.id && <Check size={15} />}
                  </button>
                ),
              )}
            </>
          )}
        </Dropdown>
        <div className="field-row">
          <label className="field-label">
            Arrive
            <input
              aria-label="Trip start date"
              type="date"
              min={cityDate(new Date(), city)}
              value={start}
              onChange={(e) => {
                setStart(e.target.value)
                if (e.target.value > end) setEnd(e.target.value)
              }}
            />
          </label>
          <label className="field-label">
            Head home
            <input
              aria-label="Trip end date"
              type="date"
              min={start}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
        <label className="field-label">
          What’s your kind of good time?
          <span className="label-hint">Pick a few. The first is your primary vibe.</span>
        </label>
        <div className="vibe-chips">
          {GENRES.map((g) => (
            <button
              key={g.id}
              className={`vibe-chip ${vibes.includes(g.id) ? 'active' : ''}`}
              onClick={() =>
                setVibes((v) => (v.includes(g.id) ? v.filter((id) => id !== g.id) : [...v, g.id]))
              }
            >
              <GenreIcon genre={g.id} />
              {g.label}
              {vibes.includes(g.id) && <Check size={13} />}
            </button>
          ))}
        </div>
        <label className="field-label">Set your pace</label>
        <div className="pace-options">
          {(
            [
              { id: 'chill', label: 'Take it slow', text: '1–2 moments a day', Icon: Coffee },
              {
                id: 'balanced',
                label: 'A little of everything',
                text: '2–3 moments a day',
                Icon: Zap,
              },
              { id: 'packed', label: 'All in', text: '3–4 moments a day', Icon: Flame },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              className={`pace-option ${pace === p.id ? 'active' : ''}`}
              onClick={() => setPace(p.id)}
            >
              <p.Icon size={20} />
              <strong>{p.label}</strong>
              <span>{p.text}</span>
              {pace === p.id && (
                <i>
                  <Check size={11} />
                </i>
              )}
            </button>
          ))}
        </div>
        <label className="field-label">Your budget</label>
        <div className="segmented budget-segment">
          {(
            [
              { id: 'free', label: 'Free spirits' },
              { id: 'budget', label: 'Under $25' },
              { id: 'all', label: 'All access' },
            ] as const
          ).map((b) => (
            <button
              key={b.id}
              className={budget === b.id ? 'active' : ''}
              onClick={() => setBudget(b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div className="trip-match-note">
          <Sparkles size={16} />
          <span>
            <strong>{matches} matching happenings</strong> ·{' '}
            {Number.isFinite(dayCount(start, end)) ? Math.max(0, dayCount(start, end)) : 0} days in{' '}
            {getCity(city).name}
          </span>
        </div>
        <p className="fine-print">
          <Route size={13} /> Thoughtful routes, time to travel, and room to be spontaneous.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <footer className="modal-footer">
        <button className="text-button" onClick={onClose}>
          Maybe later
        </button>
        <button className="primary-button" onClick={generate}>
          Build my adventure <ArrowRight size={17} />
        </button>
      </footer>
    </Modal>
  )
}
