import { useEffect, useMemo, useRef, useState } from 'react'
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

function formatDate(value, dateFormat = 'DD/MM/YYYY') {
  if (!value) {
    return '—'
  }

  const [year, month, day] = value.slice(0, 10).split('-')
  if (!year || !month || !day) {
    return value
  }

  if (dateFormat === 'MM/DD/YYYY') {
    return `${month}/${day}/${year}`
  }

  if (dateFormat === 'YYYY-MM-DD') {
    return `${year}-${month}-${day}`
  }

  return `${day}/${month}/${year}`
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

function getItemQuantity(item) {
  return Math.max(1, Number(item.quantity) || 1)
}

function getItemBasePurchasePrice(item) {
  return Number(item.base_purchase_price ?? item.purchase_price ?? 0)
}

function getItemUnitValue(item) {
  return getItemBasePurchasePrice(item) / getItemQuantity(item)
}

function getShipmentTotal(shipment) {
  const transportTotal = Number(shipment.store_to_forwarder || 0) + Number(shipment.forwarder_to_home || 0) + Number(shipment.extra_cost || 0) + Number(shipment.monthly_subscription || 0)
  return transportTotal + (shipment.include_vat_in_cost === false ? 0 : Number(shipment.vat_amount || 0))
}

function getAllocatedCostByItem(allocations) {
  return allocations.reduce((costs, allocation) => ({
    ...costs,
    [allocation.item_id]: Number(costs[allocation.item_id] || 0) + Number(allocation.allocated_cost || 0),
  }), {})
}

function getLotMetrics(items) {
  const soldItems = items.filter((item) => item.status === 'sold')
  const soldPurchaseValue = soldItems.reduce((total, item) => total + Number(item.purchase_price || 0), 0)
  const realisedProfit = soldItems.reduce((total, item) => total + (getItemProfit(item) || 0), 0)
  const soldValue = soldItems.reduce((total, item) => total + Number(item.sale_price || 0), 0)
  const statuses = ['in_transit', 'in_stock', 'to_list', 'listed']
    .filter((status) => items.some((item) => item.status === status))
    .map((status) => ({ status, count: items.filter((item) => item.status === status).length }))

  return {
    soldCount: soldItems.length,
    itemCount: items.length,
    soldValue,
    statuses,
    roi: soldPurchaseValue > 0 ? (realisedProfit / soldPurchaseValue) * 100 : null,
  }
}

function getStatusLabel(status) {
  return status.replace('_', ' ')
}

function allocateAmount(total, count) {
  if (total === '' || total === null || total === undefined || count === 0) {
    return []
  }

  const totalCents = Math.round(Number(total) * 100)
  const baseCents = Math.floor(totalCents / count)
  const remainder = totalCents - (baseCents * count)

  return Array.from({ length: count }, (_, index) => ((baseCents + (index === count - 1 ? remainder : 0)) / 100).toFixed(2))
}

function allocateAmountByQuantities(total, quantities) {
  const numericTotal = typeof total === 'string' ? Number.parseFloat(total.replace(',', '.')) : Number(total)
  if (!Number.isFinite(numericTotal) || quantities.length === 0) {
    return []
  }

  const totalCents = Math.round(numericTotal * 100)
  const normalizedQuantities = quantities.map((quantity) => Math.max(1, Number(quantity) || 1))
  const totalQuantity = normalizedQuantities.reduce((sum, quantity) => sum + quantity, 0)
  let allocatedCents = 0

  return normalizedQuantities.map((itemQuantity, index) => {
    const amount = index === quantities.length - 1
      ? totalCents - allocatedCents
      : Math.round((totalCents * itemQuantity) / totalQuantity)
    allocatedCents += amount
    return (amount / 100).toFixed(2)
  })
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

function AccountPanel({ session, onClose, onDeleted, onOpenFaq, dateFormat, onDateFormatChange, fullPage = false }) {
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
            <p>Choose how dates are displayed across your workspace. Your preference is saved on this device.</p>
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
              <span>Language</span>
              <select value="en" disabled aria-describedby="language-preference-note">
                <option value="en">English</option>
              </select>
              <small id="language-preference-note">More languages will be available in a future update.</small>
            </label>
          </div>
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
  )

  if (fullPage) {
    return (
      <main className="account-page">
        <header className="account-page__header">
          <div className="topbar__brand">
            <img className="brand-mark" src="/logo-adrafteo-plume-blanche.png" alt="" aria-hidden="true" />
            <strong>Adrafteo</strong>
          </div>
          <button type="button" className="button button--ghost" onClick={onClose}>Back to workspace</button>
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

function Footer({ onOpenLegalPage, onHome, onOpenPricing }) {
  return (
    <footer className="site-footer">
      <div className="site-footer__nav">
        {onHome ? <button type="button" className="button button--text" onClick={onHome}>Home</button> : null}
        {onOpenPricing ? <button type="button" className="button button--text" onClick={onOpenPricing}>Pricing</button> : null}
        <button type="button" className="button button--text" onClick={() => onOpenLegalPage('mentions')}>Legal notice</button>
        <button type="button" className="button button--text" onClick={() => onOpenLegalPage('confidentialite')}>Privacy policy</button>
        <button type="button" className="button button--text" onClick={() => onOpenLegalPage('cgu')}>Terms</button>
      </div>
      <p className="site-footer__meta">Adrafteo — reusable marketplace listing template tool</p>
    </footer>
  )
}

const legalContent = {
  mentions: {
    title: 'Legal notice',
    intro: 'This website is operated by an individual established in France. The information below must be completed by the editor before the final public launch.',
    blocks: [
      {
        heading: 'Website owner',
        body: '<p>First name and surname: Antoine MARMOL.</p><p>Status: private individual established in France.</p><p>Contact email: adrafteo@gmail.com.</p><p>Phone: None.</p>'
      },
      {
        heading: 'Host',
        body: '<p>Primary website host: Vercel, Inc.</p><p>Address: 340 S Lemon Ave #4133, Walnut, CA 91789, United States.</p><p>Database host: Supabase, Inc.</p><p>Main processing location: Ireland for the Supabase database, with application data hosted in Europe/United States depending on the Vercel region used.</p>'
      }
    ]
  },
  confidentialite: {
    title: 'Privacy policy',
    intro: 'This policy describes the personal data processing carried out in connection with the Adrafteo service, based on the code currently present in the project.',
    blocks: [
      {
        heading: 'Data collected in the project code',
        body: '<p>The site collects the following data for the user account and service management: email address, password, Supabase identifier, template name, template title, template content, cross variables, inventory items (name, status, type, condition, purchase price, target sale price, sale price, fees, dates, platforms, notes), inventory lots, and feedback messages (name, email, message).</p><p>These data are stored in Supabase and linked to the connected user through <code>user_id</code> in the project tables.</p>'
      },
      {
        heading: 'Purposes',
        body: '<ul><li>Create and manage a user account.</li><li>Save personal templates and reusable variables.</li><li>Track inventory, purchases, sales, margins and lots.</li><li>Collect user feedback via the feedback form.</li><li>Ensure the security and correct operation of the service.</li></ul>'
      },
      {
        heading: 'Legal basis and retention period',
        body: '<p>For the user account and personal data storage, the legal basis is the performance of the service contract and account management.</p><p>Account data, templates, inventory and variables are kept while the account remains active and for up to two years after the user\'s last connection, unless the user requests earlier deletion.</p><p>Feedback messages are kept for up to 90 days after submission, then deleted from the feedback table unless a longer period is legally justified.</p>'
      },
      {
        heading: 'Recipients',
        body: '<p>Data are accessible to the user, the website editor, and the hosting providers: Supabase and Vercel.</p><p>Data are not transferred to a marketing tool or social network in the code identified today, but international transfers must be verified in the final Supabase and Vercel configuration.</p>'
      },
      {
        heading: 'Data subject rights',
        body: '<p>Under the GDPR, any person may request access, rectification, erasure, objection, restriction of processing and data portability.</p><p>To exercise these rights, contact: adrafteo@gmail.com.</p><p>You may also file a complaint with CNIL if you believe your rights are not respected.</p>'
      },
      {
        heading: 'How to exercise your rights',
        body: '<p>Send your request to <a href="mailto:adrafteo@gmail.com">adrafteo@gmail.com</a> with the subject line “GDPR request”. Describe the right you wish to exercise and the account email concerned. Additional information may be requested when necessary to verify your identity.</p><p>Requests are handled without undue delay and generally within one month of receipt. This period may be extended by up to two additional months for complex requests; you will be informed if an extension is necessary.</p>'
      }
    ]
  },
  cgu: {
    title: 'Terms of use',
    intro: 'The following Terms apply to the Adrafteo service in its current version, which includes user account creation and personal template management.',
    blocks: [
      {
        heading: 'Service purpose',
        body: '<p>Adrafteo allows a user to create reusable templates for marketplace listings, fill in variables, and generate ready-to-copy listing text.</p>'
      },
      {
        heading: 'Access and registration',
        body: '<p>Access to the service requires creating an account using an email address and password. The user is responsible for the information provided and for the confidentiality of their password.</p>'
      },
      {
        heading: 'Use of the service',
        body: '<ul><li>Use the service only for lawful purposes.</li><li>Do not enter illegal, defamatory, or rights-infringing content.</li><li>Do not attempt to bypass the site’s security measures.</li></ul>'
      },
      {
        heading: 'Data and termination',
        body: '<p>Account data, templates and inventory are stored in the user account. The account can be deleted at any time by the user in the account management area, subject to the active deletion policy in Supabase.</p>'
      },
      {
        heading: 'Intellectual property',
        body: '<p>The site and its technical elements are the property of the editor. User-entered content remains the property of the user, subject to applicable rules on third-party rights and personal data protection.</p>'
      },
      {
        heading: 'Liability',
        body: '<p>The editor strives to provide a reliable service without guaranteeing the total absence of bugs or interruptions. The service is provided “as is”, and the user is responsible for the way they use it.</p>'
      }
    ]
  }
}

function LegalPage({ page, onBack, onHome, onOpenLegalPage, onOpenPricing }) {
  const content = legalContent[page] ?? legalContent.mentions

  return (
    <main className="legal-shell">
      <header className="legal-header">
        <div>
          <p className="eyebrow">Adrafteo</p>
          <h1>{content.title}</h1>
        </div>
        <button type="button" className="button button--ghost" onClick={onBack}>Back</button>
      </header>

      <article className="legal-page">
        <p className="legal-page__intro">{content.intro}</p>
        {content.blocks.map((block) => (
          <section key={block.heading} className="legal-page__section">
            <h2>{block.heading}</h2>
            <div dangerouslySetInnerHTML={{ __html: block.body }} />
          </section>
        ))}
      </article>

      <Footer onOpenLegalPage={onOpenLegalPage} onHome={onHome} onOpenPricing={onOpenPricing} />
    </main>
  )
}

const faqItems = [
  {
    question: 'What is a reusable marketplace listing template?',
    answer: 'It is a listing structure you can save once and reuse for multiple products. Add placeholders such as [Brand], [Size], or [Condition], then fill them in for each advert.',
  },
  {
    question: 'Can I use one template on different marketplaces?',
    answer: 'Yes. Adrafteo is designed for multi-platform selling, including Vinted, eBay, Depop, Facebook Marketplace, and other marketplaces.',
  },
  {
    question: 'How do variables work?',
    answer: 'Write variable names between square brackets in your title or description. When you generate an advert, Adrafteo asks for the values and replaces the placeholders in your copy.',
  },
  {
    question: 'Are my templates private?',
    answer: 'Yes. Templates, inventory, and reusable variables are linked to your account and protected by Supabase access policies.',
  },
  {
    question: 'Does Adrafteo use AI to generate adverts?',
    answer: 'No. Standard advert generation happens in your browser by replacing the variables in your saved template. Your original template stays under your control.',
  },
]

function FaqPage({ onBack, onOpenLegalPage, onOpenPricing }) {
  return (
    <main className="legal-shell">
      <header className="legal-header">
        <div>
          <button type="button" className="button button--ghost faq-pricing-button" onClick={onOpenPricing}>
            Pricing
          </button>
          <p className="eyebrow">Adrafteo</p>
          <h1>Frequently asked questions</h1>
        </div>
        <button type="button" className="button button--ghost" onClick={onBack}>Back</button>
      </header>

      <article className="legal-page faq-page">
        <p className="legal-page__intro">Clear answers about reusable listing templates, variables, privacy, and advert generation.</p>
        <div className="faq-list">
          {faqItems.map((item) => (
            <details key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </article>

      <Footer onOpenLegalPage={onOpenLegalPage} />
    </main>
  )
}

const pricingFeatures = [
  'Reusable marketplace listing templates',
  'Dynamic variables for titles and descriptions',
  'Client-side advert generation',
  'Copy ready-to-post listing text',
  'Multi-marketplace workflows',
  'Personal templates protected by your account',
  'Inventory item tracking',
  'Inventory lots and item grouping',
  'Purchase, target sale, and realised sale values',
  'Profit and ROI calculations',
  'Multiple marketplace platforms per item',
  'Shipments and inbound cost allocation',
  'Reusable cross variables',
  'Feedback and account management',
]

function PricingPage({ onBack, onOpenLegalPage, onOpenPricing }) {
  return (
    <main className="legal-shell">
      <header className="legal-header">
        <div>
          <p className="eyebrow">Adrafteo</p>
          <h1>Simple pricing.</h1>
        </div>
        <button type="button" className="button button--ghost" onClick={onBack}>Back</button>
      </header>

      <article className="legal-page pricing-page">
        <p className="legal-page__intro">Everything available in Adrafteo is included in the Free plan during the beta.</p>
        <div className="pricing-table-wrap">
          <table className="pricing-table">
            <thead>
              <tr>
                <th scope="col">Features</th>
                <th scope="col">
                  <span className="pricing-plan-name">Free</span>
                  <small>During beta</small>
                </th>
              </tr>
            </thead>
            <tbody>
              {pricingFeatures.map((feature) => (
                <tr key={feature}>
                  <th scope="row">{feature}</th>
                  <td aria-label={`${feature}: included`}><span className="pricing-check" aria-hidden="true">✓</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="pricing-note">No payment is required while Adrafteo is in beta. Future plans will be communicated before any change to access or pricing.</p>
      </article>

      <Footer onOpenLegalPage={onOpenLegalPage} onOpenPricing={onOpenPricing} />
    </main>
  )
}

function LandingPage({ onOpenLegalPage, onOpenFaq, onOpenPricing, onBackWorkspace }) {
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
          <img className="landing-brand__mark" src="/logo-adrafteo-plume-blanche.png" alt="" aria-hidden="true" />
          <span>Adrafteo</span>
        </a>
        <div className="landing-nav__actions">
          {onBackWorkspace ? (
            <button type="button" className="button button--ghost" onClick={onBackWorkspace}>
              Workspace
            </button>
          ) : null}
          <button type="button" className="button button--ghost" onClick={onOpenPricing}>
            Pricing
          </button>
          <button type="button" className="button button--ghost" onClick={onOpenFaq}>
            FAQ
          </button>
          <button type="button" className="button button--ghost" onClick={() => setShowFeedback(true)}>
            Give a Feedback!
          </button>
          <button type="button" className="button button--ghost" onClick={() => setShowAuth(true)}>
            Sign in
          </button>
        </div>
      </nav>

      <section className="landing-hero" id="top">
        <div className="landing-hero__copy landing-hero__copy--centered">
          <p className="eyebrow">Optimized for resellers on multiple marketplaces</p>
          <h1>Stop re-typing listings.<br />Create consistent marketplace adverts with <em>[bracket variables]</em>.</h1>
          <p className="landing-hero__lede">
            Save your listing formats, fill in the product details that change, and copy the finished advert in less time.
          </p>
          <div className="landing-hero__actions">
            <button type="button" className="button button--primary button--large" onClick={() => setShowAuth(true)}>
              Create a free workspace <span aria-hidden="true">→</span>
            </button>
            <button type="button" className="button button--ghost button--large" onClick={onOpenFaq}>
              See how it works
            </button>
          </div>
          <span className="landing-note">Free during beta · No payment required</span>
        </div>

        <div className="product-preview product-preview--wide" role="img" aria-label="Adrafteo template, variable form, and generated advert preview">
          <div className="product-preview__topbar">
            <span className="product-preview__logo"><img src="/logo-adrafteo-plume-blanche.png" alt="" aria-hidden="true" />Adrafteo</span>
            <span className="product-preview__avatar">A</span>
          </div>
          <div className="product-preview__body">
            <div className="product-preview__heading">
              <div>
                <span className="product-preview__overline">Adrafteo template compiler</span>
                <strong>From template to ready-to-copy listing</strong>
              </div>
              <span className="product-preview__count">3 steps</span>
            </div>
            <div className="product-preview__editor">
              <div className="product-preview__fields">
                <span className="preview-label">01 · TEMPLATE</span>
                <div className="preview-code">[Brand] [Item] · size [Size]<br /><br />A [Condition] [Item] ready for its next owner.</div>
                <div className="preview-chips"><span>[Brand]</span><span>[Size]</span><span>[Condition]</span></div>
              </div>
              <div className="product-preview__fields">
                <span className="preview-label">02 · VARIABLES</span>
                <div className="preview-form-line">Brand <b>Nike</b></div>
                <div className="preview-form-line">Item <b>Vintage fleece</b></div>
                <div className="preview-form-line">Size <b>M</b></div>
                <div className="preview-form-line">Condition <b>Very good</b></div>
              </div>
              <div className="product-preview__result">
                <span className="preview-label">03 · READY TO COPY</span>
                <strong>Vintage denim jacket<br />· size M</strong>
                <p>Classic vintage fleece in very good condition. Details filled from your reusable template.</p>
                <span className="preview-copy">Copy listing <b>↗</b></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-metrics" aria-label="Product workflow highlights">
        <div><strong>Less retyping</strong><span>Reuse your saved structures</span></div>
        <div><strong>0%</strong><span>AI required for generation</span></div>
        <div><strong>One workspace</strong><span>Templates and inventory together</span></div>
        <div><strong>Multi-platform</strong><span>Vinted, eBay, Depop and more</span></div>
      </section>

      <section className="landing-benefits landing-capabilities">
        <div className="landing-section-heading">
          <p className="eyebrow">Built for the daily listing workflow</p>
          <h2>Keep the repeatable parts organised.</h2>
        </div>
        <div className="benefit-grid">
          <article><span className="benefit-number">01</span><h3>Save reusable templates</h3><p>Keep titles and descriptions for the listing formats you use regularly, instead of starting from an empty field.</p></article>
          <article><span className="benefit-number">02</span><h3>Fill only what changes</h3><p>Use bracket variables such as [Brand], [Size], or [Condition] for the details that differ from item to item.</p></article>
          <article><span className="benefit-number">03</span><h3>Track the wider workflow</h3><p>Keep inventory, lots, purchase values, sales, profit, and reusable defaults in the same workspace.</p></article>
        </div>
      </section>

      <section className="landing-capability-grid">
        <div className="landing-section-heading">
          <p className="eyebrow">One practical workspace</p>
          <h2>Less switching between notes, drafts, and spreadsheets.</h2>
        </div>
        <div className="landing-capability-cards">
          <article><span>Template library</span><h3>Keep your best listing structures close.</h3><p>Save, edit, duplicate, and reuse templates across the marketplaces you work with.</p><code>Template · Variables · Copy</code></article>
          <article><span>Inventory register</span><h3>Know what you own and what it earns.</h3><p>Track individual items and lots with purchase values, target prices, realised sales, profit, and ROI.</p><code>Purchase · Target · Sold · ROI</code></article>
          <article><span>Reusable defaults</span><h3>Fill familiar details once.</h3><p>Cross variables can prefill values such as location, condition, or other details used in several templates.</p><code>[Location] → Paris</code></article>
          <article><span>Client-side generation</span><h3>Your copy stays under your control.</h3><p>Adrafteo replaces variables in the browser and prepares text you can review before copying.</p><code>No AI call required</code></article>
        </div>
      </section>

      <section className="landing-workflow" aria-labelledby="workflow-heading">
        <div className="landing-section-heading">
          <p className="eyebrow">A simple three-step flow</p>
          <h2 id="workflow-heading">From saved structure to ready-to-copy advert.</h2>
        </div>
        <div className="landing-workflow__steps">
          <article><span>01</span><h3>Build your template</h3><p>Write the title and description once, then mark changing information with brackets.</p><code>[Brand] · [Item] · [Condition]</code></article>
          <article><span>02</span><h3>Enter item details</h3><p>Generate from a template and fill the values for the product you are listing.</p><code>Brand&nbsp;&nbsp; Nike<br />Size&nbsp;&nbsp;&nbsp; 42<br />Condition Excellent</code></article>
          <article><span>03</span><h3>Copy your advert</h3><p>Review the generated title and description, then copy the text to the marketplace you use.</p><code>Title + description<br />ready for your workflow</code></article>
        </div>
      </section>

      <section className="landing-social-proof" aria-labelledby="proof-heading">
        <div className="landing-section-heading">
          <p className="eyebrow">Designed for independent sellers</p>
          <h2 id="proof-heading">A calmer way to build listing habits.</h2>
        </div>
        <div className="landing-social-proof__note">
          <strong>Early beta product</strong>
          <p>Adrafteo is being shaped with reseller feedback. These are product principles, not performance guarantees: clear copy, reusable structures, and less time spent rewriting.</p>
        </div>
      </section>

      <section className="landing-faq" aria-labelledby="faq-heading">
        <div className="landing-section-heading">
          <p className="eyebrow">Clear and practical</p>
          <h2 id="faq-heading">Questions before you start?</h2>
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
        <div><p className="eyebrow">Start with one repeatable listing</p><h2>Save time on the copy you write again and again.</h2></div>
        <button type="button" className="button button--ghost button--large" onClick={() => setShowFeedback(true)}>Give a Feedback!</button>
        <button type="button" className="button button--primary button--large" onClick={() => setShowAuth(true)}>Create a free workspace <span aria-hidden="true">→</span></button>
      </section>
      {showFeedback ? <FeedbackPanel onClose={() => setShowFeedback(false)} /> : null}
      <Footer onOpenLegalPage={onOpenLegalPage} />
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
          <p>{variables.length} variable{variables.length === 1 ? '' : 's'} detected · Updated {formatDate(template.updated_at || template.created_at)}</p>
        </div>
        <div className="template-card__quick-actions">
          <button type="button" className="icon-button" onClick={() => onDelete(template.id)} aria-label={`Delete ${template.name}`}>×</button>
        </div>
      </div>

      <pre className="template-card__preview">{template.title ? `${template.title}\n\n` : ''}{template.content}</pre>

      <div className="template-card__footer">
        <div className="template-card__actions">
          <button type="button" className="button button--ghost" onClick={() => onEdit(template)}>
            Edit template
          </button>
          <button type="button" className="button button--ghost" onClick={() => onDuplicate(template)}>
            Duplicate
          </button>
          <button type="button" className="button button--primary" onClick={() => onGenerate(template)}>
            Generate
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

  return (
    <Modal
      title="Cross variables"
      subtitle="Set reusable default values for variables used across your templates."
      onClose={onClose}
      wide
    >
      <form className="form cross-variables-form" onSubmit={handleSave}>
        <div className="helper-box cross-variables-intro">
          <div>
            <strong>One value, reused everywhere</strong>
            <p>Save a default once and Adrafteo will prefill it whenever the same variable appears in a template. You can still adjust the value for a specific advert.</p>
          </div>
          <span className="cross-variables-count">{rows.length} {rows.length === 1 ? 'variable' : 'variables'}</span>
        </div>

        {rows.length > 0 ? (
          <div className="cross-variable-list">
            {rows.map((row, index) => (
              <div className="cross-variable-row" key={row.id ?? index}>
                <span className="cross-variable-row__number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <label>
                  <span>Variable name</span>
                  <input
                    value={row.variable_name}
                    onChange={(event) => updateRow(index, 'variable_name', event.target.value)}
                    placeholder="Ton secteur / Ta gare"
                  />
                  <small>Use the name inside square brackets in your templates.</small>
                </label>
                <label>
                  <span>Default value</span>
                  <textarea
                    value={row.default_value}
                    onChange={(event) => updateRow(index, 'default_value', event.target.value)}
                    placeholder="Paris"
                    rows={3}
                  />
                </label>
                <button
                  type="button"
                  className="button button--danger"
                  onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="cross-variable-empty">
            <strong>No cross variables yet</strong>
            <p>Add a reusable value for information such as your location, shipping method, or seller details.</p>
          </div>
        )}

        <button
          type="button"
          className="button button--ghost cross-variables-add"
          onClick={() => setRows((current) => [...current, { variable_name: '', default_value: '' }])}
        >
          + Add cross variable
        </button>

        <div className="form__actions">
          <button type="button" className="button button--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="button button--primary">Save cross variables</button>
        </div>
      </form>
    </Modal>
  )
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
    quantity: initialItem?.quantity ?? 1,
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
      quantity: Math.max(1, Number(form.quantity) || 1),
      item_type: form.item_type.trim() || null,
      condition: form.condition.trim() || null,
      platforms: form.platforms,
      purchase_date: form.purchase_date || null,
      purchase_price: Number(form.purchase_price) || 0,
      base_purchase_price: Number(initialItem?.base_purchase_price ?? form.purchase_price) || 0,
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
        quantity: 1,
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
    <form className="form inventory-entry-form" onSubmit={handleSubmit}>
      <div className="form-grid form-grid--wide">
        <label><span>Item name</span><input value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Example: Nike Air Max 90" required /></label>
        <label><span>Quantity</span><input type="number" min="1" step="1" value={form.quantity} onChange={(event) => updateField('quantity', event.target.value)} required /></label>
        <label><span>Status</span><select value={form.status} onChange={(event) => updateField('status', event.target.value)}><option value="in_transit">In transit</option><option value="in_stock">In stock</option><option value="to_list">To list</option><option value="listed">Listed</option><option value="sold">Sold</option></select></label>
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
    quantity: 1,
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
      <fieldset className="lot-common-fields"><legend>Common values for this lot</legend><p>Set values shared by the items, then apply them before saving. You can still edit each item afterwards.</p><div className="form-grid form-grid--wide"><label><span>Purchase date</span><input type="date" value={commonFields.purchase_date} onChange={(event) => setCommonFields((current) => ({ ...current, purchase_date: event.target.value }))} /></label><label><span>Status</span><select value={commonFields.status} onChange={(event) => setCommonFields((current) => ({ ...current, status: event.target.value }))}><option value="">Keep item values</option><option value="in_transit">In transit</option>      <option value="in_transit">In transit</option><option value="in_stock">In stock</option><option value="to_list">To list</option><option value="listed">Listed</option><option value="sold">Sold</option></select></label><label><span>Type</span><input value={commonFields.item_type} onChange={(event) => setCommonFields((current) => ({ ...current, item_type: event.target.value }))} placeholder="Clothing" /></label><label><span>Condition</span><input value={commonFields.condition} onChange={(event) => setCommonFields((current) => ({ ...current, condition: event.target.value }))} placeholder="Very good" /></label><label><span>Template</span><select value={commonFields.template_id} onChange={(event) => setCommonFields((current) => ({ ...current, template_id: event.target.value }))}><option value="">Keep item values</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label></div><fieldset className="platform-picker"><legend>Platforms</legend><div className="platform-options">{platformOptions.map((platform) => <label key={platform}><input type="checkbox" checked={commonFields.platforms.includes(platform)} onChange={() => toggleCommonPlatform(platform)} /><span>{platform}</span></label>)}</div></fieldset><button type="button" className="button button--ghost" onClick={applyCommonFields}>Apply to all items</button></fieldset>
      <fieldset className="lot-pricing-fields"><legend>Lot pricing</legend><div className="form-grid form-grid--wide"><label><span>Lot purchase date</span><input type="date" value={lotFields.purchase_date} onChange={(event) => setLotFields((current) => ({ ...current, purchase_date: event.target.value }))} /></label><label><span>Lot purchase price</span><input type="number" min="0" step="0.01" value={lotFields.purchase_price} onChange={(event) => setLotFields((current) => ({ ...current, purchase_price: event.target.value }))} required /></label><label><span>Lot target sale price</span><input type="number" min="0" step="0.01" value={lotFields.target_sale_price} onChange={(event) => setLotFields((current) => ({ ...current, target_sale_price: event.target.value }))} /></label><label><span>Lot sale date</span><input type="date" value={lotFields.sale_date} onChange={(event) => setLotFields((current) => ({ ...current, sale_date: event.target.value }))} /></label><label><span>Lot sale price</span><input type="number" min="0" step="0.01" value={lotFields.sale_price} onChange={(event) => setLotFields((current) => ({ ...current, sale_price: event.target.value }))} /></label><label><span>Lot selling fees</span><input type="number" min="0" step="0.01" value={lotFields.selling_fees} onChange={(event) => setLotFields((current) => ({ ...current, selling_fees: event.target.value }))} /></label></div></fieldset>
      <label><span>Lot template</span><select value={lotFields.template_id} onChange={(event) => setLotFields((current) => ({ ...current, template_id: event.target.value }))}><option value="">No template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
      <div className="lot-form-items">
        <div className="lot-form-items__header"><div><h3>Items in this lot</h3><p>Each item keeps its own prices, status and listing details.</p></div></div>
        {items.map((item, index) => <fieldset className="lot-item-form" key={index}><legend>Item {index + 1}</legend><div className="form-grid form-grid--wide"><label><span>Item name</span><input value={item.name} onChange={(event) => updateItem(index, 'name', event.target.value)} placeholder="Example: Denim jacket" required /></label><label><span>Status</span><select value={item.status} onChange={(event) => updateItem(index, 'status', event.target.value)}><option value="in_transit">In transit</option><option value="in_stock">In stock</option><option value="to_list">To list</option><option value="listed">Listed</option><option value="sold">Sold</option></select></label><label><span>Type</span><input list="lot-type-options" value={item.item_type} onChange={(event) => updateItem(index, 'item_type', event.target.value)} placeholder="Clothing" /></label><label><span>Condition</span><input value={item.condition} onChange={(event) => updateItem(index, 'condition', event.target.value)} placeholder="Very good" /></label><label><span>Purchase date</span><input type="date" value={item.purchase_date} onChange={(event) => updateItem(index, 'purchase_date', event.target.value)} /></label><label><span>Purchase price</span><input type="number" min="0" step="0.01" value={item.purchase_price} onChange={(event) => updateItem(index, 'purchase_price', event.target.value)} required /></label><label><span>Target sale price</span><input type="number" min="0" step="0.01" value={item.target_sale_price} onChange={(event) => updateItem(index, 'target_sale_price', event.target.value)} /></label><label><span>Sale date</span><input type="date" value={item.sale_date} onChange={(event) => updateItem(index, 'sale_date', event.target.value)} /></label><label><span>Sale price</span><input type="number" min="0" step="0.01" value={item.sale_price} onChange={(event) => updateItem(index, 'sale_price', event.target.value)} /></label><label><span>Selling fees</span><input type="number" min="0" step="0.01" value={item.selling_fees} onChange={(event) => updateItem(index, 'selling_fees', event.target.value)} /></label><label><span>Template</span><select value={item.template_id} onChange={(event) => updateItem(index, 'template_id', event.target.value)}><option value="">No template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label></div><fieldset className="platform-picker"><legend>Platforms</legend><div className="platform-options">{platformOptions.map((platform) => <label key={platform}><input type="checkbox" checked={item.platforms.includes(platform)} onChange={() => togglePlatform(index, platform)} /><span>{platform}</span></label>)}</div></fieldset><label><span>Item notes</span><textarea value={item.notes} onChange={(event) => updateItem(index, 'notes', event.target.value)} rows={2} /></label>{items.length > 1 ? <button type="button" className="button button--danger lot-item-form__remove" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove item</button> : null}</fieldset>)}
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
  const [commonFields, setCommonFields] = useState({ purchase_date: '', status: '', item_type: '', condition: '', template_id: '', platforms: [], quantity: 1 })
  const [lotFields, setLotFields] = useState({ status: 'in_stock', purchase_date: '', purchase_price: '', target_sale_price: '', sale_date: '', sale_price: '', selling_fees: 0, template_id: '' })
  const [items, setItems] = useState([createBlankLotItem()])
  const previousAllocation = useRef({ purchase: [], target: [] })

  useEffect(() => {
    const purchaseAllocation = allocateAmountByQuantities(lotFields.purchase_price, items.map((item) => item.quantity))
    const targetAllocation = allocateAmount(lotFields.target_sale_price, items.length)
    const canUpdate = (field, allocation) => {
      if (!allocation.length) {
        return false
      }

      const previous = previousAllocation.current[field]
      return items.every((item, index) => item[field === 'purchase' ? 'purchase_price' : 'target_sale_price'] === '' || Number(item[field === 'purchase' ? 'purchase_price' : 'target_sale_price']) === Number(previous[index]))
    }

    if (purchaseAllocation.length || canUpdate('target', targetAllocation)) {
      setItems((current) => current.map((item, index) => ({
        ...item,
        purchase_price: purchaseAllocation.length ? purchaseAllocation[index] : item.purchase_price,
        target_sale_price: canUpdate('target', targetAllocation) ? targetAllocation[index] : item.target_sale_price,
      })))
    }

    previousAllocation.current = { purchase: purchaseAllocation, target: targetAllocation }
  }, [lotFields.purchase_price, lotFields.target_sale_price, items.length, items.map((item) => item.quantity).join(',')])

  const updateItem = (index, field, value) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item))
  const togglePlatform = (index, platform) => updateItem(index, 'platforms', items[index].platforms.includes(platform) ? items[index].platforms.filter((value) => value !== platform) : [...items[index].platforms, platform])
  const toggleCommonPlatform = (platform) => setCommonFields((current) => ({ ...current, platforms: current.platforms.includes(platform) ? current.platforms.filter((value) => value !== platform) : [...current.platforms, platform] }))
  const applyCommonFields = () => {
    setLotFields((current) => ({
      ...current,
      purchase_date: commonFields.purchase_date || current.purchase_date,
      template_id: commonFields.template_id || current.template_id,
    }))
    setItems((current) => current.map((item) => ({ ...item, quantity: Math.max(1, Number(commonFields.quantity) || 1), purchase_date: commonFields.purchase_date || item.purchase_date, status: commonFields.status || item.status, item_type: commonFields.item_type || item.item_type, condition: commonFields.condition || item.condition, template_id: commonFields.template_id || item.template_id, platforms: commonFields.platforms.length ? commonFields.platforms : item.platforms })))
  }
  const addItem = () => setItems((current) => [...current, { ...createBlankLotItem(), quantity: Math.max(1, Number(commonFields.quantity) || 1), purchase_date: commonFields.purchase_date, status: commonFields.status || 'in_stock', item_type: commonFields.item_type, condition: commonFields.condition, template_id: commonFields.template_id, platforms: commonFields.platforms }])
  const handleSubmit = (event) => {
    event.preventDefault()
    onSave({
      name: name.trim(),
      notes: notes.trim() || null,
      lotFields: { ...lotFields, purchase_date: lotFields.purchase_date || null, purchase_price: Number(lotFields.purchase_price) || 0, target_sale_price: lotFields.target_sale_price === '' ? null : Number(lotFields.target_sale_price), sale_date: lotFields.sale_date || null, sale_price: lotFields.sale_price === '' ? null : Number(lotFields.sale_price), selling_fees: Number(lotFields.selling_fees) || 0 },
      items: items.map((item) => ({ ...item, name: item.name.trim(), quantity: Math.max(1, Number(item.quantity) || 1), item_type: item.item_type.trim() || null, condition: item.condition.trim() || null, purchase_date: item.purchase_date || null, purchase_price: Number(item.purchase_price) || 0, base_purchase_price: Number(item.purchase_price) || 0, target_sale_price: item.target_sale_price === '' ? null : Number(item.target_sale_price), sale_date: item.sale_date || null, sale_price: item.sale_price === '' ? null : Number(item.sale_price), selling_fees: Number(item.selling_fees) || 0, template_id: item.template_id || null, notes: item.notes.trim() || null })),
    })
  }

  return <form className="form lot-entry-form" onSubmit={handleSubmit}><label><span>Lot name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Example: Mega Construx lot" required /></label><label><span>Lot notes</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} /></label><fieldset className="lot-common-fields"><legend>Common values</legend><p>Apply these values to all sub-items before saving. Each item can be edited later.</p><div className="form-grid form-grid--wide"><label><span>Purchase date</span><input type="date" value={commonFields.purchase_date} onChange={(event) => setCommonFields((current) => ({ ...current, purchase_date: event.target.value }))} /></label><label><span>Status</span><select value={commonFields.status} onChange={(event) => setCommonFields((current) => ({ ...current, status: event.target.value }))}>  <option value="">Keep item values</option><option value="in_transit">In transit</option><option value="in_stock">In stock</option><option value="to_list">To list</option><option value="listed">Listed</option><option value="sold">Sold</option></select></label><label><span>Type</span><input value={commonFields.item_type} onChange={(event) => setCommonFields((current) => ({ ...current, item_type: event.target.value }))} placeholder="Clothing" /></label><label><span>Condition</span><input value={commonFields.condition} onChange={(event) => setCommonFields((current) => ({ ...current, condition: event.target.value }))} placeholder="Very good" /></label><label><span>Template</span><select value={commonFields.template_id} onChange={(event) => setCommonFields((current) => ({ ...current, template_id: event.target.value }))}><option value="">Keep item values</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label></div><fieldset className="platform-picker"><legend>Platforms</legend><div className="platform-options">{platformOptions.map((platform) => <label key={platform}><input type="checkbox" checked={commonFields.platforms.includes(platform)} onChange={() => toggleCommonPlatform(platform)} /><span>{platform}</span></label>)}</div></fieldset><button type="button" className="button button--ghost" onClick={applyCommonFields}>Apply to all items</button></fieldset>  <fieldset className="lot-pricing-fields"><legend>Lot details</legend><div className="form-grid form-grid--wide"><label><span>Lot status</span><select value={lotFields.status} onChange={(event) => setLotFields((current) => ({ ...current, status: event.target.value }))}><option value="in_transit">In transit</option><option value="in_stock">In stock</option><option value="to_list">To list</option><option value="listed">Listed</option><option value="sold">Sold</option></select></label><label><span>Purchase date</span><input type="date" value={lotFields.purchase_date} onChange={(event) => setLotFields((current) => ({ ...current, purchase_date: event.target.value }))} /></label><label><span>Purchase price</span><input type="number" min="0" step="0.01" value={lotFields.purchase_price} onChange={(event) => setLotFields((current) => ({ ...current, purchase_price: event.target.value }))} required /></label><label><span>Target sale price</span><input type="number" min="0" step="0.01" value={lotFields.target_sale_price} onChange={(event) => setLotFields((current) => ({ ...current, target_sale_price: event.target.value }))} /></label><label><span>Sale date</span><input type="date" value={lotFields.sale_date} onChange={(event) => setLotFields((current) => ({ ...current, sale_date: event.target.value }))} /></label><label><span>Sale price</span><input type="number" min="0" step="0.01" value={lotFields.sale_price} onChange={(event) => setLotFields((current) => ({ ...current, sale_price: event.target.value }))} /></label><label><span>Selling fees</span><input type="number" min="0" step="0.01" value={lotFields.selling_fees} onChange={(event) => setLotFields((current) => ({ ...current, selling_fees: event.target.value }))} /></label><label><span>Template</span><select value={lotFields.template_id} onChange={(event) => setLotFields((current) => ({ ...current, template_id: event.target.value }))}><option value="">No template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label></div></fieldset><div className="lot-form-items"><div className="lot-form-items__header"><div><h3>Items in this lot</h3><p>Minimise an item to keep the form compact.</p></div></div>{items.map((item, index) => <details className="lot-item-form" open key={index}><summary>Item {index + 1}: {item.name || 'Unnamed item'}</summary><div className="form-grid form-grid--wide">  <label><span>Item name</span><input value={item.name} onChange={(event) => updateItem(index, 'name', event.target.value)} required /></label><label><span>Quantity</span><input type="number" min="1" step="1" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} required /></label>  <label><span>Status</span><select value={item.status} onChange={(event) => updateItem(index, 'status', event.target.value)}><option value="in_transit">In transit</option><option value="in_stock">In stock</option><option value="to_list">To list</option><option value="listed">Listed</option><option value="sold">Sold</option></select></label><label><span>Type</span><input value={item.item_type} onChange={(event) => updateItem(index, 'item_type', event.target.value)} /></label><label><span>Condition</span><input value={item.condition} onChange={(event) => updateItem(index, 'condition', event.target.value)} /></label><label><span>Purchase date</span><input type="date" value={item.purchase_date} onChange={(event) => updateItem(index, 'purchase_date', event.target.value)} /></label><label><span>Purchase price</span><input type="number" min="0" step="0.01" value={item.purchase_price} onChange={(event) => updateItem(index, 'purchase_price', event.target.value)} required /></label><label><span>Target sale price</span><input type="number" min="0" step="0.01" value={item.target_sale_price} onChange={(event) => updateItem(index, 'target_sale_price', event.target.value)} /></label><label><span>Template</span><select value={item.template_id} onChange={(event) => updateItem(index, 'template_id', event.target.value)}><option value="">No template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label></div><fieldset className="platform-picker"><legend>Platforms</legend><div className="platform-options">{platformOptions.map((platform) => <label key={platform}><input type="checkbox" checked={item.platforms.includes(platform)} onChange={() => togglePlatform(index, platform)} /><span>{platform}</span></label>)}</div></fieldset><label><span>Item notes</span><textarea value={item.notes} onChange={(event) => updateItem(index, 'notes', event.target.value)} rows={2} /></label>{items.length > 1 ? <button type="button" className="button button--danger" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove item</button> : null}</details>)}<button type="button" className="button button--ghost lot-form-items__add" onClick={addItem}>+ Add sub-item</button></div><div className="form__actions"><button type="button" className="button button--ghost" onClick={onCancel}>Cancel</button><button type="submit" className="button button--primary">Create lot</button></div></form>
}

function LotSettingsForm({ lot, templates, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({
    name: lot.name ?? '',
    status: lot.status ?? 'in_stock',
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
      status: form.status,
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

  return <form className="form" onSubmit={handleSubmit}><label><span>Lot name</span><input value={form.name} onChange={(event) => updateField('name', event.target.value)} required /></label><label><span>Status</span><select value={form.status} onChange={(event) => updateField('status', event.target.value)}><option value="in_transit">In transit</option><option value="in_stock">In stock</option><option value="to_list">To list</option><option value="listed">Listed</option><option value="sold">Sold</option></select></label><label><span>Template</span><select value={form.template_id} onChange={(event) => updateField('template_id', event.target.value)}><option value="">No template</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><div className="form-grid form-grid--wide"><label><span>Purchase date</span><input type="date" value={form.purchase_date} onChange={(event) => updateField('purchase_date', event.target.value)} /></label><label><span>Purchase price</span><input type="number" min="0" step="0.01" value={form.purchase_price} onChange={(event) => updateField('purchase_price', event.target.value)} required /></label><label><span>Target sale price</span><input type="number" min="0" step="0.01" value={form.target_sale_price} onChange={(event) => updateField('target_sale_price', event.target.value)} /></label><label><span>Sale date</span><input type="date" value={form.sale_date} onChange={(event) => updateField('sale_date', event.target.value)} /></label><label><span>Sale price</span><input type="number" min="0" step="0.01" value={form.sale_price} onChange={(event) => updateField('sale_price', event.target.value)} /></label><label><span>Selling fees</span><input type="number" min="0" step="0.01" value={form.selling_fees} onChange={(event) => updateField('selling_fees', event.target.value)} /></label></div><label><span>Lot notes</span><textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} rows={4} /></label><div className="form__actions"><button type="button" className="button button--ghost" onClick={onCancel}>Cancel</button><button type="submit" className="button button--primary">Save lot</button></div></form>
}

function InventoryLotRow({ lot, items, templates, matches, onDelete, onDuplicateLot, onEdit, onDuplicate, onGenerateLot, onEditLot, onGenerate }) {
  const [isOpen, setIsOpen] = useState(false)
  const purchaseValue = items.reduce((total, item) => total + Number(item.purchase_price || 0), 0)
  const targetValue = items.reduce((total, item) => total + Number(item.target_sale_price || 0), 0)
  const linkedTemplate = templates.find((template) => template.id === lot.template_id)
  const metrics = getLotMetrics(items)

  return (
    <details className="inventory-tree__lot" open={isOpen} onToggle={(event) => setIsOpen(event.currentTarget.open)}>
      <summary className="inventory-tree__row inventory-tree__row--lot">
        <span className="inventory-tree__name"><strong>{lot.name}</strong><small>{metrics.itemCount} item{metrics.itemCount === 1 ? '' : 's'}</small></span>
        <span className="inventory-tree__lot-status"><span className={`status-badge status-badge--${lot.status}`}>{getStatusLabel(lot.status)}</span>{metrics.statuses.map(({ status, count }) => <span className={`status-badge status-badge--${status}`} key={status}>{getStatusLabel(status)}{count > 1 ? ` (${count})` : ''}</span>)}{items.some((item) => ['to_list', 'listed', 'sold'].includes(item.status)) ? <span className="status-badge status-badge--sold">{metrics.soldCount}/{metrics.itemCount} sold</span> : null}</span>
        <span>{formatMoney(lot.purchase_price ?? purchaseValue)} purchase</span>
        <span>{formatMoney(lot.target_sale_price ?? targetValue)} target</span>
        <span>{metrics.soldValue ? `${formatMoney(metrics.soldValue)} sold` : '—'}</span>
        <span className={metrics.roi !== null && metrics.roi < 0 ? 'value-negative' : 'value-positive'}>ROI {metrics.roi === null ? '—' : `${metrics.roi.toFixed(1)}%`}</span>
        <span className="table-actions"><button type="button" className="button button--primary" onClick={(event) => { event.preventDefault(); onGenerateLot(lot, items, linkedTemplate) }} disabled={!linkedTemplate}>Generate</button><button type="button" className="button button--ghost" onClick={(event) => { event.preventDefault(); onDuplicateLot(lot, items) }}>Duplicate</button><button type="button" className="button button--ghost" onClick={(event) => { event.preventDefault(); onEditLot(lot) }}>Edit</button><button type="button" className="button button--danger" onClick={(event) => { event.preventDefault(); onDelete(lot.id) }}>Delete</button></span>
      </summary>
      <div className="lot-section__body">
        {lot.notes ? <p className="lot-section__notes">{lot.notes}</p> : null}
        <div className="lot-items-list">
          {items.filter(matches).map((item) => {
            const roi = getItemRoi(item)
            const itemTemplate = templates.find((template) => template.id === item.template_id)
            return <article className="inventory-tree__row inventory-tree__row--item" key={item.id}>
            <span className="inventory-tree__name"><strong>{item.name}</strong><small>{item.item_type || 'Uncategorised'} · {item.condition || 'Condition not set'}</small></span>
            <span className={`status-badge status-badge--${item.status}`}>{item.status.replace('_', ' ')}</span>
            <span>{formatMoney(item.purchase_price)} purchase</span>
            <span>{item.target_sale_price === null ? '—' : formatMoney(item.target_sale_price)} target</span>
            <span>{item.sale_price === null ? '—' : formatMoney(item.sale_price)} sold</span>
            <span className={roi !== null && roi < 0 ? 'value-negative' : 'value-positive'}>ROI {roi === null ? '—' : `${roi.toFixed(1)}%`}</span>
            <span className="table-actions">{itemTemplate ? <button type="button" className="button button--primary" onClick={() => onGenerate(item, itemTemplate)}>Generate</button> : null}<button type="button" className="button button--ghost" onClick={() => onEdit(item)}>Edit</button><button type="button" className="button button--ghost" onClick={() => onDuplicate(item)}>Duplicate</button></span>
          </article>
          })}
        </div>
      </div>
    </details>
  )
}

function ShipmentForm({ items, lots, shipments, allocations, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: '',
    shipment_date: new Date().toISOString().slice(0, 10),
    store_to_forwarder: '',
    forwarder_to_home: '',
    extra_cost: '',
    monthly_subscription: '',
    vat_mode: 'none',
    vat_amount: '',
    vat_rate: '20',
    vat_base: '',
    include_vat_in_cost: true,
    allocation_method: 'value',
    notes: '',
  })
  const [selected, setSelected] = useState({})
  const [manualCosts, setManualCosts] = useState({})

  const selectedRows = items.filter((item) => selected[item.id] > 0)
  const productValue = selectedRows.reduce((total, item) => total + getItemUnitValue(item) * Number(selected[item.id]), 0)
  const selectedUnits = selectedRows.reduce((total, item) => total + Number(selected[item.id]), 0)
  const vatAmount = form.vat_mode === 'automatic'
    ? (Number(form.vat_base || productValue) * Number(form.vat_rate || 0)) / 100
    : Number(form.vat_amount || 0)
  const shipment = { ...form, vat_amount: vatAmount }
  const totalToAllocate = getShipmentTotal(shipment)
  const alreadyAllocated = new Set(allocations.map((allocation) => allocation.item_id))

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const toggleLot = (lotId) => {
    const lotItems = items.filter((item) => item.lot_id === lotId)
    const shouldSelect = lotItems.some((item) => !selected[item.id])
    setSelected((current) => lotItems.reduce((next, item) => ({ ...next, [item.id]: shouldSelect ? getItemQuantity(item) : 0 }), { ...current }))
  }
  const getAllocation = (item) => {
    const quantity = Number(selected[item.id] || 0)
    if (!quantity || !totalToAllocate) return 0
    if (form.allocation_method === 'manual') return Number(manualCosts[item.id] || 0)
    if (form.allocation_method === 'equal') return (totalToAllocate / selectedUnits) * quantity
    return (totalToAllocate * (getItemUnitValue(item) * quantity)) / productValue
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const preview = selectedRows.map((item) => ({ item_id: item.id, quantity: Number(selected[item.id]), allocated_cost: Number(getAllocation(item).toFixed(2)) }))
    if (form.allocation_method !== 'manual' && preview.length) {
      const allocatedBeforeRemainder = preview.slice(0, -1).reduce((total, row) => total + row.allocated_cost, 0)
      preview[preview.length - 1].allocated_cost = Number(Math.max(0, totalToAllocate - allocatedBeforeRemainder).toFixed(2))
    }
    const allocatedTotal = preview.reduce((total, row) => total + row.allocated_cost, 0)
    if (!form.name.trim() || !selectedRows.length) return
    if (form.allocation_method === 'manual' && Math.abs(allocatedTotal - totalToAllocate) > 0.01) {
      window.alert(`Manual allocations must total ${formatMoney(totalToAllocate)}.`)
      return
    }
    onSave({ ...form, name: form.name.trim(), vat_amount: vatAmount, allocations: preview })
  }

  return <form className="form shipment-form" onSubmit={handleSubmit}>
    <div className="form-grid form-grid--wide">
      <label><span>Shipment name</span><input value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="October shipment" required /></label>
      <label><span>Shipment date</span><input type="date" value={form.shipment_date} onChange={(event) => updateField('shipment_date', event.target.value)} required /></label>
      <label><span>Store to forwarder</span><input type="number" min="0" step="0.01" value={form.store_to_forwarder} onChange={(event) => updateField('store_to_forwarder', event.target.value)} /></label>
      <label><span>Forwarder to home</span><input type="number" min="0" step="0.01" value={form.forwarder_to_home} onChange={(event) => updateField('forwarder_to_home', event.target.value)} /></label>
      <label><span>Monthly subscription</span><input type="number" min="0" step="0.01" value={form.monthly_subscription} onChange={(event) => updateField('monthly_subscription', event.target.value)} /></label>
      <label><span>Additional fees</span><input type="number" min="0" step="0.01" value={form.extra_cost} onChange={(event) => updateField('extra_cost', event.target.value)} /></label>
    </div>
    <fieldset className="shipment-fieldset"><legend>VAT</legend><div className="form-grid form-grid--wide"><label><span>VAT mode</span><select value={form.vat_mode} onChange={(event) => updateField('vat_mode', event.target.value)}><option value="none">Not applicable</option><option value="manual">Enter total manually</option><option value="automatic">Calculate from rate</option></select></label>{form.vat_mode === 'manual' ? <label><span>Total VAT</span><input type="number" min="0" step="0.01" value={form.vat_amount} onChange={(event) => updateField('vat_amount', event.target.value)} /></label> : null}{form.vat_mode === 'automatic' ? <><label><span>Taxable base</span><input type="number" min="0" step="0.01" placeholder={productValue.toFixed(2)} value={form.vat_base} onChange={(event) => updateField('vat_base', event.target.value)} /></label><label><span>VAT rate (%)</span><input type="number" min="0" step="0.01" value={form.vat_rate} onChange={(event) => updateField('vat_rate', event.target.value)} /></label></> : null}<label className="checkbox-label"><input type="checkbox" checked={form.include_vat_in_cost} onChange={(event) => updateField('include_vat_in_cost', event.target.checked)} /><span>Include VAT in item cost</span></label></div><p className="helper-text">Calculated VAT: {formatMoney(vatAmount)}</p></fieldset>
    <fieldset className="shipment-fieldset"><legend>Allocation</legend><label><span>Allocation method</span><select value={form.allocation_method} onChange={(event) => updateField('allocation_method', event.target.value)}><option value="value">Proportional to value</option><option value="equal">Equal per physical unit</option><option value="manual">Manual amounts</option></select></label><p className="helper-text">Only selected physical units receive these costs. Items already assigned to a shipment are marked below.</p><div className="shipment-selection">{lots.map((lot) => { const lotItems = items.filter((item) => item.lot_id === lot.id); return <div className="shipment-group" key={lot.id}><button type="button" className="button button--ghost" onClick={() => toggleLot(lot.id)}>Toggle {lot.name}</button>{lotItems.map((item) => <ShipmentItemRow key={item.id} item={item} selected={selected[item.id] || 0} alreadyAllocated={alreadyAllocated.has(item.id)} allocation={getAllocation(item)} manualCost={manualCosts[item.id] || ''} onQuantity={(value) => setSelected((current) => ({ ...current, [item.id]: Math.min(getItemQuantity(item), Math.max(0, Number(value) || 0)) }))} onManualCost={(value) => setManualCosts((current) => ({ ...current, [item.id]: value }))} />)}</div> })}{items.filter((item) => !item.lot_id).map((item) => <ShipmentItemRow key={item.id} item={item} selected={selected[item.id] || 0} alreadyAllocated={alreadyAllocated.has(item.id)} allocation={getAllocation(item)} manualCost={manualCosts[item.id] || ''} onQuantity={(value) => setSelected((current) => ({ ...current, [item.id]: Math.min(getItemQuantity(item), Math.max(0, Number(value) || 0)) }))} onManualCost={(value) => setManualCosts((current) => ({ ...current, [item.id]: value }))} />)}</div></fieldset>
    <div className="shipment-summary"><strong>{selectedUnits} physical units selected</strong><strong>{formatMoney(totalToAllocate)} to allocate</strong><span>Product value: {formatMoney(productValue)}</span></div>
    <label><span>Notes</span><textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} rows={3} /></label>
    <div className="form__actions"><button type="button" className="button button--ghost" onClick={onCancel}>Cancel</button><button type="submit" className="button button--primary">Apply shipment costs</button></div>
  </form>
}

function ShipmentItemRow({ item, selected, alreadyAllocated, allocation, manualCost, onQuantity, onManualCost }) {
  return <div className="shipment-item-row"><div><strong>{item.name}</strong><small>{getItemQuantity(item)} units · {formatMoney(getItemUnitValue(item))} per unit {alreadyAllocated ? '· Already in a shipment' : ''}</small></div><input type="number" min="0" max={getItemQuantity(item)} step="1" value={selected} onChange={(event) => onQuantity(event.target.value)} aria-label={`Quantity of ${item.name}`} />{alreadyAllocated ? <span className="inventory-pill">Already assigned</span> : null}<span>{manualCost !== '' ? formatMoney(manualCost) : formatMoney(allocation)}</span>{allocation !== 0 ? <input className="shipment-manual-cost" type="number" min="0" step="0.01" value={manualCost} onChange={(event) => onManualCost(event.target.value)} placeholder="Manual cost" aria-label={`Allocated cost for ${item.name}`} /> : null}</div>
}

function ComparisonBarChart({ invested, recovered, potential }) {
  const futureRevenue = recovered + potential
  const maximum = Math.max(invested, futureRevenue, 1)
  const recoveredWidth = (recovered / maximum) * 100
  const potentialWidth = (potential / maximum) * 100
  return (
    <div className="comparison-chart" role="img" aria-label={`Money spent ${formatMoney(invested)}, realised revenue ${formatMoney(recovered)}, and potential resale value ${formatMoney(potential)}`}>
      <div className="comparison-chart__row">
        <div className="comparison-chart__label"><span>Money spent</span><strong>{formatMoney(invested)}</strong></div>
        <div className="comparison-chart__track"><i className="comparison-chart__segment comparison-chart__segment--spent" style={{ width: `${(invested / maximum) * 100}%` }} /></div>
      </div>
      <div className="comparison-chart__row">
        <div className="comparison-chart__label">
          <span>Revenue realised + resale potential</span>
          <strong>{formatMoney(futureRevenue)}</strong>
        </div>
        <div className="comparison-chart__track comparison-chart__track--stacked">
          <i className="comparison-chart__segment comparison-chart__segment--recovered" style={{ width: `${recoveredWidth}%` }} />
          <i className="comparison-chart__segment comparison-chart__segment--potential" style={{ width: `${potentialWidth}%` }} />
        </div>
        <div className="comparison-chart__legend">
          <span><i className="comparison-chart__legend-swatch comparison-chart__legend-swatch--recovered" />Realised {formatMoney(recovered)}</span>
          <span><i className="comparison-chart__legend-swatch comparison-chart__legend-swatch--potential" />Potential {formatMoney(potential)}</span>
        </div>
      </div>
    </div>
  )
}

function OverviewPage({ items, templates, onOpenTemplates, onOpenInventory }) {
  const soldItems = items.filter((item) => item.status === 'sold')
  const stockItems = items.filter((item) => item.status !== 'sold' && item.status !== 'in_transit')
  const investedValue = items.reduce((total, item) => total + Number(item.purchase_price || 0), 0)
  const stockValue = stockItems.reduce((total, item) => total + Number(item.target_sale_price || 0), 0)
  const realisedSales = soldItems.reduce((total, item) => total + Number(item.sale_price || 0), 0)
  const realisedProfit = soldItems.reduce((total, item) => total + (getItemProfit(item) || 0), 0)
  const soldCost = soldItems.reduce((total, item) => total + Number(item.purchase_price || 0), 0)
  const roi = soldCost > 0 ? (realisedProfit / soldCost) * 100 : null
  const platforms = Array.from(new Set(items.flatMap((item) => getItemPlatforms(item))))
  const platformStats = platforms.map((platform) => {
      const platformItems = items.filter((item) => getItemPlatforms(item).includes(platform))
      const platformSold = platformItems.filter((item) => item.status === 'sold')
      return {
        platform,
        count: platformItems.length,
        sold: platformSold.length,
        sales: platformSold.reduce((total, item) => total + Number(item.sale_price || 0), 0),
      }
    })
  const statusStats = [
    { label: 'In stock', status: 'in_stock', color: '#6a994e' },
    { label: 'To list', status: 'to_list', color: '#ffcb47' },
    { label: 'Listed', status: 'listed', color: '#333745' },
    { label: 'In transit', status: 'in_transit', color: '#9b6b9e' },
    { label: 'Sold', status: 'sold', color: '#b0413e' },
  ].map((entry) => ({ ...entry, value: items.filter((item) => item.status === entry.status).length }))
  const statusMax = Math.max(...statusStats.map((entry) => entry.value), 1)
  const recentItems = [...items]
    .filter((item) => item.status === 'sold')
    .sort((a, b) => new Date(b.sale_date || b.updated_at || b.created_at).getTime() - new Date(a.sale_date || a.updated_at || a.created_at).getTime())
    .slice(0, 5)

  return (
    <section className="overview-page">
      <div className="overview-heading">
        <div>
          <p className="eyebrow">Workspace overview</p>
          <h2>Seller performance and inventory overview</h2>
          <p>One clear view of your stock, templates, and realised sales.</p>
        </div>
        <div className="overview-actions">
          <button type="button" className="button button--ghost" onClick={onOpenTemplates}>Manage templates</button>
          <button type="button" className="button button--primary" onClick={onOpenInventory}>Open inventory</button>
        </div>
      </div>

      <div className="overview-metrics" aria-label="Workspace metrics">
        <div><span>Templates</span><strong>{templates.length}</strong><small>Reusable blueprints</small></div>
        <div><span>Items in stock</span><strong>{stockItems.length}</strong><small>{items.length} recorded overall</small></div>
        <div><span>Stock potential</span><strong>{formatMoney(stockValue)}</strong><small>Target sale value</small></div>
        <div><span>Realised sales</span><strong>{formatMoney(realisedSales)}</strong><small>{soldItems.length} sold items</small></div>
        <div><span>Realised ROI</span><strong>{roi === null ? '—' : `${roi.toFixed(1)}%`}</strong><small>{formatMoney(realisedProfit)} profit</small></div>
      </div>

      <div className="overview-columns">
        <section className="overview-section">
          <div className="overview-section__heading"><div><p className="eyebrow">Sales channels</p><h3>Marketplace performance</h3></div><span>{formatMoney(realisedSales)} total sales</span></div>
          {platformStats.length > 0 ? (
            <div className="platform-performance">
              {platformStats.map((entry) => (
                <div className="platform-performance__row" key={entry.platform}>
                  <strong>{entry.platform}</strong>
                  <span>{entry.count} items · {entry.sold} sold</span>
                  <b>{formatMoney(entry.sales)}</b>
                </div>
              ))}
            </div>
          ) : <p className="overview-empty">Add platforms to inventory items to see channel performance.</p>}
        </section>

        <section className="overview-section overview-section--workflow">
          <div className="overview-section__heading"><div><p className="eyebrow">Listing workflow</p><h3>Keep the next action visible</h3></div></div>
          <div className="workflow-list">
            <button type="button" onClick={onOpenTemplates}><span><b>{templates.length}</b> templates ready to reuse</span><strong>Templates →</strong></button>
            <button type="button" onClick={onOpenInventory}><span><b>{items.filter((item) => item.status === 'to_list').length}</b> items waiting to list</span><strong>Inventory →</strong></button>
            <div><span><b>{formatMoney(investedValue)}</b> invested in recorded stock</span><small>Based on purchase prices</small></div>
          </div>
        </section>
      </div>

      <div className="overview-charts">
        <section className="overview-section chart-section">
          <div className="overview-section__heading"><div><p className="eyebrow">Cash flow</p><h3>Money spent vs recovered</h3></div></div>
          <ComparisonBarChart invested={investedValue} recovered={realisedSales} potential={stockValue} />
        </section>

        <section className="overview-section chart-section">
          <div className="overview-section__heading"><div><p className="eyebrow">Stock flow</p><h3>Inventory by status</h3></div><span>{items.length} items</span></div>
          <div className="status-chart">{statusStats.map((entry) => <div className="status-chart__row" key={entry.status}><span>{entry.label}</span><div className="status-chart__track"><i style={{ width: `${(entry.value / statusMax) * 100}%`, background: entry.color }} /></div><strong>{entry.value}</strong></div>)}</div>
        </section>
      </div>

      <section className="overview-section overview-section--activity">
        <div className="overview-section__heading"><div><p className="eyebrow">Recent activity</p><h3>Latest completed sales</h3></div><button type="button" className="button button--ghost" onClick={onOpenInventory}>View inventory</button></div>
        {recentItems.length > 0 ? (
          <div className="activity-table">
            <div className="activity-table__header"><span>Item</span><span>Sale date</span><span>Sale price</span><span>Profit</span><span>ROI</span></div>
            {recentItems.map((item) => <div className="activity-table__row" key={item.id}><strong>{item.name}</strong><span>{item.sale_date || 'Date not set'}</span><span>{formatMoney(item.sale_price)}</span><b className={(getItemProfit(item) || 0) < 0 ? 'value-negative' : 'value-positive'}>{formatMoney(getItemProfit(item))}</b><span>{getItemRoi(item) === null ? '—' : `${getItemRoi(item).toFixed(1)}%`}</span></div>)}
          </div>
        ) : <p className="overview-empty">Completed sales will appear here once an inventory item is marked as sold.</p>}
      </section>
    </section>
  )
}

function InventoryPage({ items, lots, templates, shipments, allocations, dateFormat, onCreate, onCreateLot, onCreateShipment, onEdit, onEditLot, onDelete, onDuplicate, onDuplicateLot, onDeleteLot, onDeleteShipment, onGenerate, onGenerateLot }) {
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('purchase_date')
  const [sortDirection, setSortDirection] = useState('desc')
  const totalPurchase = items.reduce((total, item) => total + Number(item.purchase_price || 0), 0)
  const stockItems = items.filter((item) => item.status !== 'sold' && item.status !== 'in_transit')
  const targetValue = stockItems.reduce((total, item) => total + Number(item.target_sale_price || 0), 0)
  const soldItems = items.filter((item) => item.status === 'sold')
  const realisedSales = soldItems.reduce((total, item) => total + Number(item.sale_price || 0), 0)
  const realisedProfit = soldItems.reduce((total, item) => total + (getItemProfit(item) || 0), 0)
  const soldPurchaseValue = soldItems.reduce((total, item) => total + Number(item.purchase_price || 0), 0)
  const realisedRoi = soldPurchaseValue > 0 ? (realisedProfit / soldPurchaseValue) * 100 : null
  const matchesItem = (item) => {
    const matchesFilter = filter === 'all' || item.status === filter
    const matchesQuery = !query.trim() || `${item.name} ${item.item_type ?? ''} ${getItemPlatforms(item).join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())
    return matchesFilter && matchesQuery
  }
  const standaloneItems = items.filter((item) => !item.lot_id && matchesItem(item))
  const visibleLots = lots.map((lot) => {
    const lotItems = items.filter((item) => item.lot_id === lot.id)
    const matchesLot = filter === 'all' || lotItems.some((item) => item.status === filter)
    const matchesSearch = !query.trim() || `${lot.name} ${lot.notes ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()) || lotItems.some((item) => matchesItem(item))
    return { lot, items: lotItems, visible: matchesLot && matchesSearch }
  }).filter(({ visible }) => visible)
  const visibleCount = standaloneItems.length + visibleLots.length
  const getLotPurchaseValue = (lot, lotItems) => lot.purchase_price ?? lotItems.reduce((total, item) => total + Number(item.purchase_price || 0), 0)
  const getLotPurchaseDate = (lot, lotItems) => lot.purchase_date ?? lotItems.map((item) => item.purchase_date).filter(Boolean).sort()[0] ?? ''
  const compareEntries = (first, second) => {
    let firstValue
    let secondValue

    if (sortBy === 'name') {
      firstValue = first.name.toLowerCase()
      secondValue = second.name.toLowerCase()
    } else if (sortBy === 'purchase_price') {
      firstValue = first.purchaseValue
      secondValue = second.purchaseValue
    } else {
      firstValue = first.purchaseDate
      secondValue = second.purchaseDate
    }

    if (firstValue === secondValue) {
      return first.name.localeCompare(second.name)
    }

    if (sortBy === 'purchase_date' && (!firstValue || !secondValue)) {
      return !firstValue ? 1 : -1
    }

    const comparison = firstValue < secondValue ? -1 : 1
    return sortDirection === 'asc' ? comparison : -comparison
  }
  const sortedEntries = [
    ...visibleLots.map(({ lot, items: lotItems }) => ({
      type: 'lot',
      key: lot.id,
      name: lot.name,
      purchaseDate: getLotPurchaseDate(lot, lotItems),
      purchaseValue: getLotPurchaseValue(lot, lotItems),
      lot,
      items: lotItems,
    })),
    ...standaloneItems.map((item) => ({
      type: 'item',
      key: item.id,
      name: item.name,
      purchaseDate: item.purchase_date ?? '',
      purchaseValue: Number(item.purchase_price || 0),
      item,
    })),
  ].sort(compareEntries)
  const sortDirectionLabel = sortBy === 'purchase_date'
    ? (sortDirection === 'asc' ? 'Oldest first' : 'Newest first')
    : sortBy === 'purchase_price'
      ? (sortDirection === 'asc' ? 'Lowest first' : 'Highest first')
      : (sortDirection === 'asc' ? 'A-Z' : 'Z-A')
  return (
    <section className="inventory-page">
      <div className="page-heading"><div><p className="eyebrow">Inventory</p><h2>Know what you own. Know what it earns.</h2><p className="topbar__subtitle">Track every item from purchase to sale, with your listing workflow close at hand.</p></div><div className="page-heading__actions"><button type="button" className="button button--ghost button--large" onClick={onCreateShipment}>+ Add shipment</button><button type="button" className="button button--ghost button--large" onClick={onCreateLot}>+ Add lot</button><button type="button" className="button button--primary button--large" onClick={onCreate}>+ Add item</button></div></div>
      <section className="stats-row stats-row--inventory">
        <div className="stat-card"><span>Items</span><strong>{items.length}</strong><small>{stockItems.length} in stock</small></div>
        <div className="stat-card"><span>Purchase value</span><strong>{formatMoney(totalPurchase)}</strong><small>All recorded items</small></div>
        <div className="stat-card"><span>Target sale value</span><strong>{formatMoney(targetValue)}</strong><small>Current stock only</small></div>
        <div className="stat-card"><span>Realised sales</span><strong>{formatMoney(realisedSales)}</strong><small>{soldItems.length} sold</small></div>
        <div className="stat-card"><span>Realised ROI</span><strong>{realisedRoi === null ? '—' : `${realisedRoi.toFixed(1)}%`}</strong><small>{formatMoney(realisedProfit)} profit</small></div>
      </section>
      <section className="inventory-toolbar"><div className="inventory-filters" role="group" aria-label="Filter inventory"><button type="button" className={`filter-button ${filter === 'all' ? 'filter-button--active' : ''}`} onClick={() => setFilter('all')}>All <span>{items.length}</span></button><button type="button" className={`filter-button ${filter === 'in_transit' ? 'filter-button--active' : ''}`} onClick={() => setFilter('in_transit')}>In transit</button><button type="button" className={`filter-button ${filter === 'in_stock' ? 'filter-button--active' : ''}`} onClick={() => setFilter('in_stock')}>In stock</button><button type="button" className={`filter-button ${filter === 'to_list' ? 'filter-button--active' : ''}`} onClick={() => setFilter('to_list')}>To list</button><button type="button" className={`filter-button ${filter === 'listed' ? 'filter-button--active' : ''}`} onClick={() => setFilter('listed')}>Listed</button><button type="button" className={`filter-button ${filter === 'sold' ? 'filter-button--active' : ''}`} onClick={() => setFilter('sold')}>Sold</button></div><div className="inventory-toolbar__controls"><label><span>Sort by</span><select value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="purchase_date">Purchase date</option><option value="purchase_price">Purchase price</option><option value="name">Name</option></select></label><button type="button" className="filter-button" onClick={() => setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')} aria-label={`Sort ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}>{sortDirectionLabel}</button><input className="inventory-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search inventory..." aria-label="Search inventory" /></div></section>
      {shipments.length > 0 ? <section className="shipment-history"><div className="section-label"><span>Shipments</span><small>{shipments.length} recorded</small></div>{shipments.map((shipment) => <article className="shipment-history__row" key={shipment.id}><div><strong>{shipment.name}</strong><small>{formatDate(shipment.shipment_date, dateFormat)} · {allocations.filter((allocation) => allocation.shipment_id === shipment.id).length} item lines</small></div><span>{formatMoney(getShipmentTotal(shipment))} allocated</span><button type="button" className="button button--danger" onClick={() => onDeleteShipment(shipment.id)}>Delete</button></article>)}</section> : null}
      {visibleCount > 0 ? <section className="inventory-tree">{sortedEntries.map((entry) => entry.type === 'lot' ? (() => { const lotNameMatches = query.trim() && entry.lot.name.toLowerCase().includes(query.trim().toLowerCase()); return <InventoryLotRow key={entry.key} lot={entry.lot} items={entry.items} matches={(item) => lotNameMatches ? (filter === 'all' || item.status === filter) : matchesItem(item)}       templates={templates} onDelete={onDeleteLot} onDuplicateLot={onDuplicateLot} onEdit={onEdit} onEditLot={onEditLot} onDuplicate={onDuplicate} onGenerate={onGenerate} onGenerateLot={onGenerateLot} /> })() : (() => { const item = entry.item; const roi = getItemRoi(item); const linkedTemplate = templates.find((template) => template.id === item.template_id); return <article className="inventory-tree__row inventory-tree__row--standalone" key={entry.key}><span className="inventory-tree__name"><strong>{item.name}</strong><small>{item.item_type || 'Uncategorised'} · {item.condition || 'Condition not set'}</small></span><span className={`status-badge status-badge--${item.status}`}>{item.status.replace('_', ' ')}</span><span>{formatMoney(item.purchase_price)} purchase</span><span>{item.target_sale_price === null ? '—' : formatMoney(item.target_sale_price)} target</span><span>{item.sale_price === null ? '—' : formatMoney(item.sale_price)} sold</span><span className={roi !== null && roi < 0 ? 'value-negative' : 'value-positive'}>ROI {roi === null ? '—' : `${roi.toFixed(1)}%`}</span><span className="table-actions">{linkedTemplate ? <button type="button" className="button button--primary" onClick={() => onGenerate(item, linkedTemplate)}>Generate</button> : null}<button type="button" className="button button--ghost" onClick={() => onEdit(item)}>Edit</button><button type="button" className="button button--ghost" onClick={() => onDuplicate(item)}>Duplicate</button><button type="button" className="button button--danger" onClick={() => onDelete(item.id)}>Delete</button></span></article> })())}</section> : <section className="empty-state"><h2>{items.length === 0 ? 'Your inventory is empty' : 'No items match your view'}</h2><p>{items.length === 0 ? 'Add your first item to start tracking stock and profitability.' : 'Try another filter or search term.'}</p>{items.length === 0 ? <button type="button" className="button button--primary" onClick={onCreate}>Add your first item</button> : null}</section>}
    </section>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [templates, setTemplates] = useState([])
  const [crossVariables, setCrossVariables] = useState([])
  const [inventoryItems, setInventoryItems] = useState([])
  const [inventoryLots, setInventoryLots] = useState([])
  const [inventoryShipments, setInventoryShipments] = useState([])
  const [shipmentAllocations, setShipmentAllocations] = useState([])
  const [activeView, setActiveView] = useState('overview')
  const [showLanding, setShowLanding] = useState(false)
  const [templateQuery, setTemplateQuery] = useState('')
  const [editorTemplate, setEditorTemplate] = useState(null)
  const [generatorTemplate, setGeneratorTemplate] = useState(null)
  const [inventoryEditor, setInventoryEditor] = useState(null)
  const [lotEditor, setLotEditor] = useState(null)
  const [shipmentEditor, setShipmentEditor] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [activeLegalPage, setActiveLegalPage] = useState(null)
  const [showFaqPage, setShowFaqPage] = useState(false)
  const [showPricingPage, setShowPricingPage] = useState(false)
  const [showAccountPage, setShowAccountPage] = useState(false)
  const [showCrossVariables, setShowCrossVariables] = useState(false)
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY')
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
      setDateFormat('DD/MM/YYYY')
      setTemplates([])
      setCrossVariables([])
      setInventoryItems([])
      setInventoryLots([])
      setInventoryShipments([])
      setShipmentAllocations([])
      return
    }

    const savedDateFormat = window.localStorage.getItem(`adrafteo.dateFormat.${session.user.id}`)
    if (savedDateFormat && ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].includes(savedDateFormat)) {
      setDateFormat(savedDateFormat)
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

    const loadShipments = async () => {
      const { data, error: loadError } = await supabase.from('inventory_shipments').select('*').order('shipment_date', { ascending: false })
      if (loadError) {
        setError(loadError.message)
        return
      }
      setInventoryShipments(data ?? [])
    }

    const loadShipmentAllocations = async () => {
      const { data, error: loadError } = await supabase.from('inventory_shipment_allocations').select('*')
      if (loadError) {
        setError(loadError.message)
        return
      }
      setShipmentAllocations(data ?? [])
    }

    loadShipments()
    loadShipmentAllocations()
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

  const handleDuplicateInventoryLot = async (lot, items) => {
    const { id, created_at, updated_at, user_id, ...lotCopy } = lot
    const { data: duplicatedLot, error: lotError } = await supabase
      .from('inventory_lots')
      .insert({ ...lotCopy, name: `${lot.name} (copy)`, user_id: session.user.id })
      .select()
      .single()

    if (lotError) {
      setError(lotError.message)
      return
    }

    const duplicatedItems = items.map(({ id: itemId, created_at: itemCreatedAt, updated_at: itemUpdatedAt, user_id: itemUserId, lot_id, ...item }) => ({
      ...item,
      lot_id: duplicatedLot.id,
      user_id: session.user.id,
    }))
    const { data: savedItems, error: itemsError } = await supabase.from('inventory_items').insert(duplicatedItems).select()

    if (itemsError) {
      await supabase.from('inventory_lots').delete().eq('id', duplicatedLot.id)
      setError(itemsError.message)
      return
    }

    setInventoryLots((current) => [duplicatedLot, ...current])
    setInventoryItems((current) => [...savedItems, ...current])
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

  const handleSaveShipment = async (draft) => {
    if (!session?.user || !draft.name || !draft.allocations?.length) {
      return
    }

    const duplicateItems = draft.allocations.filter((allocation) => shipmentAllocations.some((existing) => existing.item_id === allocation.item_id))
    if (duplicateItems.length && !window.confirm('Some selected items are already assigned to a shipment. Add these costs again?')) {
      return
    }

    const { allocations: draftAllocations, ...shipmentDraft } = draft
    const { data: shipment, error: shipmentError } = await supabase
      .from('inventory_shipments')
      .insert({ ...shipmentDraft, user_id: session.user.id })
      .select()
      .single()

    if (shipmentError) {
      setError(shipmentError.message)
      return
    }

    const rows = draftAllocations.map((allocation) => ({ ...allocation, shipment_id: shipment.id }))
    const { error: allocationError } = await supabase.from('inventory_shipment_allocations').insert(rows)
    if (allocationError) {
      await supabase.from('inventory_shipments').delete().eq('id', shipment.id)
      setError(allocationError.message)
      return
    }

    const updatedItems = []
    for (const item of inventoryItems) {
      const newAllocation = draftAllocations.find((allocation) => allocation.item_id === item.id)
      if (!newAllocation) continue
      const existingCost = Number(item.inbound_cost || 0)
      const inboundCost = existingCost + Number(newAllocation.allocated_cost || 0)
      const basePurchasePrice = getItemBasePurchasePrice(item)
      const purchasePrice = Number((basePurchasePrice + inboundCost).toFixed(2))
      const { data, error: itemError } = await supabase.from('inventory_items').update({ inbound_cost: inboundCost, purchase_price: purchasePrice }).eq('id', item.id).select().single()
      if (itemError) {
        setError(itemError.message)
        return
      }
      updatedItems.push(data)
    }

    const affectedLotIds = [...new Set(updatedItems.map((item) => item.lot_id).filter(Boolean))]
    const updatedLots = []
    for (const lotId of affectedLotIds) {
      const lotItems = inventoryItems.map((item) => updatedItems.find((updated) => updated.id === item.id) ?? item).filter((item) => item.lot_id === lotId)
      const purchasePrice = Number(lotItems.reduce((total, item) => total + Number(item.purchase_price || 0), 0).toFixed(2))
      const { data, error: lotError } = await supabase.from('inventory_lots').update({ purchase_price: purchasePrice }).eq('id', lotId).select().single()
      if (lotError) {
        setError(lotError.message)
        return
      }
      updatedLots.push(data)
    }

    setInventoryItems((current) => current.map((item) => updatedItems.find((updated) => updated.id === item.id) ?? item))
    setInventoryLots((current) => current.map((lot) => updatedLots.find((updated) => updated.id === lot.id) ?? lot))
    setInventoryShipments((current) => [shipment, ...current])
    setShipmentAllocations((current) => [...rows, ...current])
    setShipmentEditor(null)
  }

  const handleDeleteShipment = async (shipmentId) => {
    const shipment = inventoryShipments.find((entry) => entry.id === shipmentId)
    if (!shipment || !window.confirm(`Delete "${shipment.name}" and remove its allocated costs?`)) {
      return
    }

    const shipmentRows = shipmentAllocations.filter((allocation) => allocation.shipment_id === shipmentId)
    const { error: deleteError } = await supabase.from('inventory_shipments').delete().eq('id', shipmentId)
    if (deleteError) {
      setError(deleteError.message)
      return
    }

    const updatedItems = []
    for (const item of inventoryItems) {
      const removedCost = shipmentRows.filter((row) => row.item_id === item.id).reduce((total, row) => total + Number(row.allocated_cost || 0), 0)
      if (!removedCost) continue
      const inboundCost = Math.max(0, Number((Number(item.inbound_cost || 0) - removedCost).toFixed(2)))
      const purchasePrice = Number((getItemBasePurchasePrice(item) + inboundCost).toFixed(2))
      const { data, error: itemError } = await supabase.from('inventory_items').update({ inbound_cost: inboundCost, purchase_price: purchasePrice }).eq('id', item.id).select().single()
      if (itemError) {
        setError(itemError.message)
        return
      }
      updatedItems.push(data)
    }

    setInventoryItems((current) => current.map((item) => updatedItems.find((updated) => updated.id === item.id) ?? item))
    const affectedLotIds = [...new Set(updatedItems.map((item) => item.lot_id).filter(Boolean))]
    const recalculatedLotPrices = {}
    for (const lotId of affectedLotIds) {
      const lotItems = inventoryItems.map((item) => updatedItems.find((updated) => updated.id === item.id) ?? item).filter((item) => item.lot_id === lotId)
      const purchasePrice = Number(lotItems.reduce((total, item) => total + Number(item.purchase_price || 0), 0).toFixed(2))
      recalculatedLotPrices[lotId] = purchasePrice
      const { error: lotError } = await supabase.from('inventory_lots').update({ purchase_price: purchasePrice }).eq('id', lotId)
      if (lotError) {
        setError(lotError.message)
        return
      }
    }
    setInventoryLots((current) => current.map((lot) => recalculatedLotPrices[lot.id] === undefined ? lot : { ...lot, purchase_price: recalculatedLotPrices[lot.id] }))
    setInventoryShipments((current) => current.filter((entry) => entry.id !== shipmentId))
    setShipmentAllocations((current) => current.filter((allocation) => allocation.shipment_id !== shipmentId))
  }

  if (isLoading) {
    return <main className="auth-shell"><p>Loading your workspace...</p></main>
  }

  if (activeLegalPage) {
    return (
      <LegalPage
        page={activeLegalPage}
        onBack={() => setActiveLegalPage(null)}
        onHome={() => setActiveLegalPage(null)}
        onOpenLegalPage={setActiveLegalPage}
        onOpenPricing={() => { setActiveLegalPage(null); setShowFaqPage(false); setShowPricingPage(true) }}
      />
    )
  }

  if (showFaqPage) {
    return <FaqPage onBack={() => setShowFaqPage(false)} onOpenLegalPage={setActiveLegalPage} onOpenPricing={() => { setActiveLegalPage(null); setShowFaqPage(false); setShowPricingPage(true) }} />
  }

  if (showPricingPage) {
    return (
      <PricingPage
        onBack={() => setShowPricingPage(false)}
        onOpenLegalPage={setActiveLegalPage}
        onOpenPricing={() => { setActiveLegalPage(null); setShowFaqPage(false); setShowPricingPage(true) }}
      />
    )
  }

  if (showAccountPage && session) {
    return (
      <AccountPanel
        session={session}
        fullPage
        dateFormat={dateFormat}
        onDateFormatChange={(nextFormat) => {
          setDateFormat(nextFormat)
          window.localStorage.setItem(`adrafteo.dateFormat.${session.user.id}`, nextFormat)
        }}
        onClose={() => setShowAccountPage(false)}
        onDeleted={() => setShowAccountPage(false)}
        onOpenFaq={() => setShowFaqPage(true)}
      />
    )
  }

  if (!session) {
    return <LandingPage onOpenLegalPage={setActiveLegalPage} onOpenFaq={() => setShowFaqPage(true)} onOpenPricing={() => { setActiveLegalPage(null); setShowFaqPage(false); setShowPricingPage(true) }} />
  }

  if (showLanding) {
    return (
      <LandingPage
        onOpenLegalPage={setActiveLegalPage}
        onOpenFaq={() => setShowFaqPage(true)}
        onOpenPricing={() => { setActiveLegalPage(null); setShowFaqPage(false); setShowPricingPage(true) }}
        onBackWorkspace={() => setShowLanding(false)}
      />
    )
  }

  const templateCount = templates.length
  const visibleTemplates = templates.filter((template) => {
    const query = templateQuery.trim().toLowerCase()
    return !query || `${template.name} ${template.title ?? ''} ${template.content}`.toLowerCase().includes(query)
  })
  const crossVariableValues = Object.fromEntries(crossVariables.map((variable) => [variableKey(variable.variable_name), variable.default_value]))

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__brand">
          <img className="brand-mark" src="/logo-adrafteo-plume-blanche.png" alt="" aria-hidden="true" />
          <span className="topbar__brand-name">
            <strong>Adrafteo</strong>
          </span>
        </div>
        <span className="topbar__separator" aria-hidden="true">●</span>
        <div className="topbar__identity">
          <p className="eyebrow">Workspace listing architecture</p>
          <h1>{activeView === 'templates' ? 'Structured Listing Templates' : activeView === 'inventory' ? 'Inventory Registry' : 'Seller Performance Overview'}</h1>
          <p className="topbar__subtitle">
            {activeView === 'templates' ? 'Centralize your marketplace formats, dynamic SEO variables, and reusable copy.' : activeView === 'inventory' ? 'Track every item from purchase to sale, with your listing workflow close at hand.' : 'A practical summary of your current stock, sales, and listing workflow.'}
          </p>
        </div>
        <div className="topbar__actions">
          <button type="button" className="button button--ghost" onClick={() => setShowCrossVariables(true)}>
            Cross variables
          </button>
          <button type="button" className="button button--ghost" onClick={() => setShowFaqPage(true)}>
            FAQ
          </button>
          <button type="button" className="button button--ghost" onClick={() => setShowFeedback(true)}>
            Give a Feedback!
          </button>
          <button type="button" className="button button--ghost" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
          <button type="button" className="button button--ghost" onClick={() => setShowAccountPage(true)}>
            Account
          </button>
        </div>
      </header>

      <main className="content">
        {error ? <p className="error-message">{error}</p> : null}
        <nav className="workspace-nav" aria-label="Workspace sections">
          <button type="button" className="workspace-nav__link" onClick={() => setShowLanding(true)}>Landing</button>
          <button type="button" className={activeView === 'overview' ? 'workspace-nav__link workspace-nav__link--active' : 'workspace-nav__link'} onClick={() => setActiveView('overview')}>Overview</button>
          <button type="button" className={activeView === 'templates' ? 'workspace-nav__link workspace-nav__link--active' : 'workspace-nav__link'} onClick={() => setActiveView('templates')}>Templates</button>
          <button type="button" className={activeView === 'inventory' ? 'workspace-nav__link workspace-nav__link--active' : 'workspace-nav__link'} onClick={() => setActiveView('inventory')}>Inventory</button>
          <span className="workspace-nav__spacer" />
          <span className="workspace-nav__user">{session.user.email}</span>
        </nav>

        {activeView === 'overview' ? (
          <OverviewPage
            items={inventoryItems}
            templates={templates}
            onOpenTemplates={() => setActiveView('templates')}
            onOpenInventory={() => setActiveView('inventory')}
          />
        ) : activeView === 'templates' ? <>
        <section className="templates-heading">
          <div>
            <h2>Your templates</h2>
            <p>Reusable listing blueprints for every marketplace workflow.</p>
          </div>
          <input className="template-search" value={templateQuery} onChange={(event) => setTemplateQuery(event.target.value)} placeholder="Search templates, tags, keywords..." aria-label="Search templates" />
        </section>
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
          <button type="button" className="button button--primary template-create-button" onClick={() => {
            setGeneratorTemplate(null)
            setEditorDirty(false)
            setEditorTemplate({ name: '', title: '', content: '' })
          }}>
            + Create template
          </button>
        </section>

        {templateCount > 0 ? (
          <section className="grid">
            {visibleTemplates.map((template) => (
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
            <h2>{templateCount === 0 ? 'No templates yet' : 'No templates match your search'}</h2>
            <p>{templateCount === 0 ? 'Create your first advert template and reuse it for every listing.' : 'Try another keyword or clear the search field.'}</p>
            {templateCount === 0 ? (
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
            ) : (
              <button type="button" className="button button--ghost" onClick={() => setTemplateQuery('')}>
                Clear search
              </button>
            )}
          </section>
        )}
        </> : <InventoryPage items={inventoryItems} lots={inventoryLots} templates={templates} shipments={inventoryShipments} allocations={shipmentAllocations} dateFormat={dateFormat} onCreate={() => setInventoryEditor({})} onCreateLot={() => setLotEditor({})} onCreateShipment={() => setShipmentEditor(true)} onEdit={setInventoryEditor} onEditLot={setLotEditor} onDelete={handleDeleteInventoryItem} onDuplicate={handleDuplicateInventoryItem} onDuplicateLot={handleDuplicateInventoryLot} onDeleteLot={handleDeleteInventoryLot} onDeleteShipment={handleDeleteShipment} onGenerate={(item, template) => { setInventoryEditor(null); setGeneratorTemplate({ template, initialValues: getGeneratorValues(item, extractVariables(`${template.title ?? ''}\n${template.content}`)) }) }} onGenerateLot={handleGenerateLot} />}
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

      {shipmentEditor ? (
        <Modal title="Add shipment" subtitle="Allocate delivery, VAT and other inbound costs across physical inventory units." onClose={() => setShipmentEditor(false)} wide>
          <ShipmentForm items={inventoryItems} lots={inventoryLots} shipments={inventoryShipments} allocations={shipmentAllocations} onSave={handleSaveShipment} onCancel={() => setShipmentEditor(false)} />
        </Modal>
      ) : null}

      {showFeedback ? <FeedbackPanel onClose={() => setShowFeedback(false)} /> : null}
      <Footer onOpenLegalPage={setActiveLegalPage} onOpenPricing={() => { setActiveLegalPage(null); setShowFaqPage(false); setShowPricingPage(true) }} />
    </div>
  )
}

export default App