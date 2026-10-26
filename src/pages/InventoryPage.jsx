import { useState } from 'react'
import {
  formatMoney,
  formatDate,
  isItemInStock,
  getItemProfit,
  getItemRoi,
  getShipmentTotal,
  getItemPlatforms,
} from '../lib/workspace'
import { InventoryLotRow } from '../components/InventoryLotRow'

export function InventoryPage({
  items,
  lots,
  templates,
  shipments,
  allocations,
  dateFormat,
  onCreate,
  onCreateLot,
  onCreateShipment,
  onEdit,
  onEditLot,
  onDelete,
  onDuplicate,
  onDuplicateLot,
  onDeleteLot,
  onDeleteShipment,
  onGenerate,
  onGenerateLot,
}) {
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('purchase_date')
  const [sortDirection, setSortDirection] = useState('desc')
  const totalPurchase = items.reduce((total, item) => total + Number(item.purchase_price || 0), 0)
  const stockItems = items.filter(isItemInStock)
  const targetValue = stockItems.reduce(
    (total, item) => total + Number(item.target_sale_price || 0),
    0,
  )
  const soldItems = items.filter((item) => item.status === 'sold')
  const realisedSales = soldItems.reduce((total, item) => total + Number(item.sale_price || 0), 0)
  const realisedProfit = soldItems.reduce((total, item) => total + (getItemProfit(item) || 0), 0)
  const soldPurchaseValue = soldItems.reduce(
    (total, item) => total + Number(item.purchase_price || 0),
    0,
  )
  const realisedRoi = soldPurchaseValue > 0 ? (realisedProfit / soldPurchaseValue) * 100 : null
  const matchesItem = (item) => {
    const matchesFilter = filter === 'all' || item.status === filter
    const matchesQuery =
      !query.trim() ||
      `${item.name} ${item.item_type ?? ''} ${getItemPlatforms(item).join(' ')}`
        .toLowerCase()
        .includes(query.trim().toLowerCase())
    return matchesFilter && matchesQuery
  }
  const standaloneItems = items.filter((item) => !item.lot_id && matchesItem(item))
  const visibleLots = lots
    .map((lot) => {
      const lotItems = items.filter((item) => item.lot_id === lot.id)
      const matchesLot = filter === 'all' || lotItems.some((item) => item.status === filter)
      const matchesSearch =
        !query.trim() ||
        `${lot.name} ${lot.notes ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()) ||
        lotItems.some((item) => matchesItem(item))
      return { lot, items: lotItems, visible: matchesLot && matchesSearch }
    })
    .filter(({ visible }) => visible)
  const visibleCount = standaloneItems.length + visibleLots.length
  const getLotPurchaseValue = (lot, lotItems) =>
    lot.purchase_price ??
    lotItems.reduce((total, item) => total + Number(item.purchase_price || 0), 0)
  const getLotPurchaseDate = (lot, lotItems) =>
    lot.purchase_date ??
    lotItems
      .map((item) => item.purchase_date)
      .filter(Boolean)
      .sort()[0] ??
    ''
  const compareEntries = (first, second) => {
    let firstValue
    let secondValue

    if (sortBy === 'name') {
      firstValue = first.name.toLowerCase()
      secondValue = second.name.toLowerCase()
    } else if (sortBy === 'purchase_price') {
      firstValue = first.purchaseValue
      secondValue = second.purchaseValue
    } else {
      firstValue = first.purchaseDate
      secondValue = second.purchaseDate
    }

    if (firstValue === secondValue) {
      return first.name.localeCompare(second.name)
    }

    if (sortBy === 'purchase_date' && (!firstValue || !secondValue)) {
      return !firstValue ? 1 : -1
    }

    const comparison = firstValue < secondValue ? -1 : 1
    return sortDirection === 'asc' ? comparison : -comparison
  }
  const sortedEntries = [
    ...visibleLots.map(({ lot, items: lotItems }) => ({
      type: 'lot',
      key: lot.id,
      name: lot.name,
      purchaseDate: getLotPurchaseDate(lot, lotItems),
      purchaseValue: getLotPurchaseValue(lot, lotItems),
      lot,
      items: lotItems,
    })),
    ...standaloneItems.map((item) => ({
      type: 'item',
      key: item.id,
      name: item.name,
      purchaseDate: item.purchase_date ?? '',
      purchaseValue: Number(item.purchase_price || 0),
      item,
    })),
  ].sort(compareEntries)
  const sortDirectionLabel =
    sortBy === 'purchase_date'
      ? sortDirection === 'asc'
        ? 'Oldest first'
        : 'Newest first'
      : sortBy === 'purchase_price'
        ? sortDirection === 'asc'
          ? 'Lowest first'
          : 'Highest first'
        : sortDirection === 'asc'
          ? 'A-Z'
          : 'Z-A'
  return (
    <section className="inventory-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Inventory</p>
          <h2>Know what you own. Know what it earns.</h2>
          <p className="topbar__subtitle">
            Track every item from purchase to sale, with your listing workflow close at hand.
          </p>
        </div>
        <div className="page-heading__actions">
          <button
            type="button"
            className="button button--ghost button--large"
            onClick={onCreateShipment}
          >
            + Import shipment
          </button>
          <button
            type="button"
            className="button button--ghost button--large"
            onClick={onCreateLot}
          >
            + Add lot
          </button>
          <button type="button" className="button button--primary button--large" onClick={onCreate}>
            + Add item
          </button>
        </div>
      </div>
      <section className="stats-row stats-row--inventory">
        <div className="stat-card">
          <span>Items</span>
          <strong>{items.length}</strong>
          <small>{stockItems.length} in stock</small>
        </div>
        <div className="stat-card">
          <span>Purchase value</span>
          <strong>{formatMoney(totalPurchase)}</strong>
          <small>All recorded items</small>
        </div>
        <div className="stat-card">
          <span>Target sale value</span>
          <strong>{formatMoney(targetValue)}</strong>
          <small>Current stock only</small>
        </div>
        <div className="stat-card">
          <span>Realised sales</span>
          <strong>{formatMoney(realisedSales)}</strong>
          <small>{soldItems.length} sold</small>
        </div>
        <div className="stat-card">
          <span>Realised ROI</span>
          <strong>{realisedRoi === null ? '—' : `${realisedRoi.toFixed(1)}%`}</strong>
          <small>{formatMoney(realisedProfit)} profit</small>
        </div>
      </section>
      <section className="inventory-toolbar">
        <div className="inventory-filters" role="group" aria-label="Filter inventory">
          <button
            type="button"
            className={`filter-button ${filter === 'all' ? 'filter-button--active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All <span>{items.length}</span>
          </button>
          <button
            type="button"
            className={`filter-button ${filter === 'kept' ? 'filter-button--active' : ''}`}
            onClick={() => setFilter('kept')}
          >
            Kept
          </button>
          <button
            type="button"
            className={`filter-button ${filter === 'in_transit' ? 'filter-button--active' : ''}`}
            onClick={() => setFilter('in_transit')}
          >
            In transit
          </button>
          <button
            type="button"
            className={`filter-button ${filter === 'in_stock' ? 'filter-button--active' : ''}`}
            onClick={() => setFilter('in_stock')}
          >
            In stock
          </button>
          <button
            type="button"
            className={`filter-button ${filter === 'to_list' ? 'filter-button--active' : ''}`}
            onClick={() => setFilter('to_list')}
          >
            To list
          </button>
          <button
            type="button"
            className={`filter-button ${filter === 'listed' ? 'filter-button--active' : ''}`}
            onClick={() => setFilter('listed')}
          >
            Listed
          </button>
          <button
            type="button"
            className={`filter-button ${filter === 'sold' ? 'filter-button--active' : ''}`}
            onClick={() => setFilter('sold')}
          >
            Sold
          </button>
        </div>
        <div className="inventory-toolbar__controls">
          <label>
            <span>Sort by</span>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="purchase_date">Purchase date</option>
              <option value="purchase_price">Purchase price</option>
              <option value="name">Name</option>
            </select>
          </label>
          <button
            type="button"
            className="filter-button"
            onClick={() => setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}
            aria-label={`Sort ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}
          >
            {sortDirectionLabel}
          </button>
          <input
            className="inventory-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search inventory..."
            aria-label="Search inventory"
          />
        </div>
      </section>
      {shipments.length > 0 ? (
        <section className="shipment-history">
          <div className="section-label">
            <span>Import shipments</span>
            <small>{shipments.length} recorded</small>
          </div>
          {shipments.map((shipment) => (
            <article className="shipment-history__row" key={shipment.id}>
              <div>
                <strong>{shipment.name}</strong>
                <small>
                  {formatDate(shipment.shipment_date, dateFormat)} ·{' '}
                  {
                    allocations.filter((allocation) => allocation.shipment_id === shipment.id)
                      .length
                  }{' '}
                  item lines
                </small>
              </div>
              <span>{formatMoney(getShipmentTotal(shipment))} allocated</span>
              <button
                type="button"
                className="button button--danger"
                onClick={() => onDeleteShipment(shipment.id)}
              >
                Delete
              </button>
            </article>
          ))}
        </section>
      ) : null}
      {visibleCount > 0 ? (
        <section className="inventory-tree">
          {sortedEntries.map((entry) =>
            entry.type === 'lot'
              ? (() => {
                  const lotNameMatches =
                    query.trim() &&
                    entry.lot.name.toLowerCase().includes(query.trim().toLowerCase())
                  return (
                    <InventoryLotRow
                      key={entry.key}
                      lot={entry.lot}
                      items={entry.items}
                      matches={(item) =>
                        lotNameMatches
                          ? filter === 'all' || item.status === filter
                          : matchesItem(item)
                      }
                      templates={templates}
                      onDelete={onDeleteLot}
                      onDuplicateLot={onDuplicateLot}
                      onEdit={onEdit}
                      onEditLot={onEditLot}
                      onDuplicate={onDuplicate}
                      onGenerate={onGenerate}
                      onGenerateLot={onGenerateLot}
                    />
                  )
                })()
              : (() => {
                  const item = entry.item
                  const roi = getItemRoi(item)
                  const linkedTemplate = templates.find(
                    (template) => template.id === item.template_id,
                  )
                  return (
                    <article
                      className="inventory-tree__row inventory-tree__row--standalone"
                      key={entry.key}
                    >
                      <span className="inventory-tree__name">
                        <strong>{item.name}</strong>
                        <small>
                          {item.item_type || 'Uncategorised'} ·{' '}
                          {item.condition || 'Condition not set'}
                        </small>
                      </span>
                      <span className={`status-badge status-badge--${item.status}`}>
                        {item.status.replace('_', ' ')}
                      </span>
                      <span>{formatMoney(item.purchase_price)} purchase</span>
                      <span>
                        {item.target_sale_price === null
                          ? '—'
                          : formatMoney(item.target_sale_price)}{' '}
                        target
                      </span>
                      <span>
                        {item.sale_price === null ? '—' : formatMoney(item.sale_price)} sold
                      </span>
                      <span
                        className={roi !== null && roi < 0 ? 'value-negative' : 'value-positive'}
                      >
                        ROI {roi === null ? '—' : `${roi.toFixed(1)}%`}
                      </span>
                      <span className="table-actions">
                        {linkedTemplate ? (
                          <button
                            type="button"
                            className="button button--primary"
                            onClick={() => onGenerate(item, linkedTemplate)}
                          >
                            Generate
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="button button--ghost"
                          onClick={() => onEdit(item)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="button button--ghost"
                          onClick={() => onDuplicate(item)}
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          className="button button--danger"
                          onClick={() => onDelete(item.id)}
                        >
                          Delete
                        </button>
                      </span>
                    </article>
                  )
                })(),
          )}
        </section>
      ) : (
        <section className="empty-state">
          <h2>{items.length === 0 ? 'Your inventory is empty' : 'No items match your view'}</h2>
          <p>
            {items.length === 0
              ? 'Add your first item to start tracking stock and profitability.'
              : 'Try another filter or search term.'}
          </p>
          {items.length === 0 ? (
            <button type="button" className="button button--primary" onClick={onCreate}>
              Add your first item
            </button>
          ) : null}
        </section>
      )}
    </section>
  )
}
