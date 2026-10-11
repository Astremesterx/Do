import { useState } from 'react'
import { Check, Sparkles, X } from 'lucide-react'
import { GENRES } from '../data/cities'
import type { EventGenre } from '../domain'
import { GenreIcon, Modal } from './ui'
import { selectProfile, useCommunityStore } from '../communityStore'

export function EditInterestsModal({
  onClose,
  notify,
}: {
  onClose: () => void
  notify: (message: string) => void
}) {
  const profile = useCommunityStore(selectProfile)
  const updateInterests = useCommunityStore((s) => s.updateInterests)
  const saveProfile = useCommunityStore((s) => s.saveProfile)
  const [selected, setSelected] = useState<EventGenre[]>(profile.interests ?? [])
  const [highlight, setHighlight] = useState(profile.highlightInterests ?? true)
  const [saving, setSaving] = useState(false)

  const toggleInterest = (id: EventGenre) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (updateInterests) {
        await updateInterests(selected)
      } else {
        saveProfile({ interests: selected, highlightInterests: highlight })
      }
      saveProfile({ highlightInterests: highlight })
      notify(`Updated your interests (${selected.length} selected).`)
      onClose()
    } catch {
      notify('Failed to save interests. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="What moves you?"
      eyebrow="YOUR INTERESTS"
      onClose={onClose}
    >
      <div className="modal-content interests-modal-content">
        <p className="modal-intro">
          Choose the vibes you love exploring. We will spotlight matching moments on your feed and
          on the interactive map.
        </p>

        <div className="vibe-grid">
          {GENRES.map((g) => {
            const isSelected = selected.includes(g.id)
            return (
              <button
                key={g.id}
                type="button"
                className={`vibe-card ${isSelected ? 'is-selected' : ''}`}
                aria-pressed={isSelected}
                onClick={() => toggleInterest(g.id)}
              >
                <div className="vibe-card-icon" style={{ color: g.color }}>
                  <GenreIcon genre={g.id} />
                </div>
                <div className="vibe-card-info">
                  <strong>{g.label}</strong>
                  <small>{g.short}</small>
                </div>
                <div className="vibe-card-check">
                  {isSelected && <Check size={14} />}
                </div>
              </button>
            )
          })}
        </div>

        <label className="check-label interest-highlight-toggle">
          <input
            type="checkbox"
            checked={highlight}
            onChange={(e) => setHighlight(e.target.checked)}
          />
          <span>Highlight matching moments with vibrant glow on the map</span>
        </label>

        <div className="button-row interests-modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            <X size={15} />
            <span>Cancel</span>
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={saving}
            onClick={handleSave}
          >
            <Sparkles size={15} />
            <span>{saving ? 'Saving…' : `Save ${selected.length} interests`}</span>
          </button>
        </div>
      </div>
    </Modal>
  )
}
