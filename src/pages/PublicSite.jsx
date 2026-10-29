import { Footer, FaqPage, LandingPage, LegalPage, PricingPage } from './PublicPages'
import { articles } from '../lib/public-content'

export function PublicSite({ path = '/' }) {
  if (path === '/') return <LandingPage />
  if (path === '/faq') return <FaqPage />
  if (path === '/pricing') return <PricingPage />
  const legalKey = { '/legal': 'mentions', '/privacy': 'confidentialite', '/terms': 'cgu' }[path]
  if (legalKey) return <LegalPage page={legalKey} />
  const article = articles[path]
  if (!article) return <main className="legal-shell"><h1>Page not found</h1><p>This address does not match a page on Adrafteo.</p><a href="/">Return home</a><Footer /></main>
  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <main className="legal-shell content-page" id="main-content">
        <nav className="public-nav" aria-label="Primary navigation">
          <a href="/" className="public-brand">Adrafteo</a>
          <a href="/listing-templates">Templates</a><a href="/reseller-inventory">Inventory</a>
          <a href="/reseller-profit-tracking">Profit</a><a href="/pricing">Pricing</a><a href="/app">Workspace</a>
        </nav>
        <article className="legal-page">
          <header>
            <p className="eyebrow">{article.guide ? 'Adrafteo practical guides' : 'Built for independent resellers'}</p>
            <h1>{article.title}</h1>
            <p className="legal-page__intro">{article.intro}</p>
            {article.guide ? <p className="article-byline">By Antoine Marmol, Adrafteo creator</p> : null}
          </header>
          {article.sections.map(([heading, body]) => <section key={heading} className="legal-page__section"><h2>{heading}</h2><p>{body}</p></section>)}
          <section className="legal-page__section">
            <h2>Try the workflow in Adrafteo</h2>
            <p>Listing templates, inventory, lots and profit tracking are included free during the beta. No payment is required.</p>
            <a className="button button--primary" href="/app">Open your workspace</a>
            <p>Adrafteo is an independent tool. Marketplace names describe where you can use your copy; they do not imply affiliation or automatic integration.</p>
          </section>
          <aside className="related-pages" aria-label="Related pages">
            <h2>Continue exploring</h2>
            <ul>{Object.keys(articles).filter(url => url !== path).map(url => <li key={url}><a href={url}>{articles[url].title}</a></li>)}</ul>
          </aside>
        </article>
        <Footer />
      </main>
    </>
  )
}
