import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { currencyOptions } from '../lib/workspace'
import { Modal } from './Modal'

export function AuthPanel({ onAuthenticated, onBack }) {
  const [mode, setMode] = useState('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
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
      setMessage('Account created. Check your email if confirmation is enabled.')
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
          Your templates are securely saved to your Supabase account.
        </p>
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
          {error ? <p className="error-message">{error}</p> : null}
          {message ? <p className="status-message">{message}</p> : null}
          <button
            type="submit"
            className="button button--primary button--large"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Please wait...' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <button
          type="button"
          className="button button--ghost"
          onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
        >
          {mode === 'sign-in' ? 'Create an account' : 'I already have an account'}
        </button>
        {onBack ? (
          <button type="button" className="button button--text" onClick={onBack}>
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
