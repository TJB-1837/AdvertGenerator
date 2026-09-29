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

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(Number(value) || 0)
}

function getItemProfit(item) {
  if (item.status !== 'sold' || item.sale_price === null || item.sale_price === '') {
    return null
  }

  return Number(item.sale_price) - Number(item.purchase_price || 0) - Number(item.selling_fees || 0)
}

function getItemRoi(item) {
  const profit = getItemProfit(item)
  const purchasePrice = Number(item.purchase_price || 0)

  return profit === null || purchasePrice <= 0 ? null : (profit / purchasePrice) * 100
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

function variableKey(name) {
  return name.toLowerCase().replace(/[\s_-]/g, '')
}

function getInitialVariableValue(variable, initialValues, crossVariables) {
  const specificValue = initialValues[variable]
  return specificValue?.trim() ? specificValue : crossVariables[variableKey(variable)] ?? crossVariables[variable] ?? ''
}

function generateAdvertText(content, values) {
  return content.replace(/\[([^\[\]]+)\]/g, (_, rawName) => {
    const name = rawName.trim()
    return values[name]?.trim() || ''
  })
}

const platformOptions = ['Vinted', 'eBay', 'Depop', 'Facebook Marketplace', 'Vestiaire Collective', 'Other']

function getItemPlatforms(item) {
  return item.platforms?.length ? item.platforms : item.platform ? [item.platform] : []
}

function getGeneratorValues(item, variables) {
  const values = {}
  const knownValues = {
    item: item.name,
    itemname: item.name,
    product: item.name,
    name: item.name,
    condition: item.condition,
    type: item.item_type,
    platform: getItemPlatforms(item).join(', '),
  }

  variables.forEach((variable) => {
    values[variable] = knownValues[variableKey(variable)] ?? ''
  })

  return values
}

function getLotGeneratorValues(lot, items, variables) {
  const itemLines = items.map((item) => {
    const price = item.target_sale_price === null ? '' : ` - ${formatMoney(item.target_sale_price)}`
    const condition = item.condition ? ` (${item.condition})` : ''
    return `${item.name}${condition}${price}`
  }).join('\n')
  const values = {}
  const knownValues = {
    lot: lot.name,
    lotname: lot.name,
    name: lot.name,
    item: itemLines,
    items: itemLines,
    itemlist: itemLines,
    contents: itemLines,
    products: itemLines,
    price: lot.target_sale_price === null ? '' : formatMoney(lot.target_sale_price),
    lotprice: lot.target_sale_price === null ? '' : formatMoney(lot.target_sale_price),
    condition: items.map((item) => item.condition).filter(Boolean).join(', '),
  }

  variables.forEach((variable) => {
    values[variable] = knownValues[variableKey(variable)] ?? ''
  })

  return values
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
            <p>This action is permanent. Your account, templates, and inventory items will be deleted and cannot be recovered.</p>
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

function TemplateCard({ template, onEdit, onGenerate, onDuplicate, onDelete }) {
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
          <button type="button" className="button button--ghost" onClick={() => onDuplicate(template)}>
            Duplicate
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

function CrossVariablesPanel({ variables, onSave, onClose }) {
  const [rows, setRows] = useState(() => variables.map((variable) => ({ ...variable })))

  const updateRow = (index, field, value) => {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row))
  }

  const handleSave = (event) => {
    event.preventDefault()
    onSave(rows.filter((row) => row.variable_name.trim()).map((row) => ({
      ...row,
      variable_name: row.variable_name.trim().replace(/^\[|\]$/g, ''),
      default_value: row.default_value,
    })))
  }

  return <Modal title="Cross variables" subtitle="Set reusable default values for variables used across your templates." onClose={onClose} wide><form className="form" onSubmit={handleSave}><div className="helper-box"><strong>How it works</strong><p>For example, save <code>[Ton secteur / Ta gare]</code> with the value <code>Paris</code>. Every template using that exact variable will start with Paris when you click Generate. You can still edit the value for a specific advert.</p></div><div className="cross-variable-list">{rows.map((row, index) => <div className="cross-variable-row" key={row.id ?? index}><label><span>Variable</span><input value={row.variable_name} onChange={(event) => updateRow(index, 'variable_name', event.target.value)} placeholder="Ton secteur / Ta gare" /></label><label><span>Default value</span><textarea value={row.default_value} onChange={(event) => updateRow(index, 'default_value', event.target.value)} placeholder="Paris" rows={3} /></label><button type="button" className="button button--danger" onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}>Remove</button></div>)}</div><button type="button" className="button button--ghost" onClick={() => setRows((current) => [...current, { variable_name: '', default_value: '' }])}>+ Add cross variable</button><div className="form__actions"><button type="button" className="button button--ghost" onClick={onClose}>Cancel</button><button type="submit" className="button button--primary">Save cross variables</button></div></form></Modal>
}

function GeneratorPanel({ template, initialValues = {}, crossVariables = {}, onClose }) {
  const variables = useMemo(
    () => extractVariables(`${template.title ?? ''}\n${template.content}`),
    [template.title, template.content],
  )
  const [values, setValues] = useState(() => Object.fromEntries(variables.map((variable) => [variable, getInitialVariableValue(variable, initialValues, crossVariables)])))
  const [copyStatus, setCopyStatus] = useState('')

  useEffect(() => {
    setValues(Object.fromEntries(variables.map((variable) => [variable, getInitialVariableValue(variable, initialValues, crossVariables)])))
    setCopyStatus('')
  }, [crossVariables, initialValues, template.id, variables])

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
          <div className="helper-box generator-variables"><strong>Recognized variables</strong><div className="chip-list">{variables.length > 0 ? variables.map((variable) => <span className="chip" key={variable}>[{variable}]</span>) : <span className="status-message">No variables detected</span>}</div><p>Use one variable per field. Multi-line values are supported for item lists and other repeated details.</p></div>
          {variables.length > 0 ? (
            variables.map((variable) => (
              <label key={variable}>
                <span>{variable}</span>
                <textarea
                  value={values[variable] ?? ''}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [variable]: event.target.value,
                    }))
                  }
                  placeholder={`Enter ${variable.toLowerCase()}`}
                  rows={variable.toLowerCase().includes('item') || variable.toLowerCase().includes('list') ? 5 : 3}
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

function InventoryForm({ initialItem, templates, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({
    name: initialItem?.name ?? '',
    status: initialItem?.status ?? 'in_stock',
    item_type: initialItem?.item_type ?? '',
    condition: initialItem?.condition ?? '',
    platforms: getItemPlatforms(initialItem ?? {}),
    purchase_date: initialItem?.purchase_date ?? '',
    purchase_price: initialItem?.purchase_price ?? '',
    target_sale_price: initialItem?.target_sale_price ?? '',
    sale_date: initialItem?.sale_date ?? '',
    sale_price: initialItem?.sale_price ?? '',
    selling_fees: initialItem?.selling_fees ?? 0,
    template_id: initialItem?.template_id ?? '',
    notes: initialItem?.notes ?? '',
  }))

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    const savedItem = await onSave({
      ...initialItem,
      ...form,
      name: form.name.trim(),
      item_type: form.item_type.trim() || null,
      condition: form.condition.trim() || null,
      platforms: form.platforms,
      purchase_date: form.purchase_date || null,
      purchase_price: Number(form.purchase_price) || 0,
      target_sale_price: form.target_sale_price === '' ? null : Number(form.target_sale_price),
      sale_date: form.sale_date || null,
      sale_price: form.sale_price === '' ? null : Number(form.sale_price),
      selling_fees: Number(form.selling_fees) || 0,
      template_id: form.template_id || null,
      notes: form.notes.trim() || null,
    })

    if (savedItem && !initialItem?.id) {
      setForm((current) => ({
        ...current,
        name: '',
        purchase_price: '',
        target_sale_price: '',
        sale_date: '',
        sale_price: '',
        selling_fees: 0,
      }))
    }
  }

  const togglePlatform = (platform) => setForm((current) => ({
    ...current,
    platforms: current.platforms.includes(platform)
      ? current.platforms.filter((value) => value !== platform)
      : [...current.platforms, platform],
  }))

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form-grid form-grid--wide">
        <label><span>Item name</span><input value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Example: Nike Air Max 90" required /></label>
        <label><span>Status</span><select value={form.status} onChange={(event) => updateField('status', event.target.value)}><option value="in_stock">In stock</option><option value="to_list">To list</option><option value="listed">Listed</option><option value="sold">Sold</option></select></label>
        <label><span>Type</span><input value={form.item_type} onChange={(event) => updateField('item_type', event.target.value)} placeholder="Sneakers" /></label>
        <label><span>Condition</span><input value={form.condition} onChange={(event) => updateField('condition', event.target.value)} placeholder="Very good" /></label>
        <fieldset className="platform-picker"><legend>Platforms</legend><div className="platform-options">{platformOptions.map((platform) => <label key={platform}><input type="checkbox" checked={form.platforms.includes(platform)} onChange={() => togglePlatform(platform)} /><span>{platform}</span></label>)}</div></fieldset>
        <label><span>Template</span><select value={form.template_id} onChange={(event) => updateField('template_id', event.target.value)}><option value="">No template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
        <label><span>Purchase date</span><input type="date" value={form.purchase_date} onChange={(event) => updateField('purchase_date', event.target.value)} /></label>
        <label><span>Purchase price</span><input type="number" min="0" step="0.01" value={form.purchase_price} onChange={(event) => updateField('purchase_price', event.target.value)} required /></label>
        <label><span>Target sale price</span><input type="number" min="0" step="0.01" value={form.target_sale_price} onChange={(event) => updateField('target_sale_price', event.target.value)} placeholder="Expected price" /></label>
        <label><span>Sale date</span><input type="date" value={form.sale_date} onChange={(event) => updateField('sale_date', event.target.value)} /></label>
        <label><span>Sale price</span><input type="number" min="0" step="0.01" value={form.sale_price} onChange={(event) => updateField('sale_price', event.target.value)} placeholder="Leave blank until sold" /></label>
        <label><span>Selling fees</span><input type="number" min="0" step="0.01" value={form.selling_fees} onChange={(event) => updateField('selling_fees', event.target.value)} /></label>
      </div>
      <label><span>Additional notes</span><textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} placeholder="Anything worth remembering about this item..." rows={4} /></label>
      <div className="form__actions"><button type="button" className="button button--ghost" onClick={onCancel}>Cancel</button><button type="submit" className="button button--primary">{initialItem?.id ? 'Save item' : 'Add item'}</button></div>
    </form>
  )
}

function createBlankLotItem() {
  return {
    name: '',
    status: 'in_stock',
    item_type: '',
    condition: '',
    platforms: [],
    purchase_date: '',
    purchase_price: '',
    target_sale_price: '',
    sale_date: '',
    sale_price: '',
    selling_fees: 0,
    template_id: '',
    notes: '',
  }
}

function LotForm({ templates, onSave, onCancel }) {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([createBlankLotItem()])
  const [collapsedItems, setCollapsedItems] = useState(new Set())
  const [commonFields, setCommonFields] = useState({
    purchase_date: '',
    status: '',
    item_type: '',
    condition: '',
    template_id: '',
    platforms: [],
  })
  const [lotFields, setLotFields] = useState({
    purchase_date: '',
    purchase_price: '',
    target_sale_price: '',
    sale_date: '',
    sale_price: '',
    selling_fees: 0,
    template_id: '',
  })

  const updateItem = (index, field, value) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item))
  }

  const toggleItemCollapsed = (index) => {
    setCollapsedItems((current) => {
      const next = new Set(current)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const togglePlatform = (index, platform) => {
    const item = items[index]
    updateItem(index, 'platforms', item.platforms.includes(platform)
      ? item.platforms.filter((value) => value !== platform)
      : [...item.platforms, platform])
  }

  const toggleCommonPlatform = (platform) => {
    setCommonFields((current) => ({
      ...current,
      platforms: current.platforms.includes(platform)
        ? current.platforms.filter((value) => value !== platform)
        : [...current.platforms, platform],
    }))
  }

  const applyCommonFields = () => {
    setLotFields((current) => ({
      ...current,
      template_id: commonFields.template_id || current.template_id,
    }))
    setItems((current) => current.map((item) => ({
      ...item,
      purchase_date: commonFields.purchase_date || item.purchase_date,
      status: commonFields.status || item.status,
      item_type: commonFields.item_type || item.item_type,
      condition: commonFields.condition || item.condition,
      template_id: commonFields.template_id || item.template_id,
      platforms: commonFields.platforms.length > 0 ? commonFields.platforms : item.platforms,
    })))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    onSave({
      name: name.trim(),
      notes: notes.trim() || null,
      lotFields: {
        ...lotFields,
        purchase_date: lotFields.purchase_date || null,
        purchase_price: Number(lotFields.purchase_price) || 0,
        target_sale_price: lotFields.target_sale_price === '' ? null : Number(lotFields.target_sale_price),
        sale_date: lotFields.sale_date || null,
        sale_price: lotFields.sale_price === '' ? null : Number(lotFields.sale_price),
        selling_fees: Number(lotFields.selling_fees) || 0,
      },
      items: items.map((item) => ({
        ...item,
        name: item.name.trim(),
        item_type: item.item_type.trim() || null,
        condition: item.condition.trim() || null,
        purchase_date: item.purchase_date || null,
        purchase_price: Number(item.purchase_price) || 0,
        target_sale_price: item.target_sale_price === '' ? null : Number(item.target_sale_price),
        sale_date: item.sale_date || null,
        sale_price: item.sale_price === '' ? null : Number(item.sale_price),
        selling_fees: Number(item.selling_fees) || 0,
        template_id: item.template_id || null,
        notes: item.notes.trim() || null,
      })),
    })
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label><span>Lot name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: Sunday flea market haul" required /></label>
      <label><span>Lot notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Where the lot came from, shared details..." rows={3} /></label>
      <fieldset className="lot-common-fields"><legend>Common values for this lot</legend><p>Set values shared by the items, then apply them before saving. You can still edit each item afterwards.</p><div className="form-grid form-grid--wide"><label><span>Purchase date</span><input type="date" value={commonFields.purchase_date} onChange={(event) => setCommonFields((current) => ({ ...current, purchase_date: event.target.value }))} /></label><label><span>Status</span><select value={commonFields.status} onChange={(event) => setCommonFields((current) => ({ ...current, status: event.target.value }))}><option value="">Keep item values</option><option value="in_stock">In stock</option><option value="to_list">To list</option><option value="listed">Listed</option><option value="sold">Sold</option></select></label><label><span>Type</span><input value={commonFields.item_type} onChange={(event) => setCommonFields((current) => ({ ...current, item_type: event.target.value }))} placeholder="Clothing" /></label><label><span>Condition</span><input value={commonFields.condition} onChange={(event) => setCommonFields((current) => ({ ...current, condition: event.target.value }))} placeholder="Very good" /></label><label><span>Template</span><select value={commonFields.template_id} onChange={(event) => setCommonFields((current) => ({ ...current, template_id: event.target.value }))}><option value="">Keep item values</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label></div><fieldset className="platform-picker"><legend>Platforms</legend><div className="platform-options">{platformOptions.map((platform) => <label key={platform}><input type="checkbox" checked={commonFields.platforms.includes(platform)} onChange={() => toggleCommonPlatform(platform)} /><span>{platform}</span></label>)}</div></fieldset><button type="button" className="button button--ghost" onClick={applyCommonFields}>Apply to all items</button></fieldset>
      <fieldset className="lot-pricing-fields"><legend>Lot pricing</legend><div className="form-grid form-grid--wide"><label><span>Lot purchase date</span><input type="date" value={lotFields.purchase_date} onChange={(event) => setLotFields((current) => ({ ...current, purchase_date: event.target.value }))} /></label><label><span>Lot purchase price</span><input type="number" min="0" step="0.01" value={lotFields.purchase_price} onChange={(event) => setLotFields((current) => ({ ...current, purchase_price: event.target.value }))} required /></label><label><span>Lot target sale price</span><input type="number" min="0" step="0.01" value={lotFields.target_sale_price} onChange={(event) => setLotFields((current) => ({ ...current, target_sale_price: event.target.value }))} /></label><label><span>Lot sale date</span><input type="date" value={lotFields.sale_date} onChange={(event) => setLotFields((current) => ({ ...current, sale_date: event.target.value }))} /></label><label><span>Lot sale price</span><input type="number" min="0" step="0.01" value={lotFields.sale_price} onChange={(event) => setLotFields((current) => ({ ...current, sale_price: event.target.value }))} /></label><label><span>Lot selling fees</span><input type="number" min="0" step="0.01" value={lotFields.selling_fees} onChange={(event) => setLotFields((current) => ({ ...current, selling_fees: event.target.value }))} /></label></div></fieldset>
      <label><span>Lot template</span><select value={lotFields.template_id} onChange={(event) => setLotFields((current) => ({ ...current, template_id: event.target.value }))}><option value="">No template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
      <div className="lot-form-items">
        <div className="lot-form-items__header"><div><h3>Items in this lot</h3><p>Each item keeps its own prices, status and listing details.</p></div></div>
        {items.map((item, index) => <fieldset className="lot-item-form" key={index}><legend>Item {index + 1}</legend><div className="form-grid form-grid--wide"><label><span>Item name</span><input value={item.name} onChange={(event) => updateItem(index, 'name', event.target.value)} placeholder="Example: Denim jacket" required /></label><label><span>Status</span><select value={item.status} onChange={(event) => updateItem(index, 'status', event.target.value)}><option value="in_stock">In stock</option><option value="to_list">To list</option><option value="listed">Listed</option><option value="sold">Sold</option></select></label><label><span>Type</span><input list="lot-type-options" value={item.item_type} onChange={(event) => updateItem(index, 'item_type', event.target.value)} placeholder="Clothing" /></label><label><span>Condition</span><input value={item.condition} onChange={(event) => updateItem(index, 'condition', event.target.value)} placeholder="Very good" /></label><label><span>Purchase date</span><input type="date" value={item.purchase_date} onChange={(event) => updateItem(index, 'purchase_date', event.target.value)} /></label><label><span>Purchase price</span><input type="number" min="0" step="0.01" value={item.purchase_price} onChange={(event) => updateItem(index, 'purchase_price', event.target.value)} required /></label><label><span>Target sale price</span><input type="number" min="0" step="0.01" value={item.target_sale_price} onChange={(event) => updateItem(index, 'target_sale_price', event.target.value)} /></label><label><span>Sale date</span><input type="date" value={item.sale_date} onChange={(event) => updateItem(index, 'sale_date', event.target.value)} /></label><label><span>Sale price</span><input type="number" min="0" step="0.01" value={item.sale_price} onChange={(event) => updateItem(index, 'sale_price', event.target.value)} /></label><label><span>Selling fees</span><input type="number" min="0" step="0.01" value={item.selling_fees} onChange={(event) => updateItem(index, 'selling_fees', event.target.value)} /></label><label><span>Template</span><select value={item.template_id} onChange={(event) => updateItem(index, 'template_id', event.target.value)}><option value="">No template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label></div><fieldset className="platform-picker"><legend>Platforms</legend><div className="platform-options">{platformOptions.map((platform) => <label key={platform}><input type="checkbox" checked={item.platforms.includes(platform)} onChange={() => togglePlatform(index, platform)} /><span>{platform}</span></label>)}</div></fieldset><label><span>Item notes</span><textarea value={item.notes} onChange={(event) => updateItem(index, 'notes', event.target.value)} rows={2} /></label>{items.length > 1 ? <button type="button" className="button button--danger lot-item-form__remove" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove item</button> : null}</fieldset>)}
        <button type="button" className="button button--ghost lot-form-items__add" onClick={() => setItems((current) => [...current, { ...createBlankLotItem(), purchase_date: commonFields.purchase_date, status: commonFields.status || 'in_stock', item_type: commonFields.item_type, condition: commonFields.condition, template_id: commonFields.template_id, platforms: commonFields.platforms }])}>+ Add sub-item</button>
      </div>
      <div className="form__actions"><button type="button" className="button button--ghost" onClick={onCancel}>Cancel</button><button type="submit" className="button button--primary">Create lot</button></div>
    </form>
  )
}

function LotSection({ lot, items, templates, onDelete, onEdit, onDuplicate, onGenerate }) {
  const purchaseValue = items.reduce((total, item) => total + Number(item.purchase_price || 0), 0)
  const targetValue = items.reduce((total, item) => total + Number(item.target_sale_price || 0), 0)

  return <details className="lot-section"><summary><span><strong>{lot.name}</strong><small>{items.length} item{items.length === 1 ? '' : 's'}</small></span><span className="lot-section__summary"><b>{formatMoney(purchaseValue)}</b><b>{formatMoney(targetValue)} target</b></span></summary><div className="lot-section__body">{lot.notes ? <p className="lot-section__notes">{lot.notes}</p> : null}<div className="lot-items-list">{items.map((item) => { const linkedTemplate = templates.find((template) => template.id === item.template_id); const profit = getItemProfit(item); return <article className="lot-item-row" key={item.id}><div><strong>{item.name}</strong><small>{item.item_type || 'Uncategorised'} · {item.condition || 'Condition not set'}</small></div><span>{formatMoney(item.purchase_price)} purchase</span><span>{item.target_sale_price === null ? '—' : formatMoney(item.target_sale_price)} target</span><span className={`status-badge status-badge--${item.status}`}>{item.status.replace('_', ' ')}</span><span className={profit !== null && profit < 0 ? 'value-negative' : 'value-positive'}>{profit === null ? '—' : formatMoney(profit)}</span><div className="table-actions">{linkedTemplate ? <button type="button" className="button button--primary" onClick={() => onGenerate(item, linkedTemplate)}>Generate</button> : null}<button type="button" className="button button--ghost" onClick={() => onEdit(item)}>Edit</button><button type="button" className="button button--ghost" onClick={() => onDuplicate(item)}>Duplicate</button></div></article> })}</div><div className="lot-section__footer"><button type="button" className="button button--danger" onClick={() => onDelete(lot.id)}>Delete lot</button></div></div></details>
}

function LotFormV2({ templates, onSave, onCancel }) {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [commonFields, setCommonFields] = useState({ purchase_date: '', status: '', item_type: '', condition: '', template_id: '', platforms: [] })
  const [lotFields, setLotFields] = useState({ purchase_date: '', purchase_price: '', target_sale_price: '', sale_date: '', sale_price: '', selling_fees: 0, template_id: '' })
  const [items, setItems] = useState([createBlankLotItem()])

  const updateItem = (index, field, value) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item))
  const togglePlatform = (index, platform) => updateItem(index, 'platforms', items[index].platforms.includes(platform) ? items[index].platforms.filter((value) => value !== platform) : [...items[index].platforms, platform])
  const toggleCommonPlatform = (platform) => setCommonFields((current) => ({ ...current, platforms: current.platforms.includes(platform) ? current.platforms.filter((value) => value !== platform) : [...current.platforms, platform] }))
  const applyCommonFields = () => {
    setLotFields((current) => ({ ...current, template_id: commonFields.template_id || current.template_id }))
    setItems((current) => current.map((item) => ({ ...item, purchase_date: commonFields.purchase_date || item.purchase_date, status: commonFields.status || item.status, item_type: commonFields.item_type || item.item_type, condition: commonFields.condition || item.condition, template_id: commonFields.template_id || item.template_id, platforms: commonFields.platforms.length ? commonFields.platforms : item.platforms })))
  }
  const addItem = () => setItems((current) => [...current, { ...createBlankLotItem(), purchase_date: commonFields.purchase_date, status: commonFields.status || 'in_stock', item_type: commonFields.item_type, condition: commonFields.condition, template_id: commonFields.template_id, platforms: commonFields.platforms }])
  const handleSubmit = (event) => {
    event.preventDefault()
    onSave({
      name: name.trim(),
      notes: notes.trim() || null,
      lotFields: { ...lotFields, purchase_date: lotFields.purchase_date || null, purchase_price: Number(lotFields.purchase_price) || 0, target_sale_price: lotFields.target_sale_price === '' ? null : Number(lotFields.target_sale_price), sale_date: lotFields.sale_date || null, sale_price: lotFields.sale_price === '' ? null : Number(lotFields.sale_price), selling_fees: Number(lotFields.selling_fees) || 0 },
      items: items.map((item) => ({ ...item, name: item.name.trim(), item_type: item.item_type.trim() || null, condition: item.condition.trim() || null, purchase_date: item.purchase_date || null, purchase_price: Number(item.purchase_price) || 0, target_sale_price: item.target_sale_price === '' ? null : Number(item.target_sale_price), sale_date: item.sale_date || null, sale_price: item.sale_price === '' ? null : Number(item.sale_price), selling_fees: Number(item.selling_fees) || 0, template_id: item.template_id || null, notes: item.notes.trim() || null })),
    })
  }

  return <form className="form" onSubmit={handleSubmit}><label><span>Lot name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: Mega Construx lot" required /></label><label><span>Lot notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} /></label><fieldset className="lot-common-fields"><legend>Common values</legend><p>Apply these values to all sub-items before saving. Each item can be edited later.</p><div className="form-grid form-grid--wide"><label><span>Purchase date</span><input type="date" value={commonFields.purchase_date} onChange={(event) => setCommonFields((current) => ({ ...current, purchase_date: event.target.value }))} /></label><label><span>Status</span><select value={commonFields.status} onChange={(event) => setCommonFields((current) => ({ ...current, status: event.target.value }))}><option value="">Keep item values</option><option value="in_stock">In stock</option><option value="to_list">To list</option><option value="listed">Listed</option><option value="sold">Sold</option></select></label><label><span>Type</span><input value={commonFields.item_type} onChange={(event) => setCommonFields((current) => ({ ...current, item_type: event.target.value }))} placeholder="Clothing" /></label><label><span>Condition</span><input value={commonFields.condition} onChange={(event) => setCommonFields((current) => ({ ...current, condition: event.target.value }))} placeholder="Very good" /></label><label><span>Template</span><select value={commonFields.template_id} onChange={(event) => setCommonFields((current) => ({ ...current, template_id: event.target.value }))}><option value="">Keep item values</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label></div><fieldset className="platform-picker"><legend>Platforms</legend><div className="platform-options">{platformOptions.map((platform) => <label key={platform}><input type="checkbox" checked={commonFields.platforms.includes(platform)} onChange={() => toggleCommonPlatform(platform)} /><span>{platform}</span></label>)}</div></fieldset><button type="button" className="button button--ghost" onClick={applyCommonFields}>Apply to all items</button></fieldset><fieldset className="lot-pricing-fields"><legend>Lot pricing</legend><div className="form-grid form-grid--wide"><label><span>Purchase date</span><input type="date" value={lotFields.purchase_date} onChange={(event) => setLotFields((current) => ({ ...current, purchase_date: event.target.value }))} /></label><label><span>Purchase price</span><input type="number" min="0" step="0.01" value={lotFields.purchase_price} onChange={(event) => setLotFields((current) => ({ ...current, purchase_price: event.target.value }))} required /></label><label><span>Target sale price</span><input type="number" min="0" step="0.01" value={lotFields.target_sale_price} onChange={(event) => setLotFields((current) => ({ ...current, target_sale_price: event.target.value }))} /></label><label><span>Sale date</span><input type="date" value={lotFields.sale_date} onChange={(event) => setLotFields((current) => ({ ...current, sale_date: event.target.value }))} /></label><label><span>Sale price</span><input type="number" min="0" step="0.01" value={lotFields.sale_price} onChange={(event) => setLotFields((current) => ({ ...current, sale_price: event.target.value }))} /></label><label><span>Selling fees</span><input type="number" min="0" step="0.01" value={lotFields.selling_fees} onChange={(event) => setLotFields((current) => ({ ...current, selling_fees: event.target.value }))} /></label><label><span>Template</span><select value={lotFields.template_id} onChange={(event) => setLotFields((current) => ({ ...current, template_id: event.target.value }))}><option value="">No template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label></div></fieldset><div className="lot-form-items"><div className="lot-form-items__header"><div><h3>Items in this lot</h3><p>Minimise an item to keep the form compact.</p></div></div>{items.map((item, index) => <details className="lot-item-form" open key={index}><summary>Item {index + 1}: {item.name || 'Unnamed item'}</summary><div className="form-grid form-grid--wide"><label><span>Item name</span><input value={item.name} onChange={(event) => updateItem(index, 'name', event.target.value)} required /></label><label><span>Status</span><select value={item.status} onChange={(event) => updateItem(index, 'status', event.target.value)}><option value="in_stock">In stock</option><option value="to_list">To list</option><option value="listed">Listed</option><option value="sold">Sold</option></select></label><label><span>Type</span><input value={item.item_type} onChange={(event) => updateItem(index, 'item_type', event.target.value)} /></label><label><span>Condition</span><input value={item.condition} onChange={(event) => updateItem(index, 'condition', event.target.value)} /></label><label><span>Purchase date</span><input type="date" value={item.purchase_date} onChange={(event) => updateItem(index, 'purchase_date', event.target.value)} /></label><label><span>Purchase price</span><input type="number" min="0" step="0.01" value={item.purchase_price} onChange={(event) => updateItem(index, 'purchase_price', event.target.value)} required /></label><label><span>Target sale price</span><input type="number" min="0" step="0.01" value={item.target_sale_price} onChange={(event) => updateItem(index, 'target_sale_price', event.target.value)} /></label><label><span>Template</span><select value={item.template_id} onChange={(event) => updateItem(index, 'template_id', event.target.value)}><option value="">No template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label></div><fieldset className="platform-picker"><legend>Platforms</legend><div className="platform-options">{platformOptions.map((platform) => <label key={platform}><input type="checkbox" checked={item.platforms.includes(platform)} onChange={() => togglePlatform(index, platform)} /><span>{platform}</span></label>)}</div></fieldset><label><span>Item notes</span><textarea value={item.notes} onChange={(event) => updateItem(index, 'notes', event.target.value)} rows={2} /></label>{items.length > 1 ? <button type="button" className="button button--danger" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove item</button> : null}</details>)}<button type="button" className="button button--ghost lot-form-items__add" onClick={addItem}>+ Add sub-item</button></div><div className="form__actions"><button type="button" className="button button--ghost" onClick={onCancel}>Cancel</button><button type="submit" className="button button--primary">Create lot</button></div></form>
}

function LotSettingsForm({ lot, templates, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({
    name: lot.name ?? '',
    template_id: lot.template_id ?? '',
    purchase_date: lot.purchase_date ?? '',
    purchase_price: lot.purchase_price ?? 0,
    target_sale_price: lot.target_sale_price ?? '',
    sale_date: lot.sale_date ?? '',
    sale_price: lot.sale_price ?? '',
    selling_fees: lot.selling_fees ?? 0,
    notes: lot.notes ?? '',
  }))

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const handleSubmit = (event) => {
    event.preventDefault()
    onSave({
      ...lot,
      ...form,
      name: form.name.trim(),
      purchase_date: form.purchase_date || null,
      purchase_price: Number(form.purchase_price) || 0,
      target_sale_price: form.target_sale_price === '' ? null : Number(form.target_sale_price),
      sale_date: form.sale_date || null,
      sale_price: form.sale_price === '' ? null : Number(form.sale_price),
      selling_fees: Number(form.selling_fees) || 0,
      template_id: form.template_id || null,
      notes: form.notes.trim() || null,
    })
  }

  return <form className="form" onSubmit={handleSubmit}><label><span>Lot name</span><input value={form.name} onChange={(event) => updateField('name', event.target.value)} required /></label><label><span>Template</span><select value={form.template_id} onChange={(event) => updateField('template_id', event.target.value)}><option value="">No template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><div className="form-grid form-grid--wide"><label><span>Purchase date</span><input type="date" value={form.purchase_date} onChange={(event) => updateField('purchase_date', event.target.value)} /></label><label><span>Purchase price</span><input type="number" min="0" step="0.01" value={form.purchase_price} onChange={(event) => updateField('purchase_price', event.target.value)} required /></label><label><span>Target sale price</span><input type="number" min="0" step="0.01" value={form.target_sale_price} onChange={(event) => updateField('target_sale_price', event.target.value)} /></label><label><span>Sale date</span><input type="date" value={form.sale_date} onChange={(event) => updateField('sale_date', event.target.value)} /></label><label><span>Sale price</span><input type="number" min="0" step="0.01" value={form.sale_price} onChange={(event) => updateField('sale_price', event.target.value)} /></label><label><span>Selling fees</span><input type="number" min="0" step="0.01" value={form.selling_fees} onChange={(event) => updateField('selling_fees', event.target.value)} /></label></div><label><span>Lot notes</span><textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} rows={4} /></label><div className="form__actions"><button type="button" className="button button--ghost" onClick={onCancel}>Cancel</button><button type="submit" className="button button--primary">Save lot</button></div></form>
}

function LotSectionV2({ lot, items, templates, onDelete, onEdit, onDuplicate, onGenerateLot, onEditLot }) {
  const purchaseValue = items.reduce((total, item) => total + Number(item.purchase_price || 0), 0)
  const targetValue = items.reduce((total, item) => total + Number(item.target_sale_price || 0), 0)
  const linkedTemplate = templates.find((template) => template.id === lot.template_id)

  return (
    <details className="lot-section">
      <summary>
        <span><strong>{lot.name}</strong><small>{items.length} item{items.length === 1 ? '' : 's'}</small></span>
        <span className="lot-section__summary"><b>{formatMoney(lot.purchase_price || purchaseValue)} purchase</b><b>{formatMoney(lot.target_sale_price || targetValue)} target</b></span>
      </summary>
      <div className="lot-section__body">
        {lot.notes ? <p className="lot-section__notes">{lot.notes}</p> : null}
        <div className="lot-section__actions">
          {linkedTemplate ? <button type="button" className="button button--primary" onClick={() => onGenerateLot(lot, items, linkedTemplate)}>Generate lot</button> : null}
          <button type="button" className="button button--ghost" onClick={() => onEditLot(lot)}>Edit lot</button>
          <button type="button" className="button button--danger" onClick={() => onDelete(lot.id)}>Delete lot</button>
        </div>
        <div className="lot-items-list">
          {items.map((item) => <article className="lot-item-row" key={item.id}>
            <div><strong>{item.name}</strong><small>{item.item_type || 'Uncategorised'} · {item.condition || 'Condition not set'}</small></div>
            <span>{formatMoney(item.purchase_price)} purchase</span>
            <span>{item.target_sale_price === null ? '—' : formatMoney(item.target_sale_price)} target</span>
            <span className={`status-badge status-badge--${item.status}`}>{item.status.replace('_', ' ')}</span>
            <div className="table-actions"><button type="button" className="button button--ghost" onClick={() => onEdit(item)}>Edit</button><button type="button" className="button button--ghost" onClick={() => onDuplicate(item)}>Duplicate</button></div>
          </article>)}
        </div>
      </div>
    </details>
  )
}

function InventoryPage({ items, lots, templates, onCreate, onCreateLot, onEdit, onEditLot, onDelete, onDuplicate, onDeleteLot, onGenerate, onGenerateLot }) {
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const totalPurchase = items.reduce((total, item) => total + Number(item.purchase_price || 0), 0)
  const stockItems = items.filter((item) => item.status !== 'sold')
  const targetValue = stockItems.reduce((total, item) => total + Number(item.target_sale_price || 0), 0)
  const soldItems = items.filter((item) => item.status === 'sold')
  const realisedSales = soldItems.reduce((total, item) => total + Number(item.sale_price || 0), 0)
  const realisedProfit = soldItems.reduce((total, item) => total + (getItemProfit(item) || 0), 0)
  const soldPurchaseValue = soldItems.reduce((total, item) => total + Number(item.purchase_price || 0), 0)
  const realisedRoi = soldPurchaseValue > 0 ? (realisedProfit / soldPurchaseValue) * 100 : null
  const visibleItems = items.filter((item) => {
    const matchesFilter = filter === 'all' || item.status === filter
    const matchesQuery = !query.trim() || `${item.name} ${item.item_type ?? ''} ${getItemPlatforms(item).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())
    return matchesFilter && matchesQuery
  })
  return (
    <>
      <div className="page-heading"><div><p className="eyebrow">Inventory</p><h2>Know what you own. Know what it earns.</h2><p className="topbar__subtitle">Track every item from purchase to sale, with your listing workflow close at hand.</p></div><div className="page-heading__actions"><button type="button" className="button button--ghost button--large" onClick={onCreateLot}>+ Add lot</button><button type="button" className="button button--primary button--large" onClick={onCreate}>+ Add item</button></div></div>
      <section className="stats-row stats-row--inventory">
        <div className="stat-card"><span>Items</span><strong>{items.length}</strong><small>{stockItems.length} in stock</small></div>
        <div className="stat-card"><span>Purchase value</span><strong>{formatMoney(totalPurchase)}</strong><small>All recorded items</small></div>
        <div className="stat-card"><span>Target sale value</span><strong>{formatMoney(targetValue)}</strong><small>Current stock only</small></div>
        <div className="stat-card"><span>Realised sales</span><strong>{formatMoney(realisedSales)}</strong><small>{soldItems.length} sold</small></div>
        <div className="stat-card"><span>Realised ROI</span><strong>{realisedRoi === null ? '—' : `${realisedRoi.toFixed(1)}%`}</strong><small>{formatMoney(realisedProfit)} profit</small></div>
      </section>
      <section className="inventory-toolbar"><div className="inventory-filters" role="group" aria-label="Filter inventory"><button type="button" className={`filter-button ${filter === 'all' ? 'filter-button--active' : ''}`} onClick={() => setFilter('all')}>All <span>{items.length}</span></button><button type="button" className={`filter-button ${filter === 'in_stock' ? 'filter-button--active' : ''}`} onClick={() => setFilter('in_stock')}>In stock</button><button type="button" className={`filter-button ${filter === 'to_list' ? 'filter-button--active' : ''}`} onClick={() => setFilter('to_list')}>To list</button><button type="button" className={`filter-button ${filter === 'listed' ? 'filter-button--active' : ''}`} onClick={() => setFilter('listed')}>Listed</button><button type="button" className={`filter-button ${filter === 'sold' ? 'filter-button--active' : ''}`} onClick={() => setFilter('sold')}>Sold</button></div><input className="inventory-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search inventory..." aria-label="Search inventory" /></section>
      {lots.length > 0 ? <section className="lots-list"><div className="section-label"><span>Lots</span><small>{lots.length} lot{lots.length === 1 ? '' : 's'}</small></div>{lots.map((lot) => <LotSectionV2 key={lot.id} lot={lot} items={items.filter((item) => item.lot_id === lot.id)} templates={templates} onDelete={onDeleteLot} onEdit={onEdit} onEditLot={onEditLot} onDuplicate={onDuplicate} onGenerateLot={onGenerateLot} />)}</section> : null}
      {visibleItems.length > 0 ? <div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Name</th><th>Status</th><th>Purchase</th><th>Target sale</th><th>Sale</th><th>Profit</th><th>ROI</th><th>Type</th><th>Platforms</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visibleItems.map((item) => { const profit = getItemProfit(item); const roi = getItemRoi(item); const linkedTemplate = templates.find((template) => template.id === item.template_id); return <tr key={item.id}><td><strong>{item.name}</strong><small>{item.purchase_date || 'No purchase date'}</small></td><td><span className={`status-badge status-badge--${item.status}`}>{item.status.replace('_', ' ')}</span></td><td>{formatMoney(item.purchase_price)}</td><td>{item.target_sale_price === null ? '—' : formatMoney(item.target_sale_price)}</td><td>{item.sale_price === null ? '—' : formatMoney(item.sale_price)}</td><td className={profit !== null && profit < 0 ? 'value-negative' : 'value-positive'}>{profit === null ? '—' : formatMoney(profit)}</td><td className={roi !== null && roi < 0 ? 'value-negative' : 'value-positive'}>{roi === null ? '—' : `${roi.toFixed(1)}%`}</td><td>{item.item_type || '—'}</td><td>{getItemPlatforms(item).join(', ') || '—'}</td><td><div className="table-actions">{linkedTemplate ? <button type="button" className="button button--primary" onClick={() => onGenerate(item, linkedTemplate)}>Generate</button> : null}<button type="button" className="button button--ghost" onClick={() => onEdit(item)}>Edit</button><button type="button" className="button button--ghost" onClick={() => onDuplicate(item)}>Duplicate</button><button type="button" className="button button--danger" onClick={() => onDelete(item.id)}>Delete</button></div></td></tr> })}</tbody></table></div> : <section className="empty-state"><h2>{items.length === 0 ? 'Your inventory is empty' : 'No items match this view'}</h2><p>{items.length === 0 ? 'Add your first item to start tracking stock and profitability.' : 'Try another filter or search term.'}</p>{items.length === 0 ? <button type="button" className="button button--primary" onClick={onCreate}>Add your first item</button> : null}</section>}
    </>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [templates, setTemplates] = useState([])
  const [crossVariables, setCrossVariables] = useState([])
  const [inventoryItems, setInventoryItems] = useState([])
  const [inventoryLots, setInventoryLots] = useState([])
  const [activeView, setActiveView] = useState('templates')
  const [editorTemplate, setEditorTemplate] = useState(null)
  const [generatorTemplate, setGeneratorTemplate] = useState(null)
  const [inventoryEditor, setInventoryEditor] = useState(null)
  const [lotEditor, setLotEditor] = useState(null)
  const [showAccountPanel, setShowAccountPanel] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [showCrossVariables, setShowCrossVariables] = useState(false)
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
      setCrossVariables([])
      setInventoryItems([])
      setInventoryLots([])
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

    const loadCrossVariables = async () => {
      const { data, error: loadError } = await supabase
        .from('cross_variables')
        .select('*')
        .order('variable_name', { ascending: true })

      if (loadError) {
        setError(loadError.message)
        return
      }

      setCrossVariables(data ?? [])
    }

    loadCrossVariables()

    const loadInventory = async () => {
      const { data, error: loadError } = await supabase
        .from('inventory_items')
        .select('*')
        .order('created_at', { ascending: false })

      if (loadError) {
        setError(loadError.message)
        return
      }

      setInventoryItems(data ?? [])
    }

    loadInventory()

    const loadInventoryLots = async () => {
      const { data, error: loadError } = await supabase
        .from('inventory_lots')
        .select('*')
        .order('created_at', { ascending: false })

      if (loadError) {
        setError(loadError.message)
        return
      }

      setInventoryLots(data ?? [])
    }

    loadInventoryLots()
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

  const handleDuplicateTemplate = async (template) => {
    const { id, created_at, updated_at, ...copy } = template
    const { data, error: duplicateError } = await supabase
      .from('templates')
      .insert({ ...copy, name: `${template.name} (copy)`, user_id: session.user.id })
      .select()
      .single()

    if (duplicateError) {
      setError(duplicateError.message)
      return
    }

    setTemplates((current) => [data, ...current])
  }

  const handleSaveCrossVariables = async (rows) => {
    const currentIds = crossVariables.filter((variable) => variable.id && !rows.some((row) => row.id === variable.id)).map((variable) => variable.id)

    if (currentIds.length > 0) {
      const { error: deleteError } = await supabase.from('cross_variables').delete().in('id', currentIds)
      if (deleteError) {
        setError(deleteError.message)
        return
      }
    }

    for (const row of rows) {
      const query = row.id
        ? supabase.from('cross_variables').update({ variable_name: row.variable_name, default_value: row.default_value }).eq('id', row.id).select().single()
        : supabase.from('cross_variables').insert({ user_id: session.user.id, variable_name: row.variable_name, default_value: row.default_value }).select().single()
      const { error: saveError } = await query

      if (saveError) {
        setError(saveError.message)
        return
      }
    }

    const { data, error: loadError } = await supabase.from('cross_variables').select('*').order('variable_name', { ascending: true })

    if (loadError) {
      setError(loadError.message)
      return
    }

    setCrossVariables(data ?? [])
    setShowCrossVariables(false)
  }

  const handleSaveInventoryItem = async (draft) => {
    if (!session?.user || !draft.name) {
      return
    }

    const { id, ...payload } = draft
    const query = id
      ? supabase.from('inventory_items').update(payload).eq('id', id).select().single()
      : supabase.from('inventory_items').insert({ ...payload, user_id: session.user.id }).select().single()
    const { data, error: saveError } = await query

    if (saveError) {
      setError(saveError.message)
      return
    }

    setInventoryItems((current) => id
      ? current.map((item) => (item.id === data.id ? data : item))
      : [data, ...current])
    if (id) {
      setInventoryEditor(null)
    }

    return data
  }

  const handleDeleteInventoryItem = async (id) => {
    if (!window.confirm('Delete this inventory item permanently?')) {
      return
    }

    const { error: deleteError } = await supabase.from('inventory_items').delete().eq('id', id)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setInventoryItems((current) => current.filter((item) => item.id !== id))
  }

  const handleDuplicateInventoryItem = (item) => {
    const { id, created_at, updated_at, ...copy } = item
    setInventoryEditor({ ...copy, name: `${item.name} (copy)` })
  }

  const handleSaveInventoryLot = async ({ name, notes, lotFields, items }) => {
    if (!session?.user || !name || items.some((item) => !item.name)) {
      return
    }

    const { data: lot, error: lotError } = await supabase
      .from('inventory_lots')
      .insert({ name, notes, ...lotFields, user_id: session.user.id })
      .select()
      .single()

    if (lotError) {
      setError(lotError.message)
      return
    }

    const { data: savedItems, error: itemsError } = await supabase
      .from('inventory_items')
      .insert(items.map((item) => ({ ...item, lot_id: lot.id, user_id: session.user.id })))
      .select()

    if (itemsError) {
      await supabase.from('inventory_lots').delete().eq('id', lot.id)
      setError(itemsError.message)
      return
    }

    setInventoryLots((current) => [lot, ...current])
    setInventoryItems((current) => [...savedItems, ...current])
    setLotEditor(null)
  }

  const handleUpdateInventoryLot = async (draft) => {
    const { id, created_at, updated_at, user_id, ...payload } = draft
    const { data, error: updateError } = await supabase.from('inventory_lots').update(payload).eq('id', id).select().single()

    if (updateError) {
      setError(updateError.message)
      return
    }

    setInventoryLots((current) => current.map((lot) => (lot.id === data.id ? data : lot)))
    setLotEditor(null)
  }

  const handleGenerateLot = (lot, items, template) => {
    setGeneratorTemplate({
      template,
      initialValues: getLotGeneratorValues(lot, items, extractVariables(`${template.title ?? ''}\n${template.content}`)),
    })
  }

  const handleDeleteInventoryLot = async (id) => {
    if (!window.confirm('Delete this lot and all of its items permanently?')) {
      return
    }

    const { error: deleteError } = await supabase.from('inventory_lots').delete().eq('id', id)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setInventoryLots((current) => current.filter((lot) => lot.id !== id))
    setInventoryItems((current) => current.filter((item) => item.lot_id !== id))
  }

  if (isLoading) {
    return <main className="auth-shell"><p>Loading your workspace...</p></main>
  }

  if (!session) {
    return <LandingPage />
  }

  const templateCount = templates.length
  const crossVariableValues = Object.fromEntries(crossVariables.map((variable) => [variableKey(variable.variable_name), variable.default_value]))

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
          <button type="button" className="button button--ghost" onClick={() => setShowCrossVariables(true)}>
            Cross variables
          </button>
          <button type="button" className="button button--ghost" onClick={() => setShowFeedback(true)}>
            Give a Feedback!
          </button>
          <button type="button" className="button button--ghost" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
          <button type="button" className="button button--ghost" onClick={() => setShowAccountPanel(true)}>
            Account
          </button>
          <button type="button" className="button button--primary button--large" onClick={() => activeView === 'inventory' ? setInventoryEditor({}) : (setGeneratorTemplate(null), setEditorDirty(false), setEditorTemplate({ name: '', title: '', content: '' }))}>
            {activeView === 'inventory' ? '+ Add item' : '+ Create template'}
          </button>
        </div>
      </header>

      <main className="content">
        {error ? <p className="error-message">{error}</p> : null}
        <nav className="workspace-nav" aria-label="Workspace sections">
          <button type="button" className={activeView === 'templates' ? 'workspace-nav__link workspace-nav__link--active' : 'workspace-nav__link'} onClick={() => setActiveView('templates')}>Templates</button>
          <button type="button" className={activeView === 'inventory' ? 'workspace-nav__link workspace-nav__link--active' : 'workspace-nav__link'} onClick={() => setActiveView('inventory')}>Inventory</button>
        </nav>

        {activeView === 'templates' ? <>
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
                onDuplicate={handleDuplicateTemplate}
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
        </> : <InventoryPage items={inventoryItems} lots={inventoryLots} templates={templates} onCreate={() => setInventoryEditor({})} onCreateLot={() => setLotEditor({})} onEdit={setInventoryEditor} onEditLot={setLotEditor} onDelete={handleDeleteInventoryItem} onDuplicate={handleDuplicateInventoryItem} onDeleteLot={handleDeleteInventoryLot} onGenerate={(item, template) => { setInventoryEditor(null); setGeneratorTemplate({ template, initialValues: getGeneratorValues(item, extractVariables(`${template.title ?? ''}\n${template.content}`)) }) }} onGenerateLot={handleGenerateLot} />}
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
        <GeneratorPanel template={generatorTemplate.template ?? generatorTemplate} initialValues={generatorTemplate.initialValues} crossVariables={crossVariableValues} onClose={() => setGeneratorTemplate(null)} />
      ) : null}

      {showCrossVariables ? <CrossVariablesPanel variables={crossVariables} onSave={handleSaveCrossVariables} onClose={() => setShowCrossVariables(false)} /> : null}

      {inventoryEditor ? (
        <Modal title={inventoryEditor.id ? 'Edit inventory item' : 'Add inventory item'} subtitle="Track the purchase, listing and sale details for one item." onClose={() => setInventoryEditor(null)} wide>
          <InventoryForm initialItem={inventoryEditor} templates={templates} onSave={handleSaveInventoryItem} onCancel={() => setInventoryEditor(null)} />
        </Modal>
      ) : null}

      {lotEditor ? (
        <Modal title={lotEditor.id ? 'Edit inventory lot' : 'Create inventory lot'} subtitle="Group several items while keeping their individual financial details." onClose={() => setLotEditor(null)} wide>
          {lotEditor.id ? <LotSettingsForm lot={lotEditor} templates={templates} onSave={handleUpdateInventoryLot} onCancel={() => setLotEditor(null)} /> : <LotFormV2 templates={templates} onSave={handleSaveInventoryLot} onCancel={() => setLotEditor(null)} />}
        </Modal>
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