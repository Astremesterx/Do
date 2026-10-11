import { useState } from 'react'
import { MapPin, Navigation } from 'lucide-react'
import { selectProfile, useCommunityStore } from '../communityStore'
import { useEventsStore } from '../stores'
import { CITIES, getCity } from '../data/cities'
import { getUserLocation } from '../services/geolocation'
import { Modal } from './ui'

export function DiscoveryControls({ onClose }: { onClose: () => void }) {
  const preferences = useCommunityStore((s) => s.preferences),
    update = useCommunityStore((s) => s.setPreferences),
    profile = useCommunityStore(selectProfile),
    city = useEventsStore((s) => s.city),
    radius = useEventsStore((s) => s.radius),
    setFilter = useEventsStore((s) => s.setFilter)
  const [locating, setLocating] = useState(false),
    [error, setError] = useState(''),
    [search, setSearch] = useState('')
  const locate = async () => {
    setLocating(true)
    setError('')
    try {
      const origin = await getUserLocation()
      update({ origin, scope: 'nearby' })
      setFilter({ radius: radius || 10 })
    } catch {
      setError('Location access was unavailable. You can use the selected city’s center instead.')
    } finally {
      setLocating(false)
    }
  }
  return (
    <Modal title="How far will curiosity take you?" eyebrow="DISCOVERY FILTERS" onClose={onClose}>
      <div className="modal-content community-form">
        <span className="field-label">Location scope</span>
        <div className="scope-grid">
          {(
            [
              ['nearby', 'Near me'],
              ['city', 'City / district'],
              ['state', 'State / region'],
              ['country', 'Country'],
              ['global', 'Worldwide'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={`vibe-chip ${preferences.scope === id ? 'active' : ''}`}
              aria-pressed={preferences.scope === id}
              onClick={() => update({ scope: id })}
            >
              <MapPin size={14} />
              {label}
            </button>
          ))}
        </div>
        <label className="field-label">
          City or district
          <input
            placeholder="Search world cities…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Discovery city"
            value={city}
            onChange={(e) => {
              setFilter({ city: e.target.value })
              update({ district: undefined })
            }}
          >
            {CITIES.filter(
              (c) =>
                c.id === city ||
                `${c.name} ${c.country}`.toLowerCase().includes(search.toLowerCase()),
            ).map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}, {c.country}
              </option>
            ))}
          </select>
        </label>
        {preferences.scope === 'city' &&
          new Set(getCity(city).districts.map((d) => d.name)).size > 1 && (
            <label className="field-label">
              District
              <select
                aria-label="Discovery district"
                value={preferences.district ?? ''}
                onChange={(e) => update({ district: e.target.value || undefined })}
              >
                <option value="">All districts</option>
                {getCity(city).districts.map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
              <small className="fine-print">
                Matches venue text or locations within 2 km of the district anchor.
              </small>
            </label>
          )}
        {preferences.scope === 'state' && (
          <p className="fine-print">
            {getCity(city).state
              ? `Showing ${getCity(city).state}.`
              : 'No state data is available for this anchor; city scope is used.'}
          </p>
        )}
        {preferences.scope === 'country' && (
          <p className="fine-print">All events in {getCity(city).country}.</p>
        )}
        {preferences.scope === 'nearby' && (
          <>
            <label className="field-label">
              Discovery radius · {radius || 10} km
              <input
                type="range"
                min="1"
                max="100"
                value={radius || 10}
                onChange={(e) => setFilter({ radius: +e.target.value })}
              />
            </label>
            <button className="secondary-button" onClick={locate} disabled={locating}>
              <Navigation size={15} />
              {locating ? 'Finding your area…' : 'Use my approximate location'}
            </button>
            <p className="fine-print">
              Location is requested only when you choose this action. It stays in memory for this
              session.
            </p>
          </>
        )}
        <span className="field-label">Entry pricing</span>
        <div className="segmented">
          {(['all', 'free', 'paid'] as const).map((value) => (
            <button
              key={value}
              className={preferences.pricing === value ? 'active' : ''}
              onClick={() => update({ pricing: value })}
            >
              {value === 'all' ? 'Any price' : value === 'free' ? 'Free only' : 'Paid events'}
            </button>
          ))}
        </div>
        <label className="field-label">
          Minimum host trust · {preferences.minTrust}
          <input
            type="range"
            min="0"
            max="1000"
            step="50"
            value={preferences.minTrust}
            onChange={(e) => update({ minTrust: +e.target.value })}
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={preferences.interestsOnly}
            disabled={!profile.interests.length}
            onChange={(e) => update({ interestsOnly: e.target.checked })}
          />
          Matches my interests
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={preferences.followingOnly}
            onChange={(e) => update({ followingOnly: e.target.checked })}
          />
          Hosts I follow
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="button-row">
          <button
            className="secondary-button"
            onClick={() => {
              update({
                scope: 'city',
                pricing: 'all',
                minTrust: 0,
                interestsOnly: false,
                followingOnly: false,
                origin: undefined,
                district: undefined,
              })
              setFilter({ radius: 0 })
            }}
          >
            Reset filters
          </button>
          <button className="primary-button" onClick={onClose}>
            See what’s happening
          </button>
        </div>
      </div>
    </Modal>
  )
}
