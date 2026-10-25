import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isItemInStock,
  getItemProfit,
  getItemRoi,
  allocateShipmentCosts,
  allocateAmountByQuantities,
  getShipmentTotal,
  extractVariables,
  generateAdvertText,
  getInitialVariableValue,
  setCurrencySettings,
  formatMoneyInput,
  parseMoneyInput,
} from '../src/lib/workspace.js'

test('kept, sold and transit items do not count as stock', () => {
  assert.deepEqual(
    ['kept', 'sold', 'in_transit', 'in_stock', 'to_list', 'listed'].filter((status) =>
      isItemInStock({ status }),
    ),
    ['in_stock', 'to_list', 'listed'],
  )
})

test('profit subtracts acquisition costs and sale commission plus outbound shipping once', () => {
  const item = { status: 'sold', purchase_price: 55, sale_price: 100, selling_fees: 18 }
  assert.equal(getItemProfit(item), 27)
  assert.equal(getItemRoi(item), (27 / 55) * 100)
  assert.equal(getItemProfit({ ...item, status: 'kept' }), null)
  assert.equal(getItemRoi({ ...item, purchase_price: 0 }), null)
})

const items = [
  { id: 'a', quantity: 2, base_purchase_price: 100, seller_to_forwarder_cost: 10 },
  { id: 'b', quantity: 1, base_purchase_price: 25 },
]
test('shipment allocation uses selected units and does not add existing acquisition shipping again', () => {
  assert.deepEqual(
    allocateShipmentCosts(
      items,
      { a: 1, b: 1 },
      { forwarder_to_home: 30, allocation_method: 'value' },
    ).map((row) => row.allocated_cost),
    [20, 10],
  )
  assert.equal(getShipmentTotal({ forwarder_to_home: 30 }), 30)
})

test('zero-value acquisitions fall back to equal allocation per physical unit', () => {
  const freeItems = items.map((item) => ({ ...item, base_purchase_price: 0 }))
  assert.deepEqual(
    allocateShipmentCosts(
      freeItems,
      { a: 2, b: 1 },
      { forwarder_to_home: 30, allocation_method: 'value' },
    ).map((row) => row.allocated_cost),
    [20, 10],
  )
})

test('small shipment costs preserve exact cents across many items', () => {
  const manyItems = Array.from({ length: 100 }, (_, i) => ({
    id: String(i),
    quantity: 1,
    base_purchase_price: 1,
  }))
  const selection = Object.fromEntries(manyItems.map((item) => [item.id, 1]))
  const rows = allocateShipmentCosts(manyItems, selection, {
    forwarder_to_home: 0.5,
    allocation_method: 'equal',
  })
  assert.equal(
    rows.reduce((sum, row) => sum + Math.round(row.allocated_cost * 100), 0),
    50,
  )
  assert.ok(rows.every((row) => row.allocated_cost >= 0))
})

test('manual allocation starts with editable zero costs; excluded VAT stays out of cost', () => {
  assert.deepEqual(
    allocateShipmentCosts(
      items,
      { a: 1 },
      { forwarder_to_home: 20, allocation_method: 'manual' },
      { a: 20 },
    ),
    [{ item_id: 'a', quantity: 1, allocated_cost: 20 }],
  )
  assert.equal(
    getShipmentTotal({ forwarder_to_home: 20, vat_amount: 4, include_vat_in_cost: false }),
    20,
  )
})

test('lot allocation preserves the purchase total in cents with decimal-comma input', () => {
  assert.deepEqual(allocateAmountByQuantities('100,00', [2, 1]), ['66.67', '33.33'])
})

test('variable generation preserves item overrides and multiline cross defaults', () => {
  assert.deepEqual(extractVariables('[Brand] [Brand] [Size]'), ['Brand', 'Size'])
  assert.equal(getInitialVariableValue('Brand', { Brand: 'Nike' }, { brand: 'Default' }), 'Nike')
  assert.equal(
    getInitialVariableValue('Shipping note', {}, { shippingnote: 'Line 1\nLine 2' }),
    'Line 1\nLine 2',
  )
  assert.equal(generateAdvertText('[Brand] [Size]', { Brand: 'Nike', Size: '42' }), 'Nike 42')
})

test('currency entry converts back to stored EUR', () => {
  setCurrencySettings('GBP', { EUR: 1, GBP: 0.8, USD: 1.1 })
  assert.equal(formatMoneyInput(100), '80.00')
  assert.equal(parseMoneyInput('80'), '100.00')
  setCurrencySettings('EUR', { EUR: 1, GBP: 0.8, USD: 1.1 })
})
