export function normalizeTemplate(template) {
  return {
    ...template,
    name: template.name.trim(),
    title: (template.title ?? '').trim(),
    content: template.content.trim(),
  }
}

export const currencyOptions = {
  EUR: { symbol: '€', label: 'Euro' },
  GBP: { symbol: '£', label: 'British pound' },
  USD: { symbol: '$', label: 'US dollar' },
}
export const fallbackCurrencyRates = { EUR: 1, GBP: 0.86, USD: 1.08 }
export let currencySettings = { currency: 'EUR', rates: fallbackCurrencyRates }

export function setCurrencySettings(currency, rates) {
  currencySettings = { currency, rates }
}

export function getCurrencyRate(currency = currencySettings.currency) {
  return Number(currencySettings.rates[currency] || 1)
}

export function formatMoney(value) {
  const currency = currencySettings.currency
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
    (Number(value) || 0) * getCurrencyRate(),
  )
}

export function formatMoneyInput(value) {
  if (value === '' || value === null || value === undefined) return ''
  return (Number(value || 0) * getCurrencyRate()).toFixed(2)
}

export function parseMoneyInput(value) {
  const normalized = String(value).replace(',', '.')
  if (normalized === '' || normalized === '.') return ''
  const amount = Number(normalized) / getCurrencyRate()
  const rounded = Math.round((amount + Number.EPSILON * Math.max(1, Math.abs(amount))) * 100) / 100
  return rounded.toFixed(2)
}

export function formatDate(value, dateFormat = 'DD/MM/YYYY') {
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

export function isItemInStock(item) {
  return ['in_stock', 'to_list', 'listed'].includes(item.status)
}

export function getItemProfit(item) {
  if (item.status !== 'sold' || item.sale_price === null || item.sale_price === '') {
    return null
  }

  return Number(item.sale_price) - Number(item.purchase_price || 0) - Number(item.selling_fees || 0)
}

export function getItemRoi(item) {
  const profit = getItemProfit(item)
  const purchasePrice = Number(item.purchase_price || 0)

  return profit === null || purchasePrice <= 0 ? null : (profit / purchasePrice) * 100
}

export function getItemQuantity(item) {
  return Math.max(1, Number(item.quantity) || 1)
}

export function getItemBasePurchasePrice(item) {
  return Number(item.base_purchase_price ?? item.purchase_price ?? 0)
}

export function getItemSellerToForwarderCost(item) {
  return Number(item.seller_to_forwarder_cost || 0)
}

export function getItemEffectiveBasePurchasePrice(item) {
  return (
    getItemBasePurchasePrice(item) +
    getItemSellerToForwarderCost(item) +
    Number(item.lot_shipping_cost || 0)
  )
}

export function getItemUnitValue(item) {
  return getItemBasePurchasePrice(item) / getItemQuantity(item)
}

// VAT defaults to goods only: no individual/lot delivery or shipment charges.
export function getShipmentProductValue(items, selected) {
  return items.reduce(
    (total, item) => total + getItemUnitValue(item) * Number(selected[item.id] || 0),
    0,
  )
}

export function getShipmentVatAmount(shipment, productValue) {
  if (shipment.vat_mode === 'none') return 0
  if (shipment.vat_mode !== 'automatic') return Number(shipment.vat_amount || 0)
  const base =
    shipment.vat_base === '' || shipment.vat_base == null ? productValue : Number(shipment.vat_base)
  const amount = (base * Number(shipment.vat_rate || 0)) / 100
  return Math.round((amount + Number.EPSILON * Math.max(1, Math.abs(amount))) * 100) / 100
}

export function getShipmentTotal(shipment) {
  const transportTotal =
    Number(shipment.store_to_forwarder || 0) +
    Number(shipment.forwarder_to_home || 0) +
    Number(shipment.extra_cost || 0) +
    Number(shipment.monthly_subscription || 0)
  return (
    transportTotal + (shipment.include_vat_in_cost === false ? 0 : Number(shipment.vat_amount || 0))
  )
}

export function getLotMetrics(items) {
  const soldItems = items.filter((item) => item.status === 'sold')
  const soldPurchaseValue = soldItems.reduce(
    (total, item) => total + Number(item.purchase_price || 0),
    0,
  )
  const realisedProfit = soldItems.reduce((total, item) => total + (getItemProfit(item) || 0), 0)
  const soldValue = soldItems.reduce((total, item) => total + Number(item.sale_price || 0), 0)
  const statuses = ['kept', 'sold', 'listed', 'to_list', 'in_stock', 'in_transit']
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

export function getStatusLabel(status) {
  if (status === 'kept') return 'Kept'
  return status.replace('_', ' ')
}

export function allocateAmount(total, count) {
  if (total === '' || total === null || total === undefined || count === 0) {
    return []
  }

  const totalCents = Math.round(Number(total) * 100)
  const baseCents = Math.floor(totalCents / count)
  const remainder = totalCents - baseCents * count

  return Array.from({ length: count }, (_, index) =>
    ((baseCents + (index === count - 1 ? remainder : 0)) / 100).toFixed(2),
  )
}

export function allocateAmountByQuantities(total, quantities) {
  const numericTotal =
    typeof total === 'string' ? Number.parseFloat(total.replace(',', '.')) : Number(total)
  if (!Number.isFinite(numericTotal) || quantities.length === 0) {
    return []
  }

  const totalCents = Math.round(numericTotal * 100)
  const normalizedQuantities = quantities.map((quantity) => Math.max(1, Number(quantity) || 1))
  const totalQuantity = normalizedQuantities.reduce((sum, quantity) => sum + quantity, 0)
  let allocatedCents = 0
  let cumulativeQuantity = 0

  return normalizedQuantities.map((itemQuantity, index) => {
    cumulativeQuantity += itemQuantity
    const cumulativeCents =
      index === quantities.length - 1
        ? totalCents
        : Math.round((totalCents * cumulativeQuantity) / totalQuantity)
    const amount = cumulativeCents - allocatedCents
    allocatedCents = cumulativeCents
    return (amount / 100).toFixed(2)
  })
}

export function extractVariables(content) {
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

export function variableKey(name) {
  return name.toLowerCase().replace(/[\s_-]/g, '')
}

export function getInitialVariableValue(variable, initialValues, crossVariables) {
  const specificValue = initialValues[variable]
  return specificValue?.trim()
    ? specificValue
    : (crossVariables[variableKey(variable)] ?? crossVariables[variable] ?? '')
}

export function generateAdvertText(content, values) {
  return content.replace(/\[([^\[\]]+)\]/g, (_, rawName) => {
    const name = rawName.trim()
    return values[name]?.trim() || ''
  })
}

export const platformOptions = [
  'Vinted',
  'eBay',
  'Depop',
  'Facebook Marketplace',
  'Vestiaire Collective',
  'Other',
]

export function getItemPlatforms(item) {
  return item.platforms?.length ? item.platforms : item.platform ? [item.platform] : []
}

export function getGeneratorValues(item, variables) {
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

export function getLotGeneratorValues(lot, items, variables) {
  const itemLines = items
    .map((item) => {
      const price =
        item.target_sale_price === null ? '' : ` - ${formatMoney(item.target_sale_price)}`
      const condition = item.condition ? ` (${item.condition})` : ''
      return `${item.name}${condition}${price}`
    })
    .join('\n')
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
    condition: items
      .map((item) => item.condition)
      .filter(Boolean)
      .join(', '),
  }

  variables.forEach((variable) => {
    values[variable] = knownValues[variableKey(variable)] ?? ''
  })

  return values
}

// Allocate integer cents using cumulative rounding, including zero-value purchases.
export function allocateShipmentCosts(items, selected, shipment, manualCosts = {}) {
  const rows = items.filter((item) => Number(selected[item.id]) > 0)
  const quantities = rows.map((item) => Number(selected[item.id]))
  const values = rows.map((item, index) => getItemUnitValue(item) * quantities[index])
  const valueTotal = values.reduce((sum, value) => sum + value, 0)
  const weights = shipment.allocation_method === 'equal' || valueTotal <= 0 ? quantities : values
  const weightTotal = weights.reduce((sum, value) => sum + value, 0)
  const totalCents = Math.round(getShipmentTotal(shipment) * 100)
  let cumulativeWeight = 0
  let allocatedCents = 0
  return rows.map((item, index) => {
    cumulativeWeight += weights[index]
    const cumulativeCents =
      index === rows.length - 1
        ? totalCents
        : Math.round((totalCents * cumulativeWeight) / weightTotal)
    const cost =
      shipment.allocation_method === 'manual'
        ? Number(manualCosts[item.id] || 0)
        : (cumulativeCents - allocatedCents) / 100
    allocatedCents = cumulativeCents
    return { item_id: item.id, quantity: quantities[index], allocated_cost: cost }
  })
}
