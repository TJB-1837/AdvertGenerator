import { useEffect, useState } from 'react'
import { getOAuthReturnError, clearOAuthReturnError } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { currencyOptions } from '../lib/workspace'
import { Modal } from './Modal'

export function AuthPanel({ onAuthenticated, onBack }) {
  const [mode, setMode] = useState('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState(() =>
    getOAuthReturnError(typeof window === 'undefined' ? null : window.location),
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false)
  const busy = isSubmitting || isGoogleSubmitting

  useEffect(() => {
    if (getOAuthReturnError(window.location)) clearOAuthReturnError()
  }, [])

  const handleGoogleSignIn = async () => {
    if (busy) return
    setError('')
    setMessage('')
    setIsGoogleSubmitting(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).href,
        },
      })
      if (signInError) throw signInError
      // Supabase navigates to Google; the existing auth listener restores the workspace on return.
    } catch (signInError) {
      setError(signInError.message || 'Google sign-in is unavailable. Please try again.')
      setIsGoogleSubmitting(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (busy) return
    setError('')
    setMessage('')
    setIsSubmitting(true)

    const result =
      mode === 'sign-in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })

    setIsSubmitting(false)

    if (result.error) {
      setError(result.error.message)
      return
    }

    if (mode === 'sign-up') {
      if (result.data.session) onAuthenticated(result.data.session)
      else setMessage('Account created. Check your email if confirmation is enabled.')
    } else {
      onAuthenticated(result.data.session)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <p className="eyebrow">Adrafteo</p>
        <h1>{mode === 'sign-in' ? 'Welcome back.' : 'Create your workspace.'}</h1>
        <p className="topbar__subtitle">
          Save your templates and inventory in your personal workspace.
        </p>
        <button
          type="button"
          className="button auth-google"
          onClick={handleGoogleSignIn}
          disabled={busy}
          aria-busy={isGoogleSubmitting}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.3 2.98-7.36Z"
            />
            <path
              fill="#34A853"
              d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"
            />
            <path
              fill="#FBBC05"
              d="M6.41 13.92A6 6 0 0 1 6.1 12c0-.67.11-1.32.31-1.92V7.49H3.07A10 10 0 0 0 2 12c0 1.61.39 3.14 1.07 4.51l3.34-2.59Z"
            />
            <path
              fill="#EA4335"
              d="M12 5.96c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.72 9.4 5.96 12 5.96Z"
            />
          </svg>
          {isGoogleSubmitting ? 'Redirecting to Google…' : 'Continue with Google'}
        </button>
        {error ? (
          <p className="error-message" role="alert">
            {error}
          </p>
        ) : null}
        <div className="auth-divider">
          <span>or continue with email</span>
        </div>
        <form className="form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {message ? <p className="status-message">{message}</p> : null}
          <button type="submit" className="button button--primary button--large" disabled={busy}>
            {isSubmitting ? 'Please wait...' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <button
          type="button"
          className="button button--ghost"
          disabled={busy}
          onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
        >
          {mode === 'sign-in' ? 'Create an account' : 'I already have an account'}
        </button>
        {onBack ? (
          <button type="button" className="button button--text" onClick={onBack} disabled={busy}>
            Back to overview
          </button>
        ) : null}
      </section>
    </main>
  )
}

export function AccountPanel({
  session,
  onClose,
  onDeleted,
  onOpenFaq,
  dateFormat,
  onDateFormatChange,
  currency,
  onCurrencyChange,
  fullPage = false,
}) {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handlePasswordChange = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setIsSaving(true)

    const { error: updateError } = await supabase.auth.updateUser({ password })

    setIsSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setPassword('')
    setMessage('Your password has been changed.')
  }

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Delete your Adrafteo account permanently? All your templates and inventory items will be deleted and cannot be recovered.',
    )

    if (!confirmed) {
      return
    }

    const secondConfirmation = window.confirm(
      `Final confirmation: permanently delete the account for ${session.user.email}?`,
    )

    if (!secondConfirmation) {
      return
    }

    setError('')
    setIsSaving(true)
    const { error: deleteError } = await supabase.rpc('delete_my_account')

    if (deleteError) {
      setIsSaving(false)
      setError(deleteError.message)
      return
    }

    await supabase.auth.signOut()
    onDeleted()
  }

  const accountContent = (
    <div className="account-panel">
      <div className="account-page__intro">
        <p className="eyebrow">Your account</p>
        <h2>Account settings</h2>
        <p>Manage your sign-in details and the data connected to your Adrafteo workspace.</p>
        <span>{session.user.email}</span>
      </div>
      <section className="account-section">
        <div>
          <h3>Change password</h3>
          <p>Choose a new password for your Adrafteo account.</p>
        </div>
        <form className="form" onSubmit={handlePasswordChange}>
          <label>
            <span>New password</span>
            <input
              type="password"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              required
            />
          </label>
          <button type="submit" className="button button--primary" disabled={isSaving}>
            Change password
          </button>
        </form>
      </section>

      <section className="account-section">
        <div>
          <h3>Display preferences</h3>
          <p>
            Choose how dates are displayed across your workspace. Your preference is saved on this
            device.
          </p>
        </div>
        <div className="form account-preferences">
          <label>
            <span>Date format</span>
            <select value={dateFormat} onChange={(event) => onDateFormatChange(event.target.value)}>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </label>
          <label>
            <span>Currency</span>
            <select value={currency} onChange={(event) => onCurrencyChange(event.target.value)}>
              {Object.entries(currencyOptions).map(([code, option]) => (
                <option key={code} value={code}>
                  {option.symbol} {code} — {option.label}
                </option>
              ))}
            </select>
            <small>Prices are stored in EUR and converted for display and entry.</small>
          </label>
          <label>
            <span>Language</span>
            <select value="en" disabled aria-describedby="language-preference-note">
              <option value="en">English</option>
            </select>
            <small id="language-preference-note">
              More languages will be available in a future update.
            </small>
          </label>
        </div>
      </section>

      <section className="account-section account-section--danger">
        <div>
          <h3>Delete account</h3>
          <p>
            This action is permanent. Your account, templates, and inventory items will be deleted
            and cannot be recovered.
          </p>
        </div>
        <button
          type="button"
          className="button button--danger"
          onClick={handleDeleteAccount}
          disabled={isSaving}
        >
          Permanently delete my account
        </button>
      </section>

      {error ? <p className="error-message">{error}</p> : null}
      {message ? <p className="status-message">{message}</p> : null}
    </div>
  )

  if (fullPage) {
    return (
      <main className="account-page">
        <header className="account-page__header">
          <div className="topbar__brand">
            <img
              className="brand-mark"
              src="/logo-adrafteo-plume-blanche.png"
              alt=""
              aria-hidden="true"
            />
            <strong>Adrafteo</strong>
          </div>
          <button type="button" className="button button--ghost" onClick={onClose}>
            Back to workspace
          </button>
        </header>
        {accountContent}
      </main>
    )
  }

  return (
    <Modal
      title="Account settings"
      subtitle={`Signed in as ${session.user.email}`}
      onClose={onClose}
    >
      {accountContent}
    </Modal>
  )
}
