import { useState } from 'react'
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  Sparkles,
  User,
} from 'lucide-react'
import { CITIES, GENRES } from '../data/cities'
import type { EventGenre } from '../domain'
import { Modal } from './ui'
import { authService } from '../services/supabase/authService'
import { useCommunityStore } from '../communityStore'

export function AuthModal({
  initialMode = 'login',
  onClose,
  notify,
}: {
  initialMode?: 'login' | 'register'
  onClose: () => void
  notify: (message: string) => void
}) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode)
  const loginToStore = useCommunityStore((s) => s.login)

  // Login form state
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)

  // Register form state
  const [regName, setRegName] = useState('')
  const [regHandle, setRegHandle] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [showRegPassword, setShowRegPassword] = useState(false)
  const [regCity, setRegCity] = useState('bangalore')
  const [regInterests, setRegInterests] = useState<EventGenre[]>(['social', 'food', 'tech'])

  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const toggleInterest = (genre: EventGenre) => {
    setRegInterests((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    )
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const res = await authService.signIn({
        email: loginEmail,
        password: loginPassword,
      })

      if (!res.ok || !res.user || !res.profile) {
        setError(res.error || 'Invalid email or password.')
        setSubmitting(false)
        return
      }

      loginToStore(res.user, res.profile)
      notify(`Welcome back, ${res.profile.name}!`)
      onClose()
    } catch (err) {
      setError((err as Error).message || 'Authentication failed. Please check your connection.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const res = await authService.signUp({
        email: regEmail,
        password: regPassword,
        name: regName,
        handle: regHandle,
        city: regCity,
        interests: regInterests,
      })

      if (!res.ok || !res.user || !res.profile) {
        setError(res.error || 'Failed to create account.')
        setSubmitting(false)
        return
      }

      loginToStore(res.user, res.profile)
      notify(`Account created! Welcome to DO, ${res.profile.name}.`)
      onClose()
    } catch (err) {
      setError((err as Error).message || 'Registration failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={mode === 'login' ? 'Welcome back to DO.' : 'Create your account.'}
      eyebrow="DO COMMUNITY"
      onClose={onClose}
    >
      <div className="modal-content auth-modal-content">
        <div className="auth-tab-row" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={`auth-tab-btn ${mode === 'login' ? 'active is-active' : ''}`}
            onClick={() => {
              setMode('login')
              setError('')
            }}
          >
            Log in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={`auth-tab-btn ${mode === 'register' ? 'active is-active' : ''}`}
            onClick={() => {
              setMode('register')
              setError('')
            }}
          >
            Create account
          </button>
        </div>

        {mode === 'login' ? (
          <form className="auth-form" onSubmit={handleLogin}>
            <p className="modal-intro">
              Access your saved moments, RSVP rooms, followed organizers, and community credentials.
            </p>

            <label className="field-label">
              <span>Email address</span>
              <div className="input-with-icon">
                <Mail size={16} />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              </div>
            </label>

            <label className="field-label">
              <span>Password</span>
              <div className="input-with-icon">
                <Lock size={16} />
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Your account password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                >
                  {showLoginPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>

            {error && (
              <div className="form-error-banner" role="alert">
                {error}
              </div>
            )}

            <div className="auth-actions">
              <button
                type="submit"
                className="primary-button full-width auth-submit-btn"
                disabled={submitting}
              >
                <span>{submitting ? 'Signing in…' : 'Log in to DO'}</span>
                <ArrowRight size={16} />
              </button>
              <div className="auth-alt-row">
                <span>New to DO?</span>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setMode('register')
                    setError('')
                  }}
                >
                  Create an account
                </button>
              </div>
            </div>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleRegister}>
            <p className="modal-intro">
              Join local gatherings, RSVP securely, chat with attendees, and connect with people who share your curiosity.
            </p>

            <div className="field-row">
              <label className="field-label">
                <span>Display name</span>
                <div className="input-with-icon">
                  <User size={16} />
                  <input
                    type="text"
                    required
                    maxLength={40}
                    placeholder="e.g. Salif"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                  />
                </div>
              </label>

              <label className="field-label">
                <span>Handle</span>
                <input
                  type="text"
                  required
                  maxLength={30}
                  placeholder="@yourhandle"
                  value={regHandle}
                  onChange={(e) => {
                    let val = e.target.value
                    if (val && !val.startsWith('@')) val = `@${val}`
                    setRegHandle(val)
                  }}
                />
              </label>
            </div>

            <label className="field-label">
              <span>Email address</span>
              <div className="input-with-icon">
                <Mail size={16} />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                />
              </div>
            </label>

            <label className="field-label">
              <span>Password (minimum 8 characters)</span>
              <div className="input-with-icon">
                <Lock size={16} />
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Create a secure password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowRegPassword(!showRegPassword)}
                >
                  {showRegPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>

            <label className="field-label">
              <span>Home city</span>
              <div className="input-with-icon">
                <MapPin size={16} />
                <select value={regCity} onChange={(e) => setRegCity(e.target.value)}>
                  {CITIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}, {c.country}
                    </option>
                  ))}
                </select>
              </div>
            </label>

            <div className="register-interests-section">
              <span className="field-label-text">Select a few interests to start:</span>
              <div className="vibe-chips compact-chips">
                {GENRES.slice(0, 8).map((g) => {
                  const isSelected = regInterests.includes(g.id)
                  return (
                    <button
                      key={g.id}
                      type="button"
                      className={`vibe-chip ${isSelected ? 'active' : ''}`}
                      onClick={() => toggleInterest(g.id)}
                    >
                      {g.short}
                    </button>
                  )
                })}
              </div>
            </div>

            {error && (
              <div className="form-error-banner" role="alert">
                {error}
              </div>
            )}

            <div className="auth-actions">
              <button
                type="submit"
                className="primary-button full-width auth-submit-btn"
                disabled={submitting}
              >
                <Sparkles size={16} />
                <span>{submitting ? 'Creating account…' : 'Create account & enter DO'}</span>
              </button>
              <div className="auth-alt-row">
                <span>Already registered?</span>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setMode('login')
                    setError('')
                  }}
                >
                  Log in
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </Modal>
  )
}
