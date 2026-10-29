import { siteUrl, structuredData } from './public-content.js'

const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
export function renderHead(path, page) {
  const title = escape(page.title)
  const description = escape(page.description)
  return `<title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="robots" content="${page.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'}" />
    <link rel="canonical" href="${siteUrl}${path}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${siteUrl}${path}" />
    <meta property="og:type" content="${path.startsWith('/guides/') ? 'article' : 'website'}" />
    <meta property="og:site_name" content="Adrafteo" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:image" content="${siteUrl}/og-image.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Adrafteo listing templates, inventory and profit tracking" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${siteUrl}/og-image.png" />
    <meta name="twitter:image:alt" content="Adrafteo listing templates, inventory and profit tracking" />
    ${structuredData(path).map(data => `<script type="application/ld+json">${JSON.stringify(data).replaceAll('<', '\\u003c')}</script>`).join('\n')}`
}

