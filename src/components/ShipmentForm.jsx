import { MoneyInput } from './MoneyInput'
import { useState } from 'react'
import {
  currencyOptions,
  currencySettings,
  formatMoney,
  parseMoneyInput,
  getItemQuantity,
  getItemUnitValue,
  getShipmentTotal,
  allocateShipmentCosts,
} from '../lib/workspace'

export function ShipmentForm({ items, lots, shipments, allocations, onSave, onCancel }) {
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
  const productValue = selectedRows.reduce(
    (total, item) => total + getItemUnitValue(item) * Number(selected[item.id]),
    0,
  )
  const selectedUnits = selectedRows.reduce((total, item) => total + Number(selected[item.id]), 0)
  const vatAmount =
    form.vat_mode === 'none'
      ? 0
      : form.vat_mode === 'automatic'
        ? Number(
            (
              (Number(form.vat_base === '' ? productValue : form.vat_base) *
                Number(form.vat_rate || 0)) /
              100
            ).toFixed(2),
          )
        : Number(form.vat_amount || 0)
  const shipment = { ...form, vat_amount: vatAmount }
  const totalToAllocate = getShipmentTotal(shipment)
  const alreadyAllocated = new Set(allocations.map((allocation) => allocation.item_id))

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const toggleLot = (lotId) => {
    const lotItems = items.filter((item) => item.lot_id === lotId)
    const shouldSelect = lotItems.some((item) => !selected[item.id])
    setSelected((current) =>
      lotItems.reduce(
        (next, item) => ({ ...next, [item.id]: shouldSelect ? getItemQuantity(item) : 0 }),
        { ...current },
      ),
    )
  }
  const preview = allocateShipmentCosts(items, selected, shipment, manualCosts)
  const getAllocation = (item) =>
    preview.find((row) => row.item_id === item.id)?.allocated_cost ?? 0
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isSubmitting) return
    const allocatedTotal = preview.reduce((total, row) => total + row.allocated_cost, 0)
    if (!form.name.trim() || !selectedRows.length) return
    if (
      form.allocation_method === 'manual' &&
      Math.round(allocatedTotal * 100) !== Math.round(totalToAllocate * 100)
    ) {
      window.alert(`Manual allocations must total ${formatMoney(totalToAllocate)}.`)
      return
    }
    setIsSubmitting(true)
    try {
      await onSave({ ...form, name: form.name.trim(), vat_amount: vatAmount, allocations: preview })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="form shipment-form" onSubmit={handleSubmit}>
      <div className="form-grid form-grid--wide">
        <label>
          <span>Shipment name</span>
          <input
            value={form.name}
            onChange={(event) => updateField('name', event.target.value)}
            placeholder="October shipment"
            required
          />
        </label>
        <label>
          <span>Shipment date</span>
          <input
            type="date"
            value={form.shipment_date}
            onChange={(event) => updateField('shipment_date', event.target.value)}
            required
          />
        </label>
        <label>
          <span>
            {currencyOptions[currencySettings.currency].symbol} Additional store-to-forwarder
            shipping
          </span>
          <MoneyInput
            value={form.store_to_forwarder}
            onValueChange={(value) => updateField('store_to_forwarder', parseMoneyInput(value))}
          />
        </label>
        <label>
          <span>{currencyOptions[currencySettings.currency].symbol} Forwarder to home</span>
          <MoneyInput
            value={form.forwarder_to_home}
            onValueChange={(value) => updateField('forwarder_to_home', parseMoneyInput(value))}
          />
        </label>
        <label>
          <span>{currencyOptions[currencySettings.currency].symbol} Monthly subscription</span>
          <MoneyInput
            value={form.monthly_subscription}
            onValueChange={(value) => updateField('monthly_subscription', parseMoneyInput(value))}
          />
        </label>
        <label>
          <span>{currencyOptions[currencySettings.currency].symbol} Additional fees</span>
          <MoneyInput
            value={form.extra_cost}
            onValueChange={(value) => updateField('extra_cost', parseMoneyInput(value))}
          />
        </label>
      </div>
      <fieldset className="shipment-fieldset">
        <legend>VAT</legend>
        <div className="form-grid form-grid--wide">
          <label>
            <span>VAT mode</span>
            <select
              value={form.vat_mode}
              onChange={(event) => updateField('vat_mode', event.target.value)}
            >
              <option value="none">Not applicable</option>
              <option value="manual">Enter total manually</option>
              <option value="automatic">Calculate from rate</option>
            </select>
          </label>
          {form.vat_mode === 'manual' ? (
            <label>
              <span>{currencyOptions[currencySettings.currency].symbol} Total VAT</span>
              <MoneyInput
                value={form.vat_amount}
                onValueChange={(value) => updateField('vat_amount', parseMoneyInput(value))}
              />
            </label>
          ) : null}
          {form.vat_mode === 'automatic' ? (
            <>
              <label>
                <span>{currencyOptions[currencySettings.currency].symbol} Taxable base</span>
                <MoneyInput
                  placeholder={productValue.toFixed(2)}
                  value={form.vat_base}
                  onValueChange={(value) => updateField('vat_base', parseMoneyInput(value))}
                />
              </label>
              <label>
                <span>VAT rate (%)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.vat_rate}
                  onChange={(event) => updateField('vat_rate', event.target.value)}
                />
              </label>
            </>
          ) : null}
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.include_vat_in_cost}
              onChange={(event) => updateField('include_vat_in_cost', event.target.checked)}
            />
            <span>Include VAT in item cost</span>
          </label>
        </div>
        <p className="helper-text">Calculated VAT: {formatMoney(vatAmount)}</p>
      </fieldset>
      <fieldset className="shipment-fieldset">
        <legend>Allocation</legend>
        <label>
          <span>Allocation method</span>
          <select
            value={form.allocation_method}
            onChange={(event) => updateField('allocation_method', event.target.value)}
          >
            <option value="value">Proportional to value</option>
            <option value="equal">Equal per physical unit</option>
            <option value="manual">Manual amounts</option>
          </select>
        </label>
        <p className="helper-text">
          Only enter additional acquisition costs here. Shipping already included in an item
          purchase must not be entered again. Sale commissions and shipping to the buyer belong in
          Sale costs. Items already assigned to a shipment are marked below.
        </p>
        <div className="shipment-selection">
          {lots.map((lot) => {
            const lotItems = items.filter((item) => item.lot_id === lot.id)
            return (
              <div className="shipment-group" key={lot.id}>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => toggleLot(lot.id)}
                >
                  Toggle {lot.name}
                </button>
                {lotItems.map((item) => (
                  <ShipmentItemRow
                    manual={form.allocation_method === 'manual'}
                    key={item.id}
                    item={item}
                    selected={selected[item.id] || 0}
                    alreadyAllocated={alreadyAllocated.has(item.id)}
                    allocation={getAllocation(item)}
                    manualCost={manualCosts[item.id] || ''}
                    onQuantity={(value) =>
                      setSelected((current) => ({
                        ...current,
                        [item.id]: Math.min(getItemQuantity(item), Math.max(0, Number(value) || 0)),
                      }))
                    }
                    onManualCost={(value) =>
                      setManualCosts((current) => ({ ...current, [item.id]: value }))
                    }
                  />
                ))}
              </div>
            )
          })}
          {items
            .filter((item) => !item.lot_id)
            .map((item) => (
              <ShipmentItemRow
                manual={form.allocation_method === 'manual'}
                key={item.id}
                item={item}
                selected={selected[item.id] || 0}
                alreadyAllocated={alreadyAllocated.has(item.id)}
                allocation={getAllocation(item)}
                manualCost={manualCosts[item.id] || ''}
                onQuantity={(value) =>
                  setSelected((current) => ({
                    ...current,
                    [item.id]: Math.min(getItemQuantity(item), Math.max(0, Number(value) || 0)),
                  }))
                }
                onManualCost={(value) =>
                  setManualCosts((current) => ({ ...current, [item.id]: value }))
                }
              />
            ))}
        </div>
      </fieldset>
      <div className="shipment-summary">
        <strong>{selectedUnits} physical units selected</strong>
        <strong>{formatMoney(totalToAllocate)} to allocate</strong>
        <span>Product value: {formatMoney(productValue)}</span>
        <span>Final price after shipment: calculated per item</span>
      </div>
      <label>
        <span>Notes</span>
        <textarea
          value={form.notes}
          onChange={(event) => updateField('notes', event.target.value)}
          rows={3}
        />
      </label>
      <div className="form__actions">
        <button type="button" className="button button--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button button--primary" disabled={isSubmitting}>
          Apply shipment costs
        </button>
      </div>
    </form>
  )
}

function ShipmentItemRow({
  manual,
  item,
  selected,
  alreadyAllocated,
  allocation,
  manualCost,
  onQuantity,
  onManualCost,
}) {
  return (
    <div className="shipment-item-row">
      <div>
        <strong>{item.name}</strong>
        <small>
          {getItemQuantity(item)} units · {formatMoney(getItemUnitValue(item))} per unit{' '}
          {alreadyAllocated ? '· Already in a shipment' : ''}
        </small>
      </div>
      <input
        type="number"
        min="0"
        max={getItemQuantity(item)}
        step="1"
        value={selected}
        onChange={(event) => onQuantity(event.target.value)}
        aria-label={`Quantity of ${item.name}`}
      />
      {alreadyAllocated ? <span className="inventory-pill">Already assigned</span> : null}
      <span>{formatMoney(allocation)}</span>
      {manual ? (
        <MoneyInput
          className="shipment-manual-cost"
          value={manualCost}
          onValueChange={(value) => onManualCost(parseMoneyInput(value))}
          placeholder="Manual cost"
          aria-label={`Allocated cost for ${item.name}`}
        />
      ) : null}
    </div>
  )
}
