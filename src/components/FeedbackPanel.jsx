import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Modal } from './Modal'

export function FeedbackPanel({ onClose }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [isSending, setIsSending] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setStatus('')
    setIsSending(true)

    const { error: insertError } = await supabase.from('feedback').insert({
      name: name.trim() || null,
      email: email.trim() || null,
      message: message.trim(),
    })

    if (insertError) {
      setError(insertError.message)
    } else {
      setStatus('Thanks! Your feedback has been recorded.')
      setName('')
      setEmail('')
      setMessage('')
    }

    setIsSending(false)
  }

  return (
    <Modal
      title="Give a Feedback!"
      subtitle="Your feedback is saved securely for the Adrafteo team."
      onClose={onClose}
    >
      <form className="form feedback-form" onSubmit={handleSubmit}>
        <label>
          <span>Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
          />
        </label>
        <label>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <label>
          <span>Feedback</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Tell us what you think..."
            rows={7}
            required
          />
        </label>
        <div className="form__actions">
          <button type="button" className="button button--ghost" onClick={onClose}>
            Cancel
          </button>
          {error ? <p className="error-message">{error}</p> : null}
          {status ? <p className="status-message">{status}</p> : null}
          <button type="submit" className="button button--primary" disabled={isSending}>
            {isSending ? 'Sending...' : 'Send feedback'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
