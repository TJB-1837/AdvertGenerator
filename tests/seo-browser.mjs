import assert from 'node:assert/strict'
import { preview } from 'vite'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { publicRoutes } from '../src/lib/public-content.js'

const { chromium } = await import(process.env.ADRAFTEO_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.ADRAFTEO_PLAYWRIGHT_MODULE).href : 'playwright')
const output = resolve(process.env.TEMP || '/tmp', 'adrafteo-browser-validation')
await mkdir(output, { recursive: true })

// Exercise the real production-preview routing, including missing-page responses.
const server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } })
const origin = 'http://127.0.0.1:' + server.httpServer.address().port
let browser
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const noJs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } })
  const staticPage = await noJs.newPage()
  for (const path of Object.keys(publicRoutes)) {
    const response = await staticPage.goto(origin + path)
    assert.equal(response.status(), 200)
    assert.equal(await staticPage.locator('h1').count(), 1)
    assert.ok((await staticPage.locator('main').innerText()).length > 200)
    assert.ok(await staticPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path}: mobile overflow`)
  }
  await staticPage.goto(origin + '/reseller-profit-tracking')
  await staticPage.screenshot({ path: resolve(output, 'seo-profit-mobile.png'), fullPage: true })
  await noJs.close()

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  const thirdParty = []
  page.on('request', req => { if (!req.url().startsWith(origin)) thirdParty.push(new URL(req.url()).hostname) })
  for (const path of Object.keys(publicRoutes)) {
    await page.goto(origin + path)
    await page.waitForLoadState('networkidle')
    assert.equal(await page.title(), publicRoutes[path].title)
  }
  assert.deepEqual(thirdParty, [], 'Public pages must not load Supabase or external services')
  assert.deepEqual(errors, [], 'No hydration or runtime errors')
  await page.goto(origin)
  await page.getByRole('link', { name: 'Explore inventory tracking', exact: true }).click()
  assert.equal(new URL(page.url()).pathname, '/reseller-inventory')
  await page.reload()
  await page.getByRole('heading', { name: 'Inventory Tracking for Independent Resellers', exact: true }).waitFor()
  await page.goBack()
  assert.equal(new URL(page.url()).pathname, '/')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('heading', { name: 'Welcome back.' }).waitFor()
  await page.goto(origin + '/app')
  await page.getByRole('heading', { name: 'Welcome back.' }).waitFor()
  assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex, follow')
  // Existing root OAuth error callbacks must become a private route and retain friendly errors.
  await page.goto(origin + '/#error=access_denied&error_description=private_details')
  await page.getByRole('alert').waitFor()
  assert.equal(new URL(page.url()).pathname, '/app')
  assert.match(await page.getByRole('alert').innerText(), /cancelled/)
  assert.ok(!(await page.getByRole('alert').innerText()).includes('private_details'))
  await page.goto(origin + '/reseller-profit-tracking')
  await page.screenshot({ path: resolve(output, 'seo-profit-desktop.png'), fullPage: true })
  await page.goto(origin)
  await page.screenshot({ path: resolve(output, 'seo-home-desktop.png'), fullPage: true })
  // Check status separately so the deliberate missing page does not pollute console assertions.
  const response = await page.request.get(origin + '/does-not-exist')
  assert.equal(response.status(), 404)
  assert.deepEqual(errors, [], 'No errors across navigation and authentication screens')
  console.log(`Browser checks passed: ${Object.keys(publicRoutes).length} pages without JS, mobile layout, hydration, navigation, sign-in, OAuth cancellation and 404. Screenshots: ${output}`)
} finally {
  if (browser) await browser.close()
  await new Promise(resolve => server.httpServer.close(resolve))
}
