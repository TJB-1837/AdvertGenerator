import { MoneyInput } from './MoneyInput'
import { useEffect, useRef, useState } from 'react'
import {
  currencyOptions,
  currencySettings,
  formatMoneyInput,
  parseMoneyInput,
  getItemSellerToForwarderCost,
  allocateAmount,
  allocateAmountByQuantities,
  platformOptions,
  getItemPlatforms,
} from '../lib/workspace'

export function InventoryForm({ initialItem, templates, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({
    name: initialItem?.name ?? '',
    quantity: initialItem?.quantity ?? 1,
    status: initialItem?.status ?? 'in_stock',
    item_type: initialItem?.item_type ?? '',
    condition: initialItem?.condition ?? '',
    platforms: getItemPlatforms(initialItem ?? {}),
    purchase_date: initialItem?.purchase_date ?? '',
    purchase_price:
      initialItem?.base_purchase_price ??
      Math.max(
        0,
        Number(initialItem?.purchase_price || 0) -
          Number(initialItem?.inbound_cost || 0) -
          Number(initialItem?.lot_shipping_cost || 0) -
          getItemSellerToForwarderCost(initialItem ?? {}),
      ),
    seller_to_forwarder_cost: initialItem?.seller_to_forwarder_cost ?? 0,
    target_sale_price: initialItem?.target_sale_price ?? '',
    sale_date: initialItem?.sale_date ?? '',
    sale_price: initialItem?.sale_price ?? '',
    selling_fees: initialItem?.selling_fees ?? 0,
    template_id: initialItem?.template_id ?? '',
    notes: initialItem?.notes ?? '',
  }))

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    const savedItem = await onSave({
      ...initialItem,
      ...form,
      name: form.name.trim(),
      quantity: Math.max(1, Number(form.quantity) || 1),
      item_type: form.item_type.trim() || null,
      condition: form.condition.trim() || null,
      platforms: form.platforms,
      purchase_date: form.purchase_date || null,
      purchase_price: Number(
        (
          Number(form.purchase_price) +
          Number(form.seller_to_forwarder_cost || 0) +
          Number(initialItem?.inbound_cost || 0) +
          Number(initialItem?.lot_shipping_cost || 0)
        ).toFixed(2),
      ),
      final_price: Number(
        (
          Number(form.purchase_price) +
          Number(form.seller_to_forwarder_cost || 0) +
          Number(initialItem?.inbound_cost || 0) +
          Number(initialItem?.lot_shipping_cost || 0)
        ).toFixed(2),
      ),
      base_purchase_price: Number(form.purchase_price) || 0,
      seller_to_forwarder_cost: Number(form.seller_to_forwarder_cost) || 0,
      target_sale_price: form.target_sale_price === '' ? null : Number(form.target_sale_price),
      sale_date: form.sale_date || null,
      sale_price: form.sale_price === '' ? null : Number(form.sale_price),
      selling_fees: Number(form.selling_fees) || 0,
      template_id: form.template_id || null,
      notes: form.notes.trim() || null,
    })

    if (savedItem && !initialItem?.id) {
      setForm((current) => ({
        ...current,
        name: '',
        quantity: 1,
        purchase_price: '',
        seller_to_forwarder_cost: 0,
        target_sale_price: '',
        sale_date: '',
        sale_price: '',
        selling_fees: 0,
      }))
    }
  }

  const togglePlatform = (platform) =>
    setForm((current) => ({
      ...current,
      platforms: current.platforms.includes(platform)
        ? current.platforms.filter((value) => value !== platform)
        : [...current.platforms, platform],
    }))

  return (
    <form className="form inventory-entry-form" onSubmit={handleSubmit}>
      <div className="form-grid form-grid--wide">
        <label>
          <span>Item name</span>
          <input
            value={form.name}
            onChange={(event) => updateField('name', event.target.value)}
            placeholder="Example: Nike Air Max 90"
            required
          />
        </label>
        <label>
          <span>Quantity</span>
          <input
            type="number"
            min="1"
            step="1"
            value={form.quantity}
            onChange={(event) => updateField('quantity', event.target.value)}
            required
          />
        </label>
        <label>
          <span>Status</span>
          <select
            value={form.status}
            onChange={(event) => updateField('status', event.target.value)}
          >
            <option value="kept">Kept</option>
            <option value="in_transit">In transit</option>
            <option value="in_stock">In stock</option>
            <option value="to_list">To list</option>
            <option value="listed">Listed</option>
            <option value="sold">Sold</option>
          </select>
        </label>
        <label>
          <span>Type</span>
          <input
            value={form.item_type}
            onChange={(event) => updateField('item_type', event.target.value)}
            placeholder="Sneakers"
          />
        </label>
        <label>
          <span>Condition</span>
          <input
            value={form.condition}
            onChange={(event) => updateField('condition', event.target.value)}
            placeholder="Very good"
          />
        </label>
        <fieldset className="platform-picker">
          <legend>Platforms</legend>
          <div className="platform-options">
            {platformOptions.map((platform) => (
              <label key={platform}>
                <input
                  type="checkbox"
                  checked={form.platforms.includes(platform)}
                  onChange={() => togglePlatform(platform)}
                />
                <span>{platform}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          <span>Template</span>
          <select
            value={form.template_id}
            onChange={(event) => updateField('template_id', event.target.value)}
          >
            <option value="">No template</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Purchase date</span>
          <input
            type="date"
            value={form.purchase_date}
            onChange={(event) => updateField('purchase_date', event.target.value)}
          />
        </label>
        <label>
          <span>{currencyOptions[currencySettings.currency].symbol} Purchase price</span>
          <MoneyInput
            value={form.purchase_price}
            onValueChange={(value) => updateField('purchase_price', parseMoneyInput(value))}
            required
          />
        </label>
        <label>
          <span>
            {currencyOptions[currencySettings.currency].symbol} Shipping cost (seller to MYUS)
          </span>
          <MoneyInput
            value={form.seller_to_forwarder_cost}
            onValueChange={(value) =>
              updateField('seller_to_forwarder_cost', parseMoneyInput(value))
            }
          />
        </label>
        {initialItem?.lot_id ? (
          <label>
            <span>Allocated lot shipping</span>
            <input readOnly value={formatMoneyInput(initialItem?.lot_shipping_cost || 0)} />
            <small>Recalculated by physical quantity when saved.</small>
          </label>
        ) : null}
        <label>
          <span>{currencyOptions[currencySettings.currency].symbol} Final price</span>
          <input
            readOnly
            value={formatMoneyInput(
              Number(form.purchase_price || 0) +
                Number(form.seller_to_forwarder_cost || 0) +
                Number(initialItem?.inbound_cost || 0) +
                Number(initialItem?.lot_shipping_cost || 0),
            )}
          />
        </label>
        <label>
          <span>{currencyOptions[currencySettings.currency].symbol} Target sale price</span>
          <MoneyInput
            value={form.target_sale_price}
            onValueChange={(value) => updateField('target_sale_price', parseMoneyInput(value))}
            placeholder="Expected price"
          />
        </label>
        <label>
          <span>Sale date</span>
          <input
            type="date"
            value={form.sale_date}
            onChange={(event) => updateField('sale_date', event.target.value)}
          />
        </label>
        <label>
          <span>{currencyOptions[currencySettings.currency].symbol} Sale price</span>
          <MoneyInput
            value={form.sale_price}
            onValueChange={(value) => updateField('sale_price', parseMoneyInput(value))}
            placeholder="Leave blank until sold"
          />
        </label>
        <label>
          <span>
            {currencyOptions[currencySettings.currency].symbol} Sale costs (commission + shipping to
            buyer)
          </span>
          <MoneyInput
            value={form.selling_fees}
            onValueChange={(value) => updateField('selling_fees', parseMoneyInput(value))}
          />
        </label>
      </div>
      <label>
        <span>Additional notes</span>
        <textarea
          value={form.notes}
          onChange={(event) => updateField('notes', event.target.value)}
          placeholder="Anything worth remembering about this item..."
          rows={4}
        />
      </label>
      <p className="helper-text">
        Sale costs are the total amount you pay when selling: marketplace commission plus shipping
        to the buyer. Example: a 100 sale with 13% commission and 5 shipping means 18 in sale costs.
      </p>
      <div className="form__actions">
        <button type="button" className="button button--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button button--primary">
          {initialItem?.id ? 'Save item' : 'Add item'}
        </button>
      </div>
    </form>
  )
}

function createBlankLotItem() {
  return {
    name: '',
    quantity: 1,
    status: 'in_stock',
    item_type: '',
    condition: '',
    platforms: [],
    purchase_date: '',
    purchase_price: '',
    seller_to_forwarder_cost: 0,
    target_sale_price: '',
    sale_date: '',
    sale_price: '',
    selling_fees: 0,
    template_id: '',
    notes: '',
  }
}

export function LotFormV2({ templates, onSave, onCancel, dirtyRef }) {
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [commonFields, setCommonFields] = useState({
    purchase_date: '',
    status: '',
    item_type: '',
    condition: '',
    template_id: '',
    platforms: [],
    quantity: 1,
  })
  const [lotFields, setLotFields] = useState({
    status: 'in_stock',
    purchase_date: '',
    purchase_price: '',
    seller_to_forwarder_cost: 0,
    target_sale_price: '',
    sale_date: '',
    sale_price: '',
    selling_fees: 0,
    template_id: '',
  })
  const [items, setItems] = useState([createBlankLotItem()])
  const draft = JSON.stringify({ name, notes, commonFields, lotFields, items })
  const initialDraft = useRef(draft)
  const isDirty = draft !== initialDraft.current

  useEffect(() => {
    if (dirtyRef) dirtyRef.current = isDirty
    const warnBeforeLeaving = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    if (isDirty) window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => {
      if (dirtyRef) dirtyRef.current = false
      window.removeEventListener('beforeunload', warnBeforeLeaving)
    }
  }, [isDirty, dirtyRef])

  const previousAllocation = useRef({ purchase: [], target: [] })
  const shippingAllocation = allocateAmountByQuantities(
    lotFields.seller_to_forwarder_cost || 0,
    items.map((item) => item.quantity),
  )

  useEffect(() => {
    const purchaseAllocation = allocateAmountByQuantities(
      lotFields.purchase_price,
      items.map((item) => item.quantity),
    )
    const targetAllocation = allocateAmount(lotFields.target_sale_price, items.length)
    const canUpdate = (field, allocation) => {
      if (!allocation.length) {
        return false
      }

      const previous = previousAllocation.current[field]
      return items.every(
        (item, index) =>
          item[field === 'purchase' ? 'purchase_price' : 'target_sale_price'] === '' ||
          Number(item[field === 'purchase' ? 'purchase_price' : 'target_sale_price']) ===
            Number(previous[index]),
      )
    }

    if (purchaseAllocation.length || canUpdate('target', targetAllocation)) {
      setItems((current) =>
        current.map((item, index) => ({
          ...item,
          purchase_price: purchaseAllocation.length
            ? purchaseAllocation[index]
            : item.purchase_price,
          target_sale_price: canUpdate('target', targetAllocation)
            ? targetAllocation[index]
            : item.target_sale_price,
        })),
      )
    }

    previousAllocation.current = { purchase: purchaseAllocation, target: targetAllocation }
  }, [
    lotFields.purchase_price,
    lotFields.target_sale_price,
    items.length,
    items.map((item) => item.quantity).join(','),
  ])

  const updateItem = (index, field, value) =>
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    )
  const togglePlatform = (index, platform) =>
    updateItem(
      index,
      'platforms',
      items[index].platforms.includes(platform)
        ? items[index].platforms.filter((value) => value !== platform)
        : [...items[index].platforms, platform],
    )
  const toggleCommonPlatform = (platform) =>
    setCommonFields((current) => ({
      ...current,
      platforms: current.platforms.includes(platform)
        ? current.platforms.filter((value) => value !== platform)
        : [...current.platforms, platform],
    }))
  const applyCommonFields = () => {
    setLotFields((current) => ({
      ...current,
      purchase_date: commonFields.purchase_date || current.purchase_date,
      status: commonFields.status || current.status,
      template_id: commonFields.template_id || current.template_id,
    }))
    setItems((current) =>
      current.map((item) => ({
        ...item,
        quantity: Math.max(1, Number(commonFields.quantity) || 1),
        purchase_date: commonFields.purchase_date || item.purchase_date,
        status: commonFields.status || item.status,
        item_type: commonFields.item_type || item.item_type,
        condition: commonFields.condition || item.condition,
        template_id: commonFields.template_id || item.template_id,
        platforms: commonFields.platforms.length ? commonFields.platforms : item.platforms,
      })),
    )
  }
  const addItem = () =>
    setItems((current) => [
      ...current,
      {
        ...createBlankLotItem(),
        quantity: Math.max(1, Number(commonFields.quantity) || 1),
        purchase_date: commonFields.purchase_date,
        status: commonFields.status || 'in_stock',
        item_type: commonFields.item_type,
        condition: commonFields.condition,
        template_id: commonFields.template_id,
        platforms: commonFields.platforms,
      },
    ])
  const handleSubmit = (event) => {
    event.preventDefault()
    onSave({
      name: name.trim(),
      notes: notes.trim() || null,
      lotFields: {
        ...lotFields,
        purchase_date: lotFields.purchase_date || null,
        purchase_price: Number(
          (
            Number(lotFields.purchase_price) + Number(lotFields.seller_to_forwarder_cost || 0)
          ).toFixed(2),
        ),
        seller_to_forwarder_cost: Number(lotFields.seller_to_forwarder_cost) || 0,
        target_sale_price:
          lotFields.target_sale_price === '' ? null : Number(lotFields.target_sale_price),
        sale_date: lotFields.sale_date || null,
        sale_price: lotFields.sale_price === '' ? null : Number(lotFields.sale_price),
        selling_fees: Number(lotFields.selling_fees) || 0,
      },
      items: items.map((item, index) => ({
        ...item,
        name: item.name.trim(),
        quantity: Math.max(1, Number(item.quantity) || 1),
        item_type: item.item_type.trim() || null,
        condition: item.condition.trim() || null,
        purchase_date: item.purchase_date || null,
        purchase_price: Number(
          (
            Number(item.purchase_price) +
            Number(item.seller_to_forwarder_cost || 0) +
            Number(shippingAllocation[index] || 0)
          ).toFixed(2),
        ),
        final_price: Number(
          (
            Number(item.purchase_price) +
            Number(item.seller_to_forwarder_cost || 0) +
            Number(shippingAllocation[index] || 0)
          ).toFixed(2),
        ),
        lot_shipping_cost: Number(shippingAllocation[index] || 0),
        base_purchase_price: Number(item.purchase_price) || 0,
        seller_to_forwarder_cost: Number(item.seller_to_forwarder_cost) || 0,
        target_sale_price: item.target_sale_price === '' ? null : Number(item.target_sale_price),
        sale_date: item.sale_date || null,
        sale_price: item.sale_price === '' ? null : Number(item.sale_price),
        selling_fees: Number(item.selling_fees) || 0,
        template_id: item.template_id || null,
        notes: item.notes.trim() || null,
      })),
    })
  }

  return (
    <form className="form lot-entry-form" onSubmit={handleSubmit}>
      <label>
        <span>Lot name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Example: Mega Construx lot"
          required
        />
      </label>
      <label>
        <span>Lot notes</span>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
      </label>
      <fieldset className="lot-common-fields">
        <legend>Common values</legend>
        <p>Apply these values to all sub-items before saving. Each item can be edited later.</p>
        <div className="form-grid form-grid--wide">
          <label>
            <span>Purchase date</span>
            <input
              type="date"
              value={commonFields.purchase_date}
              onChange={(event) =>
                setCommonFields((current) => ({ ...current, purchase_date: event.target.value }))
              }
            />
          </label>
          <label>
            <span>Status</span>
            <select
              value={commonFields.status}
              onChange={(event) =>
                setCommonFields((current) => ({ ...current, status: event.target.value }))
              }
            >
              {' '}
              <option value="">Keep item values</option>
              <option value="kept">Kept</option>
              <option value="in_transit">In transit</option>
              <option value="in_stock">In stock</option>
              <option value="to_list">To list</option>
              <option value="listed">Listed</option>
              <option value="sold">Sold</option>
            </select>
          </label>
          <label>
            <span>Type</span>
            <input
              value={commonFields.item_type}
              onChange={(event) =>
                setCommonFields((current) => ({ ...current, item_type: event.target.value }))
              }
              placeholder="Clothing"
            />
          </label>
          <label>
            <span>Condition</span>
            <input
              value={commonFields.condition}
              onChange={(event) =>
                setCommonFields((current) => ({ ...current, condition: event.target.value }))
              }
              placeholder="Very good"
            />
          </label>
          <label>
            <span>Template</span>
            <select
              value={commonFields.template_id}
              onChange={(event) =>
                setCommonFields((current) => ({ ...current, template_id: event.target.value }))
              }
            >
              <option value="">Keep item values</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="platform-picker">
          <legend>Platforms</legend>
          <div className="platform-options">
            {platformOptions.map((platform) => (
              <label key={platform}>
                <input
                  type="checkbox"
                  checked={commonFields.platforms.includes(platform)}
                  onChange={() => toggleCommonPlatform(platform)}
                />
                <span>{platform}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button type="button" className="button button--ghost" onClick={applyCommonFields}>
          Apply to all items
        </button>
      </fieldset>{' '}
      <fieldset className="lot-pricing-fields">
        <legend>Lot details</legend>
        <div className="form-grid form-grid--wide">
          <label>
            <span>Lot status</span>{' '}
            <select
              value={lotFields.status}
              onChange={(event) =>
                setLotFields((current) => ({ ...current, status: event.target.value }))
              }
            >
              <option value="kept">Kept</option>
              <option value="in_transit">In transit</option>
              <option value="in_stock">In stock</option>
              <option value="to_list">To list</option>
              <option value="listed">Listed</option>
              <option value="sold">Sold</option>
            </select>
          </label>
          <label>
            <span>Purchase date</span>
            <input
              type="date"
              value={lotFields.purchase_date}
              onChange={(event) =>
                setLotFields((current) => ({ ...current, purchase_date: event.target.value }))
              }
            />
          </label>
          <label>
            <span>Purchase price</span>
            <MoneyInput
              value={lotFields.purchase_price}
              onValueChange={(value) =>
                setLotFields((current) => ({
                  ...current,
                  purchase_price: parseMoneyInput(value),
                }))
              }
              required
            />
          </label>
          <label>
            <span>Shipping cost (seller to MYUS)</span>
            <MoneyInput
              value={lotFields.seller_to_forwarder_cost}
              onValueChange={(value) =>
                setLotFields((current) => ({
                  ...current,
                  seller_to_forwarder_cost: parseMoneyInput(value),
                }))
              }
            />
            <small>Shared across the lot by physical quantity.</small>
          </label>
          <label>
            <span>Final price</span>
            <input
              readOnly
              value={formatMoneyInput(
                items.reduce(
                  (total, item) =>
                    total +
                    Number(item.purchase_price || 0) +
                    Number(item.seller_to_forwarder_cost || 0),
                  0,
                ) + Number(lotFields.seller_to_forwarder_cost || 0),
              )}
            />
          </label>
          <label>
            <span>Target sale price</span>
            <MoneyInput
              value={lotFields.target_sale_price}
              onValueChange={(value) =>
                setLotFields((current) => ({
                  ...current,
                  target_sale_price: parseMoneyInput(value),
                }))
              }
            />
          </label>
          <label>
            <span>Sale date</span>
            <input
              type="date"
              value={lotFields.sale_date}
              onChange={(event) =>
                setLotFields((current) => ({ ...current, sale_date: event.target.value }))
              }
            />
          </label>
          <label>
            <span>Sale price</span>
            <MoneyInput
              value={lotFields.sale_price}
              onValueChange={(value) =>
                setLotFields((current) => ({
                  ...current,
                  sale_price: parseMoneyInput(value),
                }))
              }
            />
          </label>
          <label>
            <span>Sale costs (commission + shipping to buyer)</span>
            <MoneyInput
              value={lotFields.selling_fees}
              onValueChange={(value) =>
                setLotFields((current) => ({
                  ...current,
                  selling_fees: parseMoneyInput(value),
                }))
              }
            />
          </label>
          <label>
            <span>Template</span>
            <select
              value={lotFields.template_id}
              onChange={(event) =>
                setLotFields((current) => ({ ...current, template_id: event.target.value }))
              }
            >
              <option value="">No template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>
      <div className="lot-form-items">
        <div className="lot-form-items__header">
          <div>
            <h3>Items in this lot</h3>
            <p>Minimise an item to keep the form compact.</p>
          </div>
        </div>
        {items.map((item, index) => (
          <details className="lot-item-form" open key={index}>
            <summary>
              Item {index + 1}: {item.name || 'Unnamed item'}
            </summary>
            <div className="form-grid form-grid--wide">
              {' '}
              <label>
                <span>Item name</span>
                <input
                  value={item.name}
                  onChange={(event) => updateItem(index, 'name', event.target.value)}
                  required
                />
              </label>
              <label>
                <span>Quantity</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={item.quantity}
                  onChange={(event) => updateItem(index, 'quantity', event.target.value)}
                  required
                />
              </label>{' '}
              <label>
                <span>Status</span>{' '}
                <select
                  value={item.status}
                  onChange={(event) => updateItem(index, 'status', event.target.value)}
                >
                  <option value="kept">Kept</option>
                  <option value="in_transit">In transit</option>
                  <option value="in_stock">In stock</option>
                  <option value="to_list">To list</option>
                  <option value="listed">Listed</option>
                  <option value="sold">Sold</option>
                </select>
              </label>
              <label>
                <span>Type</span>
                <input
                  value={item.item_type}
                  onChange={(event) => updateItem(index, 'item_type', event.target.value)}
                />
              </label>
              <label>
                <span>Condition</span>
                <input
                  value={item.condition}
                  onChange={(event) => updateItem(index, 'condition', event.target.value)}
                />
              </label>
              <label>
                <span>Purchase date</span>
                <input
                  type="date"
                  value={item.purchase_date}
                  onChange={(event) => updateItem(index, 'purchase_date', event.target.value)}
                />
              </label>
              <label>
                <span>Purchase price</span>
                <MoneyInput
                  value={item.purchase_price}
                  onValueChange={(value) =>
                    updateItem(index, 'purchase_price', parseMoneyInput(value))
                  }
                  required
                />
              </label>
              <label>
                <span>Allocated lot shipping</span>
                <input readOnly value={formatMoneyInput(shippingAllocation[index] || 0)} />
              </label>
              <label>
                <span>Final price</span>
                <input
                  readOnly
                  value={formatMoneyInput(
                    Number(item.purchase_price || 0) +
                      Number(item.seller_to_forwarder_cost || 0) +
                      Number(shippingAllocation[index] || 0),
                  )}
                />
              </label>
              <label>
                <span>Target sale price</span>
                <MoneyInput
                  value={item.target_sale_price}
                  onValueChange={(value) =>
                    updateItem(index, 'target_sale_price', parseMoneyInput(value))
                  }
                />
              </label>
              <label>
                <span>Template</span>
                <select
                  value={item.template_id}
                  onChange={(event) => updateItem(index, 'template_id', event.target.value)}
                >
                  <option value="">No template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <fieldset className="platform-picker">
              <legend>Platforms</legend>
              <div className="platform-options">
                {platformOptions.map((platform) => (
                  <label key={platform}>
                    <input
                      type="checkbox"
                      checked={item.platforms.includes(platform)}
                      onChange={() => togglePlatform(index, platform)}
                    />
                    <span>{platform}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label>
              <span>Item notes</span>
              <textarea
                value={item.notes}
                onChange={(event) => updateItem(index, 'notes', event.target.value)}
                rows={2}
              />
            </label>
            {items.length > 1 ? (
              <button
                type="button"
                className="button button--danger"
                onClick={() =>
                  setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
                }
              >
                Remove item
              </button>
            ) : null}
          </details>
        ))}
        <button
          type="button"
          className="button button--ghost lot-form-items__add"
          onClick={addItem}
        >
          + Add sub-item
        </button>
      </div>
      <div className="form__actions">
        <button type="button" className="button button--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button button--primary">
          Create lot
        </button>
      </div>
    </form>
  )
}

export function LotSettingsForm({ lot, templates, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({
    name: lot.name ?? '',
    status: lot.status ?? 'in_stock',
    template_id: lot.template_id ?? '',
    purchase_date: lot.purchase_date ?? '',
    purchase_price: Math.max(
      0,
      Number(lot.purchase_price || 0) - Number(lot.seller_to_forwarder_cost || 0),
    ),
    seller_to_forwarder_cost: lot.seller_to_forwarder_cost ?? 0,
    target_sale_price: lot.target_sale_price ?? '',
    sale_date: lot.sale_date ?? '',
    sale_price: lot.sale_price ?? '',
    selling_fees: lot.selling_fees ?? 0,
    notes: lot.notes ?? '',
  }))

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const handleSubmit = (event) => {
    event.preventDefault()
    onSave({
      ...lot,
      ...form,
      name: form.name.trim(),
      status: form.status,
      purchase_date: form.purchase_date || null,
      purchase_price: Number(
        (Number(form.purchase_price) + Number(form.seller_to_forwarder_cost || 0)).toFixed(2),
      ),
      seller_to_forwarder_cost: Number(form.seller_to_forwarder_cost) || 0,
      target_sale_price: form.target_sale_price === '' ? null : Number(form.target_sale_price),
      sale_date: form.sale_date || null,
      sale_price: form.sale_price === '' ? null : Number(form.sale_price),
      selling_fees: Number(form.selling_fees) || 0,
      template_id: form.template_id || null,
      notes: form.notes.trim() || null,
    })
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label>
        <span>Lot name</span>
        <input
          value={form.name}
          onChange={(event) => updateField('name', event.target.value)}
          required
        />
      </label>
      <label>
        <span>Status</span>{' '}
        <select value={form.status} onChange={(event) => updateField('status', event.target.value)}>
          <option value="kept">Kept</option>
          <option value="in_transit">In transit</option>
          <option value="in_stock">In stock</option>
          <option value="to_list">To list</option>
          <option value="listed">Listed</option>
          <option value="sold">Sold</option>
        </select>
      </label>
      <label>
        <span>Template</span>
        <select
          value={form.template_id}
          onChange={(event) => updateField('template_id', event.target.value)}
        >
          <option value="">No template</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </label>
      <div className="form-grid form-grid--wide">
        <label>
          <span>Purchase date</span>
          <input
            type="date"
            value={form.purchase_date}
            onChange={(event) => updateField('purchase_date', event.target.value)}
          />
        </label>{' '}
        <label>
          <span>Purchase price</span>
          <MoneyInput
            value={form.purchase_price}
            onValueChange={(value) => updateField('purchase_price', parseMoneyInput(value))}
            required
          />
        </label>
        <label>
          <span>
            {currencyOptions[currencySettings.currency].symbol} Shipping cost (seller to MYUS)
          </span>
          <MoneyInput
            value={form.seller_to_forwarder_cost}
            onValueChange={(value) =>
              updateField('seller_to_forwarder_cost', parseMoneyInput(value))
            }
          />
        </label>
        <label>
          <span>Final price</span>
          <input
            readOnly
            value={formatMoneyInput(
              Number(form.purchase_price || 0) + Number(form.seller_to_forwarder_cost || 0),
            )}
          />
        </label>
        <label>
          <span>Target sale price</span>
          <MoneyInput
            value={form.target_sale_price}
            onValueChange={(value) => updateField('target_sale_price', parseMoneyInput(value))}
          />
        </label>
        <label>
          <span>Sale date</span>
          <input
            type="date"
            value={form.sale_date}
            onChange={(event) => updateField('sale_date', event.target.value)}
          />
        </label>
        <label>
          <span>Sale price</span>
          <MoneyInput
            value={form.sale_price}
            onValueChange={(value) => updateField('sale_price', parseMoneyInput(value))}
          />
        </label>
        <label>
          <span>Sale costs (commission + shipping to buyer)</span>
          <MoneyInput
            value={form.selling_fees}
            onValueChange={(value) => updateField('selling_fees', parseMoneyInput(value))}
          />
        </label>
      </div>
      <label>
        <span>Lot notes</span>
        <textarea
          value={form.notes}
          onChange={(event) => updateField('notes', event.target.value)}
          rows={4}
        />
      </label>
      <div className="form__actions">
        <button type="button" className="button button--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button button--primary">
          Save lot
        </button>
      </div>
    </form>
  )
}
