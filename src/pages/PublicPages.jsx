import { lazy, Suspense, useState } from 'react'
import { faqItems } from '../lib/public-content'
import { getOAuthReturnError } from '../lib/auth'

const AuthPanel = lazy(() => import('../components/Account').then(m => ({ default: m.AuthPanel })))
const FeedbackPanel = lazy(() => import('../components/FeedbackPanel').then(m => ({ default: m.FeedbackPanel })))

export function Footer() {
  return <footer className="site-footer">
    <nav className="site-footer__nav" aria-label="Footer navigation">
      <a href="/">Home</a><a href="/listing-templates">Listing templates</a>
      <a href="/reseller-inventory">Inventory</a><a href="/reseller-profit-tracking">Profit tracking</a>
      <a href="/guides/reusable-listing-template">Template guide</a><a href="/guides/resale-cost-and-profit">Profit guide</a>
      <a href="/pricing">Pricing</a><a href="/faq">FAQ</a>
      <a href="/legal">Legal notice</a><a href="/privacy">Privacy policy</a><a href="/terms">Terms</a>
    </nav>
    <p className="site-footer__meta">Adrafteo — listing templates, inventory and profit tracking for independent resellers.</p>
  </footer>
}

const legalContent = {
  mentions: {
    title: 'Legal notice',
    intro:
      'This website is operated by an individual established in France. The information below must be completed by the editor before the final public launch.',
    blocks: [
      {
        heading: 'Website owner',
        body: '<p>First name and surname: Antoine MARMOL.</p><p>Status: private individual established in France.</p><p>Contact email: adrafteo@gmail.com.</p><p>Phone: None.</p>',
      },
      {
        heading: 'Host',
        body: '<p>Primary website host: Vercel, Inc.</p><p>Address: 340 S Lemon Ave #4133, Walnut, CA 91789, United States.</p><p>Database host: Supabase, Inc.</p><p>Main processing location: Ireland for the Supabase database, with application data hosted in Europe/United States depending on the Vercel region used.</p>',
      },
    ],
  },
  confidentialite: {
    title: 'Privacy policy',
    intro:
      'This policy describes the personal data processing carried out in connection with the Adrafteo service, based on the code currently present in the project.',
    blocks: [
      {
        heading: 'Data collected in the project code',
        body: '<p>The site collects the following data for the user account and service management: email address, password, Supabase identifier, template name, template title, template content, cross variables, inventory items (name, status, type, condition, purchase price, target sale price, sale price, fees, dates, platforms, notes), inventory lots, and feedback messages (name, email, message).</p><p>These data are stored in Supabase and linked to the connected user through <code>user_id</code> in the project tables.</p>',
      },
      {
        heading: 'Purposes',
        body: '<ul><li>Create and manage a user account.</li><li>Save personal templates and reusable variables.</li><li>Track inventory, purchases, sales, margins and lots.</li><li>Collect user feedback via the feedback form.</li><li>Ensure the security and correct operation of the service.</li></ul>',
      },
      {
        heading: 'Legal basis and retention period',
        body: "<p>For the user account and personal data storage, the legal basis is the performance of the service contract and account management.</p><p>Account data, templates, inventory and variables are kept while the account remains active and for up to two years after the user's last connection, unless the user requests earlier deletion.</p><p>Feedback messages are kept for up to 90 days after submission, then deleted from the feedback table unless a longer period is legally justified.</p>",
      },
      {
        heading: 'Recipients',
        body: '<p>Data are accessible to the user, the website editor, and the hosting providers: Supabase and Vercel.</p><p>Data are not transferred to a marketing tool or social network in the code identified today, but international transfers must be verified in the final Supabase and Vercel configuration.</p>',
      },
      {
        heading: 'Data subject rights',
        body: '<p>Under the GDPR, any person may request access, rectification, erasure, objection, restriction of processing and data portability.</p><p>To exercise these rights, contact: adrafteo@gmail.com.</p><p>You may also file a complaint with CNIL if you believe your rights are not respected.</p>',
      },
      {
        heading: 'How to exercise your rights',
        body: '<p>Send your request to <a href="mailto:adrafteo@gmail.com">adrafteo@gmail.com</a> with the subject line “GDPR request”. Describe the right you wish to exercise and the account email concerned. Additional information may be requested when necessary to verify your identity.</p><p>Requests are handled without undue delay and generally within one month of receipt. This period may be extended by up to two additional months for complex requests; you will be informed if an extension is necessary.</p>',
      },
    ],
  },
  cgu: {
    title: 'Terms of use',
    intro:
      'The following Terms apply to the Adrafteo service in its current version, which includes user account creation and personal template management.',
    blocks: [
      {
        heading: 'Service purpose',
        body: '<p>Adrafteo allows a user to create reusable templates for marketplace listings, fill in variables, and generate ready-to-copy listing text.</p>',
      },
      {
        heading: 'Access and registration',
        body: '<p>Access to the service requires creating an account using an email address and password. The user is responsible for the information provided and for the confidentiality of their password.</p>',
      },
      {
        heading: 'Use of the service',
        body: '<ul><li>Use the service only for lawful purposes.</li><li>Do not enter illegal, defamatory, or rights-infringing content.</li><li>Do not attempt to bypass the site’s security measures.</li></ul>',
      },
      {
        heading: 'Data and termination',
        body: '<p>Account data, templates and inventory are stored in the user account. The account can be deleted at any time by the user in the account management area, subject to the active deletion policy in Supabase.</p>',
      },
      {
        heading: 'Intellectual property',
        body: '<p>The site and its technical elements are the property of the editor. User-entered content remains the property of the user, subject to applicable rules on third-party rights and personal data protection.</p>',
      },
      {
        heading: 'Liability',
        body: '<p>The editor strives to provide a reliable service without guaranteeing the total absence of bugs or interruptions. The service is provided “as is”, and the user is responsible for the way they use it.</p>',
      },
    ],
  },
}

export function LegalPage({ page }) {
  const content = legalContent[page] ?? legalContent.mentions

  return (
    <main className="legal-shell">
      <header className="legal-header">
        <div>
          <p className="eyebrow">Adrafteo</p>
          <h1>{content.title}</h1>
        </div>
        <a className="button button--ghost" href="/">Home</a>
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

      <Footer />
    </main>
  )
}

export function FaqPage() {
  return (
    <main className="legal-shell">
      <header className="legal-header">
        <div>
          <a className="button button--ghost faq-pricing-button" href="/pricing">Pricing</a>
          <p className="eyebrow">Adrafteo</p>
          <h1>Frequently asked questions</h1>
        </div>
        <a className="button button--ghost" href="/">Home</a>
      </header>

      <article className="legal-page faq-page">
        <p className="legal-page__intro">
          Clear answers about reusable listing templates, variables, privacy, and advert generation.
        </p>
        <div className="faq-list">
          {faqItems.map((item) => (
            <details key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </article>

      <Footer />
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

export function PricingPage() {
  return (
    <main className="legal-shell">
      <header className="legal-header">
        <div>
          <p className="eyebrow">Adrafteo</p>
          <h1>Simple pricing.</h1>
        </div>
        <a className="button button--ghost" href="/">Home</a>
      </header>

      <article className="legal-page pricing-page">
        <p className="legal-page__intro">
          Everything available in Adrafteo is included in the Free plan during the beta.
        </p>
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
                  <td aria-label={`${feature}: included`}>
                    <span className="pricing-check" aria-hidden="true">
                      ✓
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="pricing-note">
          No payment is required while Adrafteo is in beta. Future plans will be communicated before
          any change to access or pricing.
        </p>
        <a className="button button--primary" href="/app">Open your free workspace</a>
      </article>

      <Footer />
    </main>
  )
}

export function LandingPage({ onAuthenticated = () => window.location.assign('/app') }) {
  const [showAuth, setShowAuth] = useState(() =>
    Boolean(getOAuthReturnError(typeof window === 'undefined' ? null : window.location)),
  )
  const [showFeedback, setShowFeedback] = useState(false)

  if (showAuth) {
    return <Suspense fallback={<main className="auth-shell"><p>Loading sign in...</p></main>}><AuthPanel onAuthenticated={onAuthenticated} onBack={() => setShowAuth(false)} /></Suspense>
  }

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <main className="landing-page" id="main-content">
        <nav className="landing-nav" aria-label="Primary navigation">
          <a className="landing-brand" href="#top" aria-label="Adrafteo home">
            <img
              className="landing-brand__mark"
              src="/logo-adrafteo-plume-blanche.png"
              alt=""
              aria-hidden="true"
            />
            <span>Adrafteo</span>
          </a>
          <div className="landing-nav__actions">
            <a className="button button--ghost" href="/app">Workspace</a>
            <a className="button button--ghost" href="/pricing">Pricing</a>
            <a className="button button--ghost" href="/faq">FAQ</a>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setShowFeedback(true)}
            >
              Give a Feedback!
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setShowAuth(true)}
            >
              Sign in
            </button>
          </div>
        </nav>

        <section className="landing-hero" id="top">
          <div className="landing-hero__copy landing-hero__copy--centered">
            <p className="eyebrow">Optimized for resellers on multiple marketplaces</p>
            <h1>
              Reusable listings. Organised inventory.
              <br />
              Keep your resale workflow in <em>one workspace</em>.
            </h1>
            <p className="landing-hero__lede">
              Create reusable marketplace listing templates, fill in the details that change, and track your inventory, acquisition costs, sales and profit.
            </p>
            <div className="landing-hero__actions">
              <button
                type="button"
                className="button button--primary button--large"
                onClick={() => setShowAuth(true)}
              >
                Create a free workspace <span aria-hidden="true">→</span>
              </button>
              <a className="button button--ghost button--large" href="/faq">See how it works</a>
            </div>
            <span className="landing-note">Free during beta · No payment required</span>
          </div>

          <div
            className="product-preview product-preview--wide"
            role="img"
            aria-label="Adrafteo template, variable form, and generated advert preview"
          >
            <div className="product-preview__topbar">
              <span className="product-preview__logo">
                <img src="/logo-adrafteo-plume-blanche.png" alt="" aria-hidden="true" />
                Adrafteo
              </span>
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
                  <div className="preview-code">
                    [Brand] [Item] · size [Size]
                    <br />
                    <br />A [Condition] [Item] ready for its next owner.
                  </div>
                  <div className="preview-chips">
                    <span>[Brand]</span>
                    <span>[Size]</span>
                    <span>[Condition]</span>
                  </div>
                </div>
                <div className="product-preview__fields">
                  <span className="preview-label">02 · VARIABLES</span>
                  <div className="preview-form-line">
                    Brand <b>Nike</b>
                  </div>
                  <div className="preview-form-line">
                    Item <b>fleece</b>
                  </div>
                  <div className="preview-form-line">
                    Size <b>M</b>
                  </div>
                  <div className="preview-form-line">
                    Condition <b>good</b>
                  </div>
                </div>
                <div className="product-preview__result">
                  <span className="preview-label">03 · READY TO COPY</span>
                  <strong>
                    Nike fleece
                    <br />· size M
                  </strong>
                  <p>
                    A good fleece ready for its next owner.
                  </p>
                  <span className="preview-copy">
                    Copy listing <b>↗</b>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-metrics" aria-label="Product workflow highlights">
          <div>
            <strong>Less retyping</strong>
            <span>Reuse your saved structures</span>
          </div>
          <div>
            <strong>0%</strong>
            <span>AI required for generation</span>
          </div>
          <div>
            <strong>One workspace</strong>
            <span>Templates and inventory together</span>
          </div>
          <div>
            <strong>Multi-platform</strong>
            <span>Vinted, eBay, Depop and more</span>
          </div>
        </section>

        <section className="landing-benefits landing-capabilities">
          <div className="landing-section-heading">
            <p className="eyebrow">Built for the daily listing workflow</p>
            <h2>Keep the repeatable parts organised.</h2>
          </div>
          <div className="benefit-grid">
            <article>
              <span className="benefit-number">01</span>
              <h3>Save reusable templates</h3>
              <p>
                Keep titles and descriptions for the listing formats you use regularly, instead of
                starting from an empty field.
              </p>
            </article>
            <article>
              <span className="benefit-number">02</span>
              <h3>Fill only what changes</h3>
              <p>
                Use bracket variables such as [Brand], [Size], or [Condition] for the details that
                differ from item to item.
              </p>
            </article>
            <article>
              <span className="benefit-number">03</span>
              <h3>Track the wider workflow</h3>
              <p>
                Keep inventory, lots, purchase values, sales, profit, and reusable defaults in the
                same workspace.
              </p>
            </article>
          </div>
        </section>

        <section className="landing-capability-grid">
          <div className="landing-section-heading">
            <p className="eyebrow">One practical workspace</p>
            <h2>Less switching between notes, drafts, and spreadsheets.</h2>
          </div>
          <div className="landing-capability-cards">
            <article>
              <span>Template library</span>
              <h3>Keep your best listing structures close.</h3>
              <p>
                Save, edit, duplicate, and reuse templates across the marketplaces you work with.
              </p>
              <code>Template · Variables · Copy</code>
            </article>
            <article>
              <span>Inventory register</span>
              <h3>Know what you own and what it earns.</h3>
              <p>
                Track individual items and lots with purchase values, target prices, realised sales,
                profit, and ROI.
              </p>
              <code>Purchase · Target · Sold · ROI</code>
            </article>
            <article>
              <span>Reusable defaults</span>
              <h3>Fill familiar details once.</h3>
              <p>
                Cross variables can prefill values such as location, condition, or other details
                used in several templates.
              </p>
              <code>[Location] → Paris</code>
            </article>
            <article>
              <span>Client-side generation</span>
              <h3>Your copy stays under your control.</h3>
              <p>
                Adrafteo replaces variables in the browser and prepares text you can review before
                copying.
              </p>
              <code>No AI call required</code>
            </article>
          </div>
        </section>

        <section className="landing-workflow" aria-labelledby="workflow-heading">
          <div className="landing-section-heading">
            <p className="eyebrow">A simple three-step flow</p>
            <h2 id="workflow-heading">From saved structure to ready-to-copy advert.</h2>
          </div>
          <div className="landing-workflow__steps">
            <article>
              <span>01</span>
              <h3>Build your template</h3>
              <p>
                Write the title and description once, then mark changing information with brackets.
              </p>
              <code>[Brand] · [Item] · [Condition]</code>
            </article>
            <article>
              <span>02</span>
              <h3>Enter item details</h3>
              <p>Generate from a template and fill the values for the product you are listing.</p>
              <code>
                Brand&nbsp;&nbsp; Nike
                <br />
                Size&nbsp;&nbsp;&nbsp; 42
                <br />
                Condition Excellent
              </code>
            </article>
            <article>
              <span>03</span>
              <h3>Copy your advert</h3>
              <p>
                Review the generated title and description, then copy the text to the marketplace
                you use.
              </p>
              <code>
                Title + description
                <br />
                ready for your workflow
              </code>
            </article>
          </div>
        </section>

        <section className="landing-social-proof" aria-labelledby="proof-heading">
          <div className="landing-section-heading">
            <p className="eyebrow">Designed for independent sellers</p>
            <h2 id="proof-heading">A calmer way to build listing habits.</h2>
          </div>
          <div className="landing-social-proof__note">
            <strong>Early beta product</strong>
            <p>
              Adrafteo is being shaped with reseller feedback. These are product principles, not
              performance guarantees: clear copy, reusable structures, and less time spent
              rewriting.
            </p>
          </div>
        </section>

        <section className="landing-workflow" aria-labelledby="explore-heading">
          <div className="landing-section-heading">
            <p className="eyebrow">Explore the workflow</p>
            <h2 id="explore-heading">From the first draft to the final sale.</h2>
          </div>
          <div className="landing-workflow__steps">
            <article><h3>Reusable listing templates</h3><p>See a complete bracket-variable example and how to review your finished copy.</p><a href="/listing-templates">Explore listing templates</a></article>
            <article><h3>Reseller inventory</h3><p>Organise items and lots with their purchase, delivery and shipment costs.</p><a href="/reseller-inventory">Explore inventory tracking</a></article>
            <article><h3>Profit and ROI</h3><p>Understand what a sale earned using acquisition costs and selling fees.</p><a href="/reseller-profit-tracking">Explore profit tracking</a></article>
          </div>
        </section>

        <section className="landing-faq" aria-labelledby="faq-heading">
          <div className="landing-section-heading">
            <p className="eyebrow">Clear and practical</p>
            <h2 id="faq-heading">Questions before you start?</h2>
          </div>
          <div className="faq-list">
            {faqItems.map(({ question, answer }) => (
              <details key={question}><summary>{question}</summary><p>{answer}</p></details>
            ))}
          </div>
        </section>

        <section className="landing-cta">
          <div>
            <p className="eyebrow">Start with one repeatable listing</p>
            <h2>Save time on the copy you write again and again.</h2>
          </div>
          <button
            type="button"
            className="button button--ghost button--large"
            onClick={() => setShowFeedback(true)}
          >
            Give a Feedback!
          </button>
          <button
            type="button"
            className="button button--primary button--large"
            onClick={() => setShowAuth(true)}
          >
            Create a free workspace <span aria-hidden="true">→</span>
          </button>
        </section>
        {showFeedback ? <Suspense fallback={<p role="status">Loading feedback...</p>}><FeedbackPanel onClose={() => setShowFeedback(false)} /></Suspense> : null}
        <Footer />
      </main>
    </>
  )
}
