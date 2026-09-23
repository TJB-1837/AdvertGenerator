import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `template-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeTemplate(template) {
  return {
    ...template,
    name: template.name.trim(),
    title: (template.title ?? '').trim(),
    content: template.content.trim(),
  }
}

function extractVariables(content) {
  const matches = content.match(/\[[^\[\]]+\]/g) ?? []
  const seen = new Set()

  return matches
    .map((match) => match.slice(1, -1).trim())
    .filter((name) => {
      if (!name || seen.has(name)) {
        return false
      }

      seen.add(name)
      return true
    })
}

function generateAdvertText(content, values) {
  return content.replace(/\[([^\[\]]+)\]/g, (_, rawName) => {
    const name = rawName.trim()
    return values[name]?.trim() || ''
  })
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateString))
}

function AuthPanel({ onAuthenticated, onBack }) {
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

    const result = mode === 'sign-in'
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
        <p className="topbar__subtitle">Your templates are securely saved to your Supabase account.</p>
        <form className="form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            <span>Password</span>
            <input type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {error ? <p className="error-message">{error}</p> : null}
          {message ? <p className="status-message">{message}</p> : null}
          <button type="submit" className="button button--primary button--large" disabled={isSubmitting}>
            {isSubmitting ? 'Please wait...' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <button type="button" className="button button--ghost" onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>
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

function AccountPanel({ session, onClose, onDeleted }) {
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
      'Delete your Adrafteo account permanently? All your templates will be deleted and cannot be recovered.',
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

  return (
    <Modal
      title="Account settings"
      subtitle={`Signed in as ${session.user.email}`}
      onClose={onClose}
    >
      <div className="account-panel">
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

        <section className="account-section account-section--danger">
          <div>
            <h3>Delete account</h3>
            <p>This action is permanent. Your account and all saved templates will be deleted and cannot be recovered.</p>
          </div>
          <button type="button" className="button button--danger" onClick={handleDeleteAccount} disabled={isSaving}>
            Permanently delete my account
          </button>
        </section>

        {error ? <p className="error-message">{error}</p> : null}
        {message ? <p className="status-message">{message}</p> : null}
      </div>
    </Modal>
  )
}

function FeedbackPanel({ onClose }) {
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
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
        </label>
        <label>
          <span>Email</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        </label>
        <label>
          <span>Feedback</span>
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tell us what you think..." rows={7} required />
        </label>
        <div className="form__actions">
          <button type="button" className="button button--ghost" onClick={onClose}>Cancel</button>
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

function LandingPage() {
  const [showAuth, setShowAuth] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)

  if (showAuth) {
    return <AuthPanel onAuthenticated={() => {}} onBack={() => setShowAuth(false)} />
  }

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <main className="landing-page" id="main-content">
      <nav className="landing-nav" aria-label="Primary navigation">
        <a className="landing-brand" href="#top" aria-label="Adrafteo home">
          <span className="landing-brand__mark">A</span>
          <span>Adrafteo</span>
        </a>
        <div className="landing-nav__actions">
          <button type="button" className="button button--ghost" onClick={() => setShowFeedback(true)}>
            Give a Feedback!
          </button>
          <button type="button" className="button button--ghost" onClick={() => setShowAuth(true)}>
            Sign in
          </button>
        </div>
      </nav>

      <section className="landing-hero" id="top">
        <div className="landing-hero__copy">
          <p className="eyebrow">Your listings, on autopilot</p>
          <h1>Reusable marketplace listing templates.<br /><em>Sell faster.</em></h1>
          <p className="landing-hero__lede">
            Create one strong listing template, fill in the product details, and copy a polished advert for Vinted, eBay, Depop, or wherever you sell.
          </p>
          <div className="landing-hero__actions">
            <button type="button" className="button button--primary button--large" onClick={() => setShowAuth(true)}>
              Start for free <span aria-hidden="true">→</span>
            </button>
            <span className="landing-note">No credit card. No clutter.</span>
          </div>
        </div>

        <div className="product-preview" role="img" aria-label="Adrafteo product preview">
          <div className="product-preview__topbar">
            <span className="product-preview__logo">Adrafteo</span>
            <span className="product-preview__avatar">JD</span>
          </div>
          <div className="product-preview__body">
            <div className="product-preview__heading">
              <div>
                <span className="product-preview__overline">Your workspace</span>
                <strong>Ready to list</strong>
              </div>
              <span className="product-preview__count">3 templates</span>
            </div>
            <div className="product-preview__editor">
              <div className="product-preview__fields">
                <span className="preview-label">TITLE</span>
                <div className="preview-input">Vintage denim jacket · size M</div>
                <span className="preview-label">DESCRIPTION</span>
                <div className="preview-lines"><i /><i /><i className="short" /></div>
                <div className="preview-chips"><span>[Brand]</span><span>[Size]</span><span>[Condition]</span></div>
              </div>
              <div className="product-preview__result">
                <span className="preview-label">GENERATED ADVERT</span>
                <strong>Vintage denim jacket<br />· size M</strong>
                <p>Classic denim jacket in excellent condition. Ready for its next wardrobe...</p>
                <span className="preview-copy">Copy listing <b>↗</b></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-proof" aria-label="Product benefits">
        <p>Made for the listings you write again and again</p>
        <div><span>VINTED</span><span>eBay</span><span>Depop</span><span>MARKETPLACE</span></div>
      </section>

      <section className="landing-benefits">
        <div className="landing-section-heading">
          <p className="eyebrow">Less typing. More momentum.</p>
          <h2>Your unfair advantage is a good template.</h2>
        </div>
        <div className="benefit-grid">
          <article><span className="benefit-number">01</span><h3>Keep your best copy</h3><p>Save the wording that works, so every new listing starts from a strong foundation.</p></article>
          <article><span className="benefit-number">02</span><h3>Fill the blanks</h3><p>Use simple variables for brand, size, condition, and every detail that changes.</p></article>
          <article><span className="benefit-number">03</span><h3>Post in seconds</h3><p>Generate a clean title and description, then copy the finished advert wherever you sell.</p></article>
        </div>
      </section>

      <section className="landing-faq" aria-labelledby="faq-heading">
        <div className="landing-section-heading">
          <p className="eyebrow">Good questions deserve clear answers</p>
          <h2 id="faq-heading">Everything you need to know before your next listing.</h2>
        </div>
        <div className="faq-list">
          <details>
            <summary>What is Adrafteo?</summary>
            <p>Adrafteo is a web app for resellers who want to save reusable marketplace listing templates, fill in changing product details, and copy ready-to-post adverts.</p>
          </details>
          <details>
            <summary>How do reusable listing templates work?</summary>
            <p>Write a title and description once, then add variables such as [Brand], [Size], or [Condition]. When you generate an advert, Adrafteo replaces those variables with the details of the item you are listing.</p>
          </details>
          <details>
            <summary>Can I use one template across different marketplaces?</summary>
            <p>Yes. Adrafteo keeps your templates reusable so you can adapt the same listing workflow for Vinted, eBay, Depop, and other marketplaces. You can adjust the wording whenever a platform needs a different format.</p>
          </details>
          <details>
            <summary>Are my templates private?</summary>
            <p>Your saved templates belong to your authenticated Adrafteo account. They are stored per user in Supabase and are not intended to be shared publicly.</p>
          </details>
          <details>
            <summary>Does Adrafteo use AI to generate adverts?</summary>
            <p>No. Adrafteo currently generates adverts in your browser by replacing the variables in your own templates. Your copy stays under your control and no AI service is required for ordinary generation.</p>
          </details>
        </div>
      </section>

      <section className="landing-cta">
        <div><p className="eyebrow">Start with your next listing</p><h2>Build your little library of great adverts.</h2></div>
        <button type="button" className="button button--ghost button--large" onClick={() => setShowFeedback(true)}>Give a Feedback!</button>
        <button type="button" className="button button--primary button--large" onClick={() => setShowAuth(true)}>Create your free workspace <span aria-hidden="true">→</span></button>
      </section>
      {showFeedback ? <FeedbackPanel onClose={() => setShowFeedback(false)} /> : null}
      </main>
    </>
  )
}

function TemplateCard({ template, onEdit, onGenerate, onDelete }) {
  const variables = extractVariables(`${template.title ?? ''}\n${template.content}`)

  return (
    <article className="template-card">
      <div className="template-card__header">
        <div>
          <h3>{template.name}</h3>
          <p>{variables.length} variable{variables.length === 1 ? '' : 's'} detected</p>
        </div>
        <span className="template-card__badge">Template</span>
      </div>

      <pre className="template-card__preview">{template.title ? `${template.title}\n\n` : ''}{template.content}</pre>

      <div className="template-card__footer">
        <small>Updated {formatDate(template.updated_at || template.created_at)}</small>
        <div className="template-card__actions">
          <button type="button" className="button button--ghost" onClick={() => onEdit(template)}>
            Edit
          </button>
          <button type="button" className="button button--primary" onClick={() => onGenerate(template)}>
            Generate
          </button>
          <button type="button" className="button button--danger" onClick={() => onDelete(template.id)}>
            Delete
          </button>
        </div>
      </div>
    </article>
  )
}

function Modal({ title, subtitle, onClose, children, wide = false }) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`modal ${wide ? 'modal--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <div>
            <h2 id="modal-title">{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function TemplateForm({ initialTemplate, onSave, onCancel, onDirtyChange }) {
  const [name, setName] = useState(initialTemplate?.name ?? '')
  const [title, setTitle] = useState(initialTemplate?.title ?? '')
  const [content, setContent] = useState(initialTemplate?.content ?? '')

  const variables = useMemo(() => extractVariables(`${title}\n${content}`), [title, content])

  useEffect(() => {
    const isDirty = name !== (initialTemplate?.name ?? '')
      || title !== (initialTemplate?.title ?? '')
      || content !== (initialTemplate?.content ?? '')

    onDirtyChange(isDirty)
  }, [content, initialTemplate, name, onDirtyChange, title])

  const handleSubmit = (event) => {
    event.preventDefault()
    onSave({
      ...initialTemplate,
      name,
      title,
      content,
    })
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label>
        <span>Template name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Example: Vintage jacket"
          required
        />
      </label>

      <label>
        <span>Listing title</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Example: Nike sneakers, size 42"
          required
        />
      </label>

      <label>
        <span>Template text</span>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Write your advert and use placeholders like [Brand] or [Size]"
          rows={14}
          required
        />
      </label>

      <div className="helper-box">
        <strong>Detected variables</strong>
        {variables.length > 0 ? (
          <div className="chip-list">
            {variables.map((variable) => (
              <span className="chip" key={variable}>
                {variable}
              </span>
            ))}
          </div>
        ) : (
          <p>Use brackets like [Brand] to create variable fields later.</p>
        )}
      </div>

      <div className="form__actions">
        <button type="button" className="button button--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button button--primary">
          Save template
        </button>
      </div>
    </form>
  )
}

function GeneratorPanel({ template, onClose }) {
  const variables = useMemo(
    () => extractVariables(`${template.title ?? ''}\n${template.content}`),
    [template.title, template.content],
  )
  const [values, setValues] = useState(() => Object.fromEntries(variables.map((variable) => [variable, ''])))
  const [copyStatus, setCopyStatus] = useState('')

  useEffect(() => {
    setValues(Object.fromEntries(variables.map((variable) => [variable, ''])))
    setCopyStatus('')
  }, [template.id, variables])

  const generatedTitle = useMemo(
    () => generateAdvertText(template.title ?? '', values),
    [template.title, values],
  )
  const generatedDescription = useMemo(
    () => generateAdvertText(template.content, values),
    [template.content, values],
  )
  const generatedText = `${generatedTitle}${generatedTitle && generatedDescription ? '\n\n' : ''}${generatedDescription}`

  const handleClose = () => {
    const hasEnteredValues = Object.values(values).some((value) => value.trim())

    if (hasEnteredValues && !window.confirm('Are you sure you want to quit this window? Your entered values will be lost.')) {
      return
    }

    onClose()
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedText)
      setCopyStatus('Copied to clipboard')
    } catch {
      setCopyStatus('Copy failed. Select the text and copy manually.')
    }
  }

  return (
    <Modal
      title={`Generate: ${template.name}`}
      subtitle="Fill in the variables and copy the finished advert."
      onClose={handleClose}
      wide
    >
      <div className="generator-layout">
        <section className="generator-layout__inputs">
          {variables.length > 0 ? (
            variables.map((variable) => (
              <label key={variable}>
                <span>{variable}</span>
                <input
                  value={values[variable] ?? ''}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [variable]: event.target.value,
                    }))
                  }
                  placeholder={`Enter ${variable.toLowerCase()}`}
                />
              </label>
            ))
          ) : (
            <div className="empty-state empty-state--compact">
              <h3>No variables detected</h3>
              <p>This template is ready to copy as is.</p>
            </div>
          )}
        </section>

        <section className="generator-layout__preview">
          <div className="preview-card">
            <div className="preview-card__header">
              <strong>Generated advert</strong>
              <button type="button" className="button button--primary" onClick={handleCopy}>
                Copy text
              </button>
            </div>
            <div className="generated-title">
              <span>Title</span>
              <input readOnly value={generatedTitle} aria-label="Generated listing title" />
            </div>
            <textarea readOnly value={generatedDescription} rows={16} aria-label="Generated listing description" />
            {copyStatus ? <p className="status-message">{copyStatus}</p> : null}
          </div>
        </section>
      </div>
    </Modal>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [templates, setTemplates] = useState([])
  const [editorTemplate, setEditorTemplate] = useState(null)
  const [generatorTemplate, setGeneratorTemplate] = useState(null)
  const [showAccountPanel, setShowAccountPanel] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [editorDirty, setEditorDirty] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session)
        setIsLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsLoading(false)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user) {
      setTemplates([])
      return
    }

    const loadUserTemplates = async () => {
      setError('')
      const { data, error: loadError } = await supabase
        .from('templates')
        .select('*')
        .order('updated_at', { ascending: false })

      if (loadError) {
        setError(loadError.message)
        return
      }

      setTemplates(data ?? [])
    }

    loadUserTemplates()
  }, [session])

  const handleSaveTemplate = async (draft) => {
    const normalized = normalizeTemplate(draft)

    if (!session?.user || !normalized.name || !normalized.title || !normalized.content) {
      return
    }

    const payload = {
      name: normalized.name,
      title: normalized.title,
      content: normalized.content,
    }
    const query = normalized.id
      ? supabase.from('templates').update(payload).eq('id', normalized.id).select().single()
      : supabase.from('templates').insert({ ...payload, user_id: session.user.id }).select().single()
    const { data, error: saveError } = await query

    if (saveError) {
      setError(saveError.message)
      return
    }

    setTemplates((current) => normalized.id
      ? current.map((template) => (template.id === data.id ? data : template))
      : [data, ...current])

    setEditorDirty(false)
    setEditorTemplate(null)
  }

  const handleCloseEditor = () => {
    if (editorDirty && !window.confirm('Are you sure you want to quit this window? Your unsaved changes will be lost.')) {
      return
    }

    setEditorDirty(false)
    setEditorTemplate(null)
  }

  const handleDeleteTemplate = async (id) => {
    const { error: deleteError } = await supabase.from('templates').delete().eq('id', id)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setTemplates((current) => current.filter((template) => template.id !== id))
  }

  if (isLoading) {
    return <main className="auth-shell"><p>Loading your workspace...</p></main>
  }

  if (!session) {
    return <LandingPage />
  }

  const templateCount = templates.length

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Adrafteo</p>
          <h1>Build Vinted and eBay adverts faster.</h1>
          <p className="topbar__subtitle">
            Save reusable templates, fill variables, and copy ready-to-post listings in seconds.
          </p>
        </div>
        <div className="topbar__actions">
          <button type="button" className="button button--ghost" onClick={() => setShowFeedback(true)}>
            Give a Feedback!
          </button>
          <button type="button" className="button button--ghost" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
          <button type="button" className="button button--ghost" onClick={() => setShowAccountPanel(true)}>
            Account
          </button>
          <button
            type="button"
            className="button button--primary button--large"
            onClick={() => {
              setGeneratorTemplate(null)
              setEditorDirty(false)
              setEditorTemplate({ name: '', title: '', content: '' })
            }}
          >
            + Create template
          </button>
        </div>
      </header>

      <main className="content">
        {error ? <p className="error-message">{error}</p> : null}
        <section className="stats-row">
          <div className="stat-card">
            <span>Templates</span>
            <strong>{templateCount}</strong>
          </div>
          <div className="stat-card">
            <span>Workflow</span>
            <strong>Write → Fill → Copy</strong>
          </div>
          <div className="stat-card">
            <span>Storage</span>
            <strong>Cloud synced</strong>
          </div>
        </section>

        {templateCount > 0 ? (
          <section className="grid">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onEdit={(template) => {
                  setGeneratorTemplate(null)
                  setEditorTemplate(template)
                }}
                onGenerate={(template) => {
                  setEditorTemplate(null)
                  setGeneratorTemplate(template)
                }}
                onDelete={handleDeleteTemplate}
              />
            ))}
          </section>
        ) : (
          <section className="empty-state">
            <h2>No templates yet</h2>
            <p>Create your first advert template and reuse it for every listing.</p>
            <button
              type="button"
              className="button button--primary"
              onClick={() => {
                setGeneratorTemplate(null)
                setEditorDirty(false)
                setEditorTemplate({ name: '', title: '', content: '' })
              }}
            >
              Create your first template
            </button>
          </section>
        )}
      </main>

      {editorTemplate ? (
        <Modal
          title={editorTemplate.id ? 'Edit template' : 'Create template'}
          subtitle="Write a reusable advert with placeholders in brackets."
          onClose={handleCloseEditor}
          wide
        >
          <TemplateForm
            initialTemplate={editorTemplate}
            onSave={handleSaveTemplate}
            onCancel={handleCloseEditor}
            onDirtyChange={setEditorDirty}
          />
        </Modal>
      ) : null}

      {generatorTemplate ? (
        <GeneratorPanel template={generatorTemplate} onClose={() => setGeneratorTemplate(null)} />
      ) : null}

      {showAccountPanel ? (
        <AccountPanel
          session={session}
          onClose={() => setShowAccountPanel(false)}
          onDeleted={() => setShowAccountPanel(false)}
        />
      ) : null}

      {showFeedback ? <FeedbackPanel onClose={() => setShowFeedback(false)} /> : null}
    </div>
  )
}

export default App