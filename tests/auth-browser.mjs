import { pathToFileURL, fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { createServer } from 'vite'
const { chromium } = await import(
  process.env.ADRAFTEO_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.ADRAFTEO_PLAYWRIGHT_MODULE).href
    : 'playwright'
)
const root = fileURLToPath(new URL('../', import.meta.url))
const fixtureId = '\0virtual:auth-preview.jsx'
const mockId = '\0virtual:auth-supabase'
const mock = `export const supabase={auth:{async signInWithOAuth(options){window.__oauthOptions=options;if(window.__oauthMode==='throw')throw new Error('Network unavailable');return window.__oauthMode==='error'?{error:{message:'Google provider is not enabled'}}:{data:{url:'https://accounts.google.com/example'},error:null}},async signUp(options){window.__signup=options;return {data:{session:window.__signupSession?{user:{id:'test'}}:null},error:null}},async signInWithPassword(options){window.__signin=options;return {data:{session:{user:{id:'test'}}},error:null}}}}`
const fixture = `import React from 'react';import {createRoot} from 'react-dom/client';import {LandingPage} from '/src/pages/PublicPages.jsx';import '/src/styles.css';createRoot(document.getElementById('root')).render(React.createElement(LandingPage,{onOpenLegalPage:()=>{},onOpenFaq:()=>{},onOpenPricing:()=>{},onAuthenticated:session=>{window.__authenticated=session}}));`
const server = await createServer({
  root,
  appType: 'custom',
  server: { host: '127.0.0.1', port: 0 },
  plugins: [
    {
      name: 'auth-test',
      enforce: 'pre',
      resolveId(id) {
        if (id === 'virtual:auth-preview.jsx') return fixtureId
        if (id.endsWith('/lib/supabase') || id.endsWith('/lib/supabase.js')) return mockId
      },
      load(id) {
        if (id === mockId) return mock
        if (id === fixtureId) return fixture
      },
    },
  ],
})
server.middlewares.use('/__auth-preview', async (req, res, next) => {
  try {
    res.setHeader('Content-Type', 'text/html')
    res.end(
      await server.transformIndexHtml(
        '/__auth-preview',
        '<!doctype html><html><head><link rel="icon" href="data:,"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@id/__x00__virtual:auth-preview.jsx"></script></body></html>',
      ),
    )
  } catch (e) {
    next(e)
  }
})
let browser
try {
  await server.listen()
  const origin = 'http://127.0.0.1:' + server.httpServer.address().port
  browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(origin + '/__auth-preview')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('heading', { name: 'Welcome back.' }).waitFor()
  await page.evaluate(() => {
    window.__oauthMode = 'error'
  })
  await page.getByRole('button', { name: 'Continue with Google', exact: true }).click()
  assert.match(await page.getByRole('alert').innerText(), /provider is not enabled/)
  assert.equal(
    await page.getByRole('button', { name: 'Continue with Google', exact: true }).isEnabled(),
    true,
  )
  await page.evaluate(() => {
    window.__oauthMode = 'throw'
  })
  await page.getByRole('button', { name: 'Continue with Google', exact: true }).click()
  assert.match(await page.getByRole('alert').innerText(), /Network unavailable/)
  console.log('PASS: Google provider errors and network failures allow retry')
  await page.getByRole('button', { name: 'Create an account', exact: true }).click()
  await page.getByRole('heading', { name: 'Create your workspace.' }).waitFor()
  await page.getByLabel('Email', { exact: true }).fill('test@example.com')
  await page.getByLabel('Password', { exact: true }).fill('test-only-password')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await page.getByText('Account created. Check your email if confirmation is enabled.').waitFor()
  assert.equal((await page.evaluate(() => window.__signup)).email, 'test@example.com')
  console.log('PASS: email registration remains available alongside Google')
  await page.evaluate(() => {
    window.__oauthMode = 'success'
  })
  await page.getByRole('button', { name: 'Continue with Google', exact: true }).click()
  await page.getByRole('button', { name: 'Redirecting to Google…', exact: true }).waitFor()
  const options = await page.evaluate(() => window.__oauthOptions)
  assert.equal(options.provider, 'google')
  assert.equal(options.options.redirectTo, origin + '/')
  assert.equal(
    await page.getByRole('button', { name: 'Create account', exact: true }).isDisabled(),
    true,
  )
  console.log(
    'PASS: Google OAuth receives the correct provider and root redirect; duplicate submission is blocked',
  )
  await page.goto(
    origin + '/__auth-preview?utm=test#error=access_denied&error_description=private_details',
  )
  await page.getByRole('heading', { name: 'Welcome back.' }).waitFor()
  assert.match(await page.getByRole('alert').innerText(), /cancelled/)
  assert.equal(new URL(page.url()).hash, '')
  assert.equal(new URL(page.url()).search, '?utm=test')
  assert.ok(!(await page.getByRole('alert').innerText()).includes('private_details'))
  await page.setViewportSize({ width: 390, height: 844 })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  assert.equal(errors.length, 0, errors.join('\n'))
  console.log(
    'PASS: cancelled callbacks reopen sign-in, clear error parameters, and remain usable on mobile',
  )
  await page.goto(origin + '/__auth-preview')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByLabel('Email', { exact: true }).fill('test@example.com')
  await page.getByLabel('Password', { exact: true }).fill('test-only-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForFunction(() => window.__authenticated?.user?.id === 'test')
  await page.goto(origin + '/__auth-preview')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('button', { name: 'Create an account', exact: true }).click()
  await page.getByLabel('Email', { exact: true }).fill('test@example.com')
  await page.getByLabel('Password', { exact: true }).fill('test-only-password')
  await page.evaluate(() => { window.__signupSession = true })
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await page.waitForFunction(() => window.__authenticated?.user?.id === 'test')
  console.log('PASS: successful email sign-in and immediate-session registration open the workspace')
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  await server.close()
}
