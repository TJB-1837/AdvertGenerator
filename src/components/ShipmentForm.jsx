import { useEffect, useRef, useState } from 'react'
import { MoneyInput } from './MoneyInput'
import {
  currencySettings,
  formatMoney,
  formatMoneyInput,
  parseMoneyInput,
  getItemQuantity,
  getItemUnitValue,
  getShipmentProductValue,
  getShipmentVatAmount,
  getShipmentTotal,
  allocateShipmentCosts,
} from '../lib/workspace'

function createInitialForm() {
  const now = new Date()
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10)
  return {
    name: '',
    shipment_date: localDate,
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
  }
}

function SelectionCheckbox({ mixed = false, checked, label, onChange }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed
  }, [mixed])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      aria-label={label}
      aria-checked={mixed ? 'mixed' : checked}
      onChange={onChange}
    />
  )
}

const allocationDescriptions = {
  value:
    'Higher-value goods receive a larger share of the import costs. Delivery already paid is excluded from the weighting.',
  equal: 'Each selected physical unit receives the same share of the import costs.',
  manual:
    'Enter the added cost for each selected inventory row. The amounts must match the total import costs.',
}

export function ShipmentForm({ items, lots, allocations, onSave, onCancel, error = '' }) {
  const [initialForm] = useState(createInitialForm)
  const [form, setForm] = useState(initialForm)
  const [selected, setSelected] = useState({})
  const [manualCosts, setManualCosts] = useState({})
  const [query, setQuery] = useState('')
  const [selectedOnly, setSelectedOnly] = useState(false)
  const [expanded, setExpanded] = useState({})
  const [useCustomVatBase, setUseCustomVatBase] = useState(false)
  const [acknowledgePreviousCosts, setAcknowledgePreviousCosts] = useState(false)
  const [localError, setLocalError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const picked = (item) => selected[item.id] !== undefined && selected[item.id] !== 0
  const selectedRows = items.filter((item) => Number(selected[item.id]) > 0)
  const selectedUnits = selectedRows.reduce((total, item) => total + Number(selected[item.id]), 0)
  const productValue = getShipmentProductValue(items, selected)
  const vatAmount = getShipmentVatAmount(form, productValue)
  const shipment = { ...form, vat_amount: vatAmount }
  const totalToAllocate = getShipmentTotal(shipment)
  const preview = allocateShipmentCosts(items, selected, shipment, manualCosts)
  const allocationByItem = Object.fromEntries(
    preview.map((row) => [row.item_id, row.allocated_cost]),
  )
  const allocatedTotal = preview.reduce((total, row) => total + row.allocated_cost, 0)
  const remainingCents = Math.round(totalToAllocate * 100) - Math.round(allocatedTotal * 100)
  const alreadyAllocated = new Set(allocations.map((allocation) => allocation.item_id))
  const previouslyAssignedCount = selectedRows.filter((item) =>
    alreadyAllocated.has(item.id),
  ).length
  const currentCost = selectedRows.reduce(
    (total, item) => total + Number(item.final_price ?? item.purchase_price ?? 0),
    0,
  )
  const dirty =
    JSON.stringify(form) !== JSON.stringify(initialForm) ||
    items.some(picked) ||
    Object.values(manualCosts).some((value) => Number(value) > 0)

  useEffect(() => {
    if (!dirty || isSubmitting) return
    const protectDraft = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', protectDraft)
    return () => window.removeEventListener('beforeunload', protectDraft)
  }, [dirty, isSubmitting])

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setLocalError('')
  }
  const updateMoney = (field, value) => updateField(field, parseMoneyInput(value))
  const updateQuantity = (item, raw) => {
    const quantity =
      raw === '' ? '' : Math.min(getItemQuantity(item), Math.max(0, Math.floor(Number(raw) || 0)))
    setSelected((current) => ({ ...current, [item.id]: quantity }))
    setLocalError('')
  }
  const cancel = () => {
    if (isSubmitting) return
    if (!dirty || window.confirm('Leave this import shipment? Your unsaved changes will be lost.'))
      onCancel()
  }
  const toggleGroup = (groupItems) => {
    const all = groupItems.every((item) => Number(selected[item.id]) === getItemQuantity(item))
    setSelected((current) =>
      groupItems.reduce((next, item) => ({ ...next, [item.id]: all ? 0 : getItemQuantity(item) }), {
        ...current,
      }),
    )
    setLocalError('')
  }
  const normalizedQuery = query.trim().toLowerCase()
  const groups = [
    ...lots.map((lot) => ({
      id: lot.id,
      name: lot.name,
      items: items.filter((item) => item.lot_id === lot.id),
      isLot: true,
    })),
    {
      id: 'standalone',
      name: 'Individual items',
      items: items.filter((item) => !item.lot_id),
      isLot: false,
    },
  ]
    .map((group) => ({
      ...group,
      visibleItems: group.items.filter(
        (item) =>
          (!selectedOnly || picked(item)) &&
          (!normalizedQuery ||
            `${group.name} ${item.name} ${item.item_type ?? ''} ${item.condition ?? ''}`
              .toLowerCase()
              .includes(normalizedQuery)),
      ),
    }))
    .filter((group) => group.visibleItems.length > 0)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isSubmitting) return
    setLocalError('')
    if (!form.name.trim()) {
      setLocalError('Give this import shipment a name.')
      return
    }
    if (!selectedRows.length) {
      setLocalError('Select at least one physical unit to import.')
      return
    }
    if (items.some((item) => picked(item) && !(Number(selected[item.id]) > 0))) {
      setLocalError('Enter a positive quantity for every selected item.')
      return
    }
    if (form.allocation_method === 'manual' && remainingCents !== 0) {
      setLocalError('Manual allocations must match the total import costs.')
      return
    }
    if (previouslyAssignedCount > 0 && !acknowledgePreviousCosts) {
      setLocalError(
        'Confirm that previously assigned items should receive additional import costs.',
      )
      return
    }
    setIsSubmitting(true)
    try {
      const saved = await onSave({
        ...form,
        name: form.name.trim(),
        vat_amount: vatAmount,
        allocations: preview,
      })
      if (saved === false)
        setLocalError('The import shipment could not be saved. Review the error and try again.')
    } catch {
      setLocalError(
        'The import shipment could not be saved. Your entries are still available; try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="import-shipment" onSubmit={handleSubmit}>
      <header className="import-shipment__header">
        <div className="import-shipment__brand">
          <img src="/logo-adrafteo-plume-blanche.png" alt="" aria-hidden="true" />
          <strong>Adrafteo</strong>
          <span>Import tool</span>
        </div>
        <button
          type="button"
          className="button button--ghost"
          disabled={isSubmitting}
          onClick={cancel}
        >
          ← Back to inventory
        </button>
      </header>
      <div className="import-shipment__intro">
        <p className="eyebrow">International purchases · Inventory costs</p>
        <h1>New import shipment</h1>
        <p>
          Organise your imports and share delivery, VAT and forwarding fees across the items you
          bring home.
        </p>
        <div className="import-shipment__journey" aria-label="Import workflow">
          <span>Seller</span>
          <b aria-hidden="true">→</b>
          <span>Forwarder</span>
          <b aria-hidden="true">→</b>
          <span>Your address</span>
        </div>
      </div>
      <div className="import-shipment__layout">
        <section
          className="import-shipment__panel import-shipment__inventory"
          aria-labelledby="import-items-title"
        >
          <div className="import-shipment__section-heading">
            <div>
              <p className="eyebrow">01 · Shipment contents</p>
              <h2 id="import-items-title">Choose what you are importing</h2>
            </div>
            <span className="import-shipment__count">
              {selectedUnits} {selectedUnits === 1 ? 'unit' : 'units'} selected
            </span>
          </div>
          <p className="import-shipment__help">
            Select the physical units travelling in this shipment. Cost previews are totals for each
            inventory row, including units that are not travelling.
          </p>
          <div className="import-shipment__filters">
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setExpanded({})
              }}
              placeholder="Search items or lots…"
              aria-label="Search import inventory"
            />
            <label className="import-shipment__check">
              <input
                type="checkbox"
                checked={selectedOnly}
                onChange={(event) => setSelectedOnly(event.target.checked)}
              />
              <span>Selected only</span>
            </label>
          </div>
          {items.length === 0 ? (
            <div className="import-shipment__empty">
              <h3>Add your inventory first</h3>
              <p>
                Create items or lots in Inventory, then return here to allocate your import costs.
              </p>
              <button type="button" className="button button--ghost" onClick={cancel}>
                Back to inventory
              </button>
            </div>
          ) : groups.length === 0 ? (
            <p className="import-shipment__empty">
              {selectedOnly
                ? 'No selected items match this view.'
                : 'No items or lots match your search.'}
            </p>
          ) : (
            groups.map((group) => {
              const all = group.visibleItems.every(
                (item) => Number(selected[item.id]) === getItemQuantity(item),
              )
              const some = group.visibleItems.some(picked)
              const open =
                expanded[group.id] ?? (Boolean(normalizedQuery) || group.items.length <= 4)
              const groupUnits = group.items.reduce(
                (total, item) => total + Number(selected[item.id] || 0),
                0,
              )
              return (
                <section className="import-shipment__group" key={group.id}>
                  <div className="import-shipment__group-heading">
                    <SelectionCheckbox
                      checked={all}
                      mixed={!all && some}
                      label={`Select visible items in ${group.name}`}
                      onChange={() => toggleGroup(group.visibleItems)}
                    />
                    <button
                      type="button"
                      aria-expanded={Boolean(open)}
                      aria-controls={`import-group-${group.id}`}
                      onClick={() => setExpanded((current) => ({ ...current, [group.id]: !open }))}
                    >
                      <span className="import-shipment__chevron" aria-hidden="true">
                        {open ? '▾' : '▸'}
                      </span>
                      <strong>{group.name}</strong>
                      <small>
                        {group.items.length} rows · {groupUnits} units selected
                      </small>
                    </button>
                    {group.isLot ? <span className="import-shipment__badge">Lot</span> : null}
                  </div>
                  {open ? (
                    <div id={`import-group-${group.id}`} className="import-shipment__rows">
                      <div className="import-shipment__table-heading" aria-hidden="true">
                        <span>Item / quantity</span>
                        <span>Current cost</span>
                        <span>Added fees</span>
                        <span>New final cost</span>
                      </div>
                      {group.visibleItems.map((item) => (
                        <ShipmentItemRow
                          key={item.id}
                          item={item}
                          selected={selected[item.id] ?? 0}
                          checked={picked(item)}
                          allocation={allocationByItem[item.id] ?? 0}
                          alreadyAllocated={alreadyAllocated.has(item.id)}
                          manual={form.allocation_method === 'manual'}
                          manualCost={manualCosts[item.id] ?? ''}
                          onToggle={() =>
                            updateQuantity(item, picked(item) ? 0 : getItemQuantity(item))
                          }
                          onQuantity={(value) => updateQuantity(item, value)}
                          onManualCost={(value) =>
                            setManualCosts((current) => ({
                              ...current,
                              [item.id]: parseMoneyInput(value),
                            }))
                          }
                        />
                      ))}
                    </div>
                  ) : null}
                </section>
              )
            })
          )}
        </section>
        <aside className="import-shipment__sidebar" aria-label="Import costs and summary">
          <section className="import-shipment__panel">
            <div className="import-shipment__section-heading">
              <div>
                <p className="eyebrow">02 · Import details</p>
                <h2>Name &amp; delivery</h2>
              </div>
            </div>
            <div className="import-shipment__fields">
              <label>
                <span>Shipment name</span>
                <input
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  placeholder="October import · MYUS"
                  required
                  maxLength={200}
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
                  Forwarder → your address <small>{currencySettings.currency}</small>
                </span>
                <MoneyInput
                  value={form.forwarder_to_home}
                  onValueChange={(value) => updateMoney('forwarder_to_home', value)}
                  placeholder="0.00"
                />
                <small>
                  The total shipment delivery cost. It will be shared using your allocation method.
                </small>
              </label>
            </div>
            <details className="import-shipment__optional">
              <summary>
                Other import costs <span>Optional</span>
              </summary>
              <div className="import-shipment__fields">
                <label>
                  <span>Additional seller → forwarder delivery</span>
                  <MoneyInput
                    value={form.store_to_forwarder}
                    onValueChange={(value) => updateMoney('store_to_forwarder', value)}
                    placeholder="0.00"
                  />
                  <small>Only costs not already included on your items or lots.</small>
                </label>
                <label>
                  <span>Forwarding subscription</span>
                  <MoneyInput
                    value={form.monthly_subscription}
                    onValueChange={(value) => updateMoney('monthly_subscription', value)}
                    placeholder="0.00"
                  />
                </label>
                <label>
                  <span>Other fees</span>
                  <MoneyInput
                    value={form.extra_cost}
                    onValueChange={(value) => updateMoney('extra_cost', value)}
                    placeholder="0.00"
                  />
                </label>
                <label>
                  <span>Notes</span>
                  <textarea
                    value={form.notes}
                    onChange={(event) => updateField('notes', event.target.value)}
                    rows={3}
                    placeholder="Forwarder, tracking or invoice reference…"
                  />
                </label>
              </div>
            </details>
            <p className="import-shipment__help">
              Seller → forwarder costs already saved on items or lots stay included in their current
              costs. Do not enter them again here.
            </p>
          </section>
          <section className="import-shipment__panel" aria-labelledby="import-vat-title">
            <div className="import-shipment__section-heading">
              <div>
                <p className="eyebrow">03 · VAT</p>
                <h2 id="import-vat-title">Import VAT</h2>
              </div>
              <strong>{formatMoney(vatAmount)}</strong>
            </div>
            <div className="import-shipment__fields">
              <label>
                <span>VAT calculation</span>
                <select
                  aria-label="VAT calculation"
                  value={form.vat_mode}
                  onChange={(event) => updateField('vat_mode', event.target.value)}
                >
                  <option value="none">Not applicable</option>
                  <option value="manual">Enter invoice amount</option>
                  <option value="automatic">Calculate from a rate</option>
                </select>
              </label>
              {form.vat_mode === 'manual' ? (
                <label>
                  <span>VAT amount</span>
                  <MoneyInput
                    value={form.vat_amount}
                    onValueChange={(value) => updateMoney('vat_amount', value)}
                  />
                  <small>Enter the amount from your import invoice.</small>
                </label>
              ) : null}
              {form.vat_mode === 'automatic' ? (
                <>
                  <div className="import-shipment__vat-base">
                    <span>Selected goods · purchase price only</span>
                    <strong>{formatMoney(productValue)}</strong>
                    <small>
                      Seller → forwarder delivery, allocated lot delivery and all shipment fees are
                      excluded.
                    </small>
                  </div>
                  <label>
                    <span>VAT rate (%)</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.vat_rate}
                      onChange={(event) => updateField('vat_rate', event.target.value)}
                      required
                    />
                  </label>
                  <label className="import-shipment__check">
                    <input
                      type="checkbox"
                      checked={useCustomVatBase}
                      onChange={(event) => {
                        setUseCustomVatBase(event.target.checked)
                        if (!event.target.checked) updateField('vat_base', '')
                      }}
                    />
                    <span>Use a custom taxable base</span>
                  </label>
                  {useCustomVatBase ? (
                    <label>
                      <span>Custom taxable base</span>
                      <MoneyInput
                        value={form.vat_base}
                        onValueChange={(value) => updateMoney('vat_base', value)}
                        required
                      />
                      <small>This replaces the goods-only base above.</small>
                    </label>
                  ) : null}
                  <p className="import-shipment__formula">
                    {formatMoney(
                      useCustomVatBase && form.vat_base !== '' ? form.vat_base : productValue,
                    )}{' '}
                    × {form.vat_rate || 0}% = <strong>{formatMoney(vatAmount)}</strong>
                  </p>
                </>
              ) : null}
              {form.vat_mode !== 'none' ? (
                <label className="import-shipment__check">
                  <input
                    type="checkbox"
                    checked={form.include_vat_in_cost}
                    onChange={(event) => updateField('include_vat_in_cost', event.target.checked)}
                  />
                  <span>Include VAT in item costs</span>
                </label>
              ) : null}
            </div>
          </section>
          <section className="import-shipment__panel" aria-labelledby="import-allocation-title">
            <div className="import-shipment__section-heading">
              <div>
                <p className="eyebrow">04 · Allocation</p>
                <h2 id="import-allocation-title">Share the import costs</h2>
              </div>
            </div>
            <div className="import-shipment__fields">
              <label>
                <span>Allocation method</span>
                <select
                  aria-label="Allocation method"
                  value={form.allocation_method}
                  onChange={(event) => updateField('allocation_method', event.target.value)}
                >
                  <option value="value">Proportional to goods value</option>
                  <option value="equal">Equal per physical unit</option>
                  <option value="manual">Manual amounts</option>
                </select>
              </label>
            </div>
            <p className="import-shipment__help">
              {allocationDescriptions[form.allocation_method]}
            </p>
            {form.allocation_method === 'value' && selectedUnits > 0 && productValue === 0 ? (
              <p className="import-shipment__notice">
                These goods have no purchase value. Costs are shared equally per physical unit.
              </p>
            ) : null}
            {form.allocation_method === 'manual' ? (
              <p
                className={`import-shipment__balance ${remainingCents !== 0 ? 'import-shipment__balance--pending' : ''}`}
                role="status"
              >
                {remainingCents === 0
                  ? 'All import costs allocated.'
                  : remainingCents > 0
                    ? `${formatMoney(remainingCents / 100)} still to allocate.`
                    : `${formatMoney(-remainingCents / 100)} overallocated.`}
              </p>
            ) : null}
          </section>
          <section
            className="import-shipment__panel import-shipment__summary"
            aria-labelledby="import-summary-title"
          >
            <div className="import-shipment__section-heading">
              <h2 id="import-summary-title">Shipment summary</h2>
              <span className="import-shipment__count">
                {selectedUnits} {selectedUnits === 1 ? 'unit' : 'units'}
              </span>
            </div>
            <dl className="import-shipment__totals">
              <div>
                <dt>Selected goods, excluding shipping</dt>
                <dd>{formatMoney(productValue)}</dd>
              </div>
              <div>
                <dt>Delivery &amp; other import fees</dt>
                <dd>
                  {formatMoney(getShipmentTotal({ ...shipment, include_vat_in_cost: false }))}
                </dd>
              </div>
              <div>
                <dt>VAT {form.include_vat_in_cost === false ? '(not added to costs)' : ''}</dt>
                <dd>{formatMoney(vatAmount)}</dd>
              </div>
              <div className="import-shipment__grand-total">
                <dt>Total costs to share</dt>
                <dd>{formatMoney(totalToAllocate)}</dd>
              </div>
              <div>
                <dt>New total cost · selected rows</dt>
                <dd>{formatMoney(currentCost + allocatedTotal)}</dd>
              </div>
            </dl>
            {previouslyAssignedCount > 0 ? (
              <div className="import-shipment__notice">
                <p>
                  {previouslyAssignedCount} selected{' '}
                  {previouslyAssignedCount === 1 ? 'row already has' : 'rows already have'} shipment
                  costs.
                </p>
                <label className="import-shipment__check">
                  <input
                    type="checkbox"
                    checked={acknowledgePreviousCosts}
                    onChange={(event) => setAcknowledgePreviousCosts(event.target.checked)}
                  />
                  <span>These are additional import costs.</span>
                </label>
              </div>
            ) : null}
            {error || localError ? (
              <p className="import-shipment__error" role="alert">
                {error || localError}
              </p>
            ) : null}
            {!selectedUnits ? (
              <p className="import-shipment__help">
                Select at least one unit to create this import shipment.
              </p>
            ) : null}
            <button
              type="submit"
              className="button button--primary import-shipment__save"
              disabled={isSubmitting || !selectedUnits}
            >
              {isSubmitting ? 'Saving import shipment…' : 'Create import shipment'}
            </button>
            <button
              type="button"
              className="button button--ghost import-shipment__cancel"
              disabled={isSubmitting}
              onClick={cancel}
            >
              Cancel
            </button>
          </section>
        </aside>
      </div>
    </form>
  )
}

function ShipmentItemRow({
  item,
  selected,
  checked,
  allocation,
  alreadyAllocated,
  manual,
  manualCost,
  onToggle,
  onQuantity,
  onManualCost,
}) {
  const currentCost = Number(item.final_price ?? item.purchase_price ?? 0)
  return (
    <div className={`import-shipment__item ${checked ? 'import-shipment__item--selected' : ''}`}>
      <div className="import-shipment__item-identity">
        <SelectionCheckbox checked={checked} label={`Select ${item.name}`} onChange={onToggle} />
        <div>
          <strong>{item.name}</strong>
          <small>
            {getItemQuantity(item)} {getItemQuantity(item) === 1 ? 'unit' : 'units'} available ·{' '}
            {formatMoney(getItemUnitValue(item))} goods / unit
          </small>
          {alreadyAllocated ? (
            <span className="import-shipment__badge import-shipment__badge--assigned">
              Previous shipment costs
            </span>
          ) : null}
          <label className="import-shipment__quantity">
            <span>Units to import</span>
            <input
              type="number"
              min="0"
              max={getItemQuantity(item)}
              step="1"
              value={selected}
              onChange={(event) => onQuantity(event.target.value)}
              aria-label={`Units to import for ${item.name}`}
              required={checked}
            />
          </label>
        </div>
      </div>
      <div className="import-shipment__amount">
        <span>Current cost</span>
        <strong>{formatMoney(currentCost)}</strong>
      </div>
      <div className="import-shipment__amount">
        <span>Added fees</span>
        {manual && checked ? (
          <MoneyInput
            value={manualCost}
            onValueChange={onManualCost}
            aria-label={`Added import costs for ${item.name}`}
            placeholder="0.00"
          />
        ) : (
          <strong>{checked ? `+ ${formatMoney(allocation)}` : '—'}</strong>
        )}
      </div>
      <div className="import-shipment__amount import-shipment__amount--final">
        <span>New final cost</span>
        <strong>{checked ? formatMoney(currentCost + allocation) : '—'}</strong>
      </div>
    </div>
  )
}
