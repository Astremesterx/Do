import { useState } from 'react'
import { Eye, EyeOff, Lock, ShieldCheck, Wrench } from 'lucide-react'
import { Modal } from './ui'
import { useCommunityStore } from '../communityStore'

export function AdminAuthModal({
  onClose,
  notify,
  onUnlocked,
}: {
  onClose: () => void
  notify: (msg: string) => void
  onUnlocked: () => void
}) {
  const [passphrase, setPassphrase] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const verify = useCommunityStore((s) => s.verifyAdminPassphrase)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!passphrase.trim()) {
      setError('Please enter the administrator passphrase.')
      return
    }

    const success = verify(passphrase.trim())
    if (success) {
      notify('Administrator maintenance mode unlocked.')
      onClose()
      onUnlocked()
    } else {
      setError('Invalid administrator passphrase. Access denied.')
    }
  }

  return (
    <Modal title="Site Maintenance Access" eyebrow="ADMIN PORTAL" onClose={onClose}>
      <form className="modal-content community-form" onSubmit={handleSubmit}>
        <div className="admin-auth-header">
          <div className="admin-auth-badge">
            <Lock size={20} />
          </div>
          <div>
            <strong>Restricted Access</strong>
            <p className="modal-intro" style={{ margin: 0 }}>
              This portal is strictly reserved for DO site administrators for system maintenance,
              scraper ingestion radar, and database diagnostics.
            </p>
          </div>
        </div>

        <label className="field-label">
          Admin Passphrase
          <div className="input-with-icon">
            <input
              type={showPassword ? 'text' : 'password'}
              value={passphrase}
              required
              autoFocus
              placeholder="Enter site maintenance key"
              onChange={(e) => {
                setPassphrase(e.target.value)
                setError('')
              }}
            />
            <button
              type="button"
              className="password-toggle-btn"
              aria-label={showPassword ? 'Hide passphrase' : 'Show passphrase'}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>

        {error && (
          <div className="form-error-banner" role="alert">
            <ShieldCheck size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="button-row" style={{ marginTop: '10px' }}>
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button">
            <Wrench size={15} />
            <span>Unlock maintenance</span>
          </button>
        </div>
      </form>
    </Modal>
  )
}
