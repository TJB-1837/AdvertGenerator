import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import { publicRoutes, faqItems, siteUrl } from '../src/lib/public-content.js'
import { getItemProfit, getItemRoi } from '../src/lib/workspace.js'

const titles = new Set()
const sitemap = await readFile('dist/sitemap.xml', 'utf8')
for (const [path, page] of Object.entries(publicRoutes)) {
  const html = await readFile(`dist${path === '/' ? '' : path}/index.html`, 'utf8')
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1, `${path}: one rendered H1`)
  assert.ok(html.includes(`<link rel="canonical" href="${siteUrl}${path}"`), `${path}: canonical`)
  assert.ok(!html.includes('<!--page-head-->'), `${path}: metadata inserted`)
  assert.ok(!html.includes('Loading your workspace'), `${path}: public content independent of auth`)
  assert.ok(!titles.has(page.title), `${path}: unique title`)
  titles.add(page.title)
  assert.equal(sitemap.includes(`<loc>${siteUrl}${path}</loc>`), !page.noindex)
  const schemas = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(match => JSON.parse(match[1]))
  if (path === '/' || path === '/faq') {
    const faq = schemas.find(schema => schema['@type'] === 'FAQPage')
    assert.equal(faq.mainEntity.length, faqItems.length)
    for (const item of faqItems) assert.ok(html.includes(item.question), `${path}: schema questions visible`)
  }
  // Crawl all internal links in the generated body, excluding in-page anchors.
  for (const [, href] of html.matchAll(/href="(\/[^"#?]*)"/g)) {
    assert.ok(publicRoutes[href] || href === '/app' || href.startsWith('/assets/') || href.startsWith('/logo-'), `${path}: unknown internal link ${href}`)
  }
}
const app = await readFile('dist/app/index.html', 'utf8')
assert.match(app, /noindex, follow/)
assert.ok(!sitemap.includes('/app'))
assert.match(await readFile('dist/404.html', 'utf8'), /<h1>Page not found<\/h1>/)
await access('dist/llms.txt')
const png = await readFile('public/og-image.png')
assert.equal(png.subarray(1, 4).toString(), 'PNG')
assert.equal(png.readUInt32BE(16), 1200)
assert.equal(png.readUInt32BE(20), 630)
// The published numerical example must agree with the real business calculations.
const example = { purchase_price: 60, sale_price: 100, selling_fees: 18, status: 'sold' }
assert.equal(getItemProfit(example), 22)
assert.ok(Math.abs(getItemRoi(example) - 36.6666666667) < 0.001)
console.log(`SEO checks passed for ${Object.keys(publicRoutes).length} public pages, sitemap, FAQ schemas, private shell, image and profit example.`)
