import { useState } from 'react'
import { Check, Shield, User, X } from 'lucide-react'
import { CITIES } from '../data/cities'
import { Modal } from './ui'
import { selectProfile, useCommunityStore } from '../communityStore'

export function EditProfileModal({
  onClose,
  notify,
}: {
  onClose: () => void
  notify: (message: string) => void
}) {
  const profile = useCommunityStore(selectProfile)
  const saveProfile = useCommunityStore((s) => s.saveProfile)
  const updateProfileDetails = useCommunityStore((s) => s.updateProfileDetails)

  const [name, setName] = useState(profile.name)
  let initialHandle = profile.handle || '@user'
  if (!initialHandle.startsWith('@')) initialHandle = `@${initialHandle}`
  const [handle, setHandle] = useState(initialHandle)
  const [bio, setBio] = useState(profile.bio || '')
  const [city, setCity] = useState(profile.city || 'bangalore')
  const [isOrg, setIsOrg] = useState(Boolean(profile.isOrg))
  const [orgName, setOrgName] = useState(profile.orgName || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanName = name.trim()
    let cleanHandle = handle.trim()
    if (!cleanHandle.startsWith('@')) cleanHandle = `@${cleanHandle}`

    if (!cleanName || cleanName.length < 2) {
      setError('Please provide a name of at least 2 characters.')
      return
    }
    if (cleanHandle.length < 3) {
      setError('Please provide a valid handle (e.g. @yourname).')
      return
    }

    setSaving(true)
    setError('')

    try {
      const updates = {
        name: cleanName,
        handle: cleanHandle,
        bio: bio.trim(),
        city,
        isOrg,
        orgName: isOrg ? orgName.trim() : undefined,
      }

      if (updateProfileDetails) {
        await updateProfileDetails(updates)
      } else {
        saveProfile(updates)
      }

      notify('Profile updated successfully.')
      onClose()
    } catch (err) {
      setError((err as Error).message || 'Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Edit your profile." eyebrow="ACCOUNT DETAILS" onClose={onClose}>
      <form className="modal-content community-form" onSubmit={handleSave}>
        <p className="modal-intro">
          Manage how you appear to others on DO. Only you have access to edit this profile.
        </p>

        <div className="field-row">
          <label className="field-label">
            Display name
            <input
              value={name}
              maxLength={40}
              required
              placeholder="Your full name"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field-label">
            Handle
            <input
              value={handle}
              maxLength={30}
              required
              placeholder="@yourhandle"
              onChange={(e) => setHandle(e.target.value)}
            />
          </label>
        </div>

        <label className="field-label">
          A little about you
          <textarea
            value={bio}
            maxLength={240}
            rows={3}
            placeholder="What brings you here, favorite weekend rituals, etc."
            onChange={(e) => setBio(e.target.value)}
          />
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
          <button
            type="button"
            className={!isOrg ? 'active' : ''}
            onClick={() => setIsOrg(false)}
          >
            <User size={14} />
            <span>Explorer</span>
          </button>
          <button
            type="button"
            className={isOrg ? 'active' : ''}
            onClick={() => setIsOrg(true)}
          >
            <Shield size={14} />
            <span>Organizer / Host</span>
          </button>
        </div>

        {isOrg && (
          <label className="field-label">
            Organization or Community name
            <input
              value={orgName}
              maxLength={60}
              placeholder="e.g. Bangalore Cycling Club"
              onChange={(e) => setOrgName(e.target.value)}
            />
          </label>
        )}

        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}

        <div className="button-row">
          <button type="button" className="secondary-button" onClick={onClose}>
            <X size={15} />
            <span>Cancel</span>
          </button>
          <button type="submit" className="primary-button" disabled={saving}>
            <Check size={16} />
            <span>{saving ? 'Saving…' : 'Save profile'}</span>
          </button>
        </div>
      </form>
    </Modal>
  )
}
