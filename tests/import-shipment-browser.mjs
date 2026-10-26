const { chromium } = await import(
  process.env.ADRAFTEO_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.ADRAFTEO_PLAYWRIGHT_MODULE).href
    : 'playwright'
)
import { pathToFileURL, fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
const outputPath = path.join(os.tmpdir(), 'adrafteo-browser-validation')
fs.mkdirSync(outputPath, { recursive: true })
const root = fileURLToPath(new URL('../', import.meta.url))
const { createServer } = await import('vite')
const fixture = `import React from 'react';import {createRoot} from 'react-dom/client';import {ShipmentPage} from '/src/pages/ShipmentPage.jsx';import '/src/styles.css';
const items=[{id:'a',lot_id:'bags',name:'Blind bag A',quantity:2,status:'in_transit',base_purchase_price:100,seller_to_forwarder_cost:30,lot_shipping_cost:10,inbound_cost:20,purchase_price:160,final_price:160},{id:'b',lot_id:'bags',name:'Blind bag B',quantity:1,status:'kept',base_purchase_price:50,purchase_price:55,final_price:55},...Array.from({length:10},(_,i)=>({id:'c'+i,lot_id:'collectibles',name:'Collector figure '+(i+1),quantity:1,status:'in_transit',base_purchase_price:15,purchase_price:18,final_price:18})),{id:'solo',name:'Vintage jacket',quantity:1,status:'in_stock',base_purchase_price:25,purchase_price:25,final_price:25}];
createRoot(document.getElementById('root')).render(React.createElement(ShipmentPage,{items,lots:[{id:'bags',name:'Blind bags'},{id:'collectibles',name:'Collectibles'}],allocations:[{item_id:'a',shipment_id:'previous'}],onSave:async draft=>{window.__saved=draft;return !window.__failSave},onCancel:()=>{window.__cancelled=true}}));`
const virtualId = '\0virtual:import-preview.jsx'
const server = await createServer({
  root,
  appType: 'custom',
  server: { host: '127.0.0.1', port: 0 },
  plugins: [
    {
      name: 'import-preview-fixture',
      resolveId(id) {
        if (id === 'virtual:import-preview.jsx') return virtualId
      },
      load(id) {
        if (id === virtualId) return fixture
      },
    },
  ],
})
server.middlewares.use('/__import-preview', async (req, res, next) => {
  try {
    res.setHeader('Content-Type', 'text/html')
    res.end(
      await server.transformIndexHtml(
        '/__import-preview',
        '<!doctype html><html><head><link rel="icon" href="data:,"><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body><div id="root"></div><script type="module" src="/@id/__x00__virtual:import-preview.jsx"></script></body></html>',
      ),
    )
  } catch (e) {
    next(e)
  }
})
let browser
try {
  await server.listen()
  const port = server.httpServer.address().port
  browser = await chromium.launch({
    ...(process.env.ADRAFTEO_BROWSER_EXECUTABLE
      ? { executablePath: process.env.ADRAFTEO_BROWSER_EXECUTABLE }
      : { channel: 'chrome' }),
    headless: true,
  })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.setDefaultTimeout(15000)
  const errors = []
  page.on('pageerror', (e) => {
    errors.push(e.message)
    console.error('BROWSER ERROR', e.message)
  })
  await page.goto('http://127.0.0.1:' + port + '/__import-preview')
  await page.getByRole('heading', { name: 'New import shipment', exact: true }).waitFor()
  assert.equal(await page.locator('.modal-backdrop').count(), 0)
  await page.getByLabel('Shipment name', { exact: true }).fill('Import check')
  await page.getByLabel('Select visible items in Blind bags', { exact: true }).check()
  await page.getByLabel('Units to import for Blind bag A', { exact: true }).fill('1')
  assert.equal(
    await page
      .getByLabel('Select visible items in Blind bags', { exact: true })
      .evaluate((el) => el.indeterminate),
    true,
  )
  await page.getByLabel('Select Blind bag B', { exact: true }).uncheck()
  await page.getByLabel(/^VAT calculation/).selectOption('automatic')
  assert.equal(await page.locator('.import-shipment__vat-base strong').innerText(), '€50.00')
  await page.getByLabel(/Forwarder → your address/).fill('40')
  await page.getByText('Other import costs', { exact: false }).first().click()
  await page.getByLabel('Additional seller → forwarder delivery', { exact: false }).fill('100')
  await page.getByLabel('Forwarding subscription', { exact: true }).fill('3')
  await page.getByLabel('Other fees', { exact: true }).fill('7')
  assert.match(
    await page.locator('.import-shipment__formula').innerText(),
    /€50\.00 × 20% = €10\.00/,
  )
  assert.match(await page.locator('.import-shipment__grand-total').innerText(), /€160\.00/)
  await page.getByLabel('Use a custom taxable base', { exact: true }).check()
  await page.getByRole('textbox', { name: /^Custom taxable base/ }).fill('0')
  await page.getByLabel('VAT rate (%)', { exact: true }).click()
  assert.match(await page.locator('.import-shipment__formula').innerText(), /€0\.00 × 20% = €0\.00/)
  await page.getByLabel('Use a custom taxable base', { exact: true }).uncheck()
  assert.match(
    await page.locator('.import-shipment__formula').innerText(),
    /€50\.00 × 20% = €10\.00/,
  )
  await page.getByLabel(/^Allocation method/).selectOption('manual')
  await page.getByRole('button', { name: 'Create import shipment', exact: true }).click()
  assert.match(await page.getByRole('alert').innerText(), /Manual allocations must match/)
  await page.getByLabel('Added import costs for Blind bag A', { exact: true }).fill('160')
  await page.getByLabel('These are additional import costs.', { exact: true }).check()
  await page.getByRole('button', { name: 'Create import shipment', exact: true }).click()
  const saved = await page.evaluate(() => window.__saved)
  assert.equal(saved.vat_amount, 10)
  assert.equal(saved.vat_base, '')
  assert.deepEqual(saved.allocations, [{ item_id: 'a', quantity: 1, allocated_cost: 160 }])
  console.log(
    'PASS: selection, mixed checkbox, quantity, goods-only VAT, custom base reset, manual allocation, inline validation and save payload',
  )
  await page.evaluate(() => {
    window.__failSave = true
  })
  await page.getByRole('button', { name: 'Create import shipment', exact: true }).click()
  assert.match(await page.getByRole('alert').innerText(), /could not be saved/)
  assert.equal(await page.getByLabel('Shipment name', { exact: true }).inputValue(), 'Import check')
  await page.evaluate(() => {
    window.__failSave = false
  })
  await page.getByRole('button', { name: 'Create import shipment', exact: true }).click()
  console.log('PASS: failed save shows an inline error and retains entered data')
  await page.getByLabel('Search import inventory', { exact: true }).fill('Blind bags')
  assert.equal(await page.locator('.import-shipment__group').count(), 1)
  await page.getByLabel('Selected only', { exact: true }).check()
  assert.equal(await page.locator('.import-shipment__item').count(), 1)
  await page.getByLabel('Search import inventory', { exact: true }).fill('')
  await page.getByLabel('Selected only', { exact: true }).uncheck()
  await page.getByLabel(/^Allocation method/).selectOption('value')
  await page.getByText('Other import costs', { exact: false }).first().click()
  await page
    .getByRole('heading', { name: 'New import shipment', exact: true })
    .scrollIntoViewIfNeeded()
  const backgrounds = await page
    .locator('.import-shipment input:not([type=checkbox]), .import-shipment select')
    .evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).backgroundColor))
  assert.ok(backgrounds.every((color) => color === 'rgb(255, 255, 255)'))
  await page.screenshot({ path: path.join(outputPath, 'import-desktop.png'), fullPage: true })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: path.join(outputPath, 'import-mobile.png'), fullPage: true })
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
  assert.equal(errors.length, 0, errors.join('\n'))
  console.log(
    'PASS: search, selected-only filter, light fields, desktop/mobile layouts without horizontal overflow or runtime errors',
  )
  const dialog = page.waitForEvent('dialog')
  const click = page.getByRole('button', { name: '← Back to inventory', exact: true }).click()
  const prompt = await dialog
  await prompt.dismiss()
  await click
  assert.equal(await page.evaluate(() => Boolean(window.__cancelled)), false)
  console.log('PASS: leaving a populated shipment protects unsaved input')
} catch (e) {
  console.error(e)
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  await server.close()
}
