import { useState } from 'react'
import { formatMoney, getItemRoi, getLotMetrics, getStatusLabel } from '../lib/workspace'

export function InventoryLotRow({
  lot,
  items,
  templates,
  matches,
  onDelete,
  onDuplicateLot,
  onEdit,
  onDuplicate,
  onGenerateLot,
  onEditLot,
  onGenerate,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const purchaseValue = items.reduce((total, item) => total + Number(item.purchase_price || 0), 0)
  const targetValue = items.reduce((total, item) => total + Number(item.target_sale_price || 0), 0)
  const linkedTemplate = templates.find((template) => template.id === lot.template_id)
  const metrics = getLotMetrics(items)

  return (
    <details
      className="inventory-tree__lot"
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary className="inventory-tree__row inventory-tree__row--lot">
        <span className="inventory-tree__name">
          <strong>{lot.name}</strong>
          <small>
            {metrics.itemCount} item{metrics.itemCount === 1 ? '' : 's'}
          </small>
        </span>
        <span className="inventory-tree__lot-status">
          <span className={`status-badge status-badge--${lot.status}`}>
            {getStatusLabel(lot.status)}
          </span>
          {metrics.statuses.map(({ status, count }) => (
            <span className={`status-badge status-badge--${status}`} key={status}>
              {getStatusLabel(status)}
              {count > 1 ? ` (${count})` : ''}
            </span>
          ))}
          {items.some((item) => ['to_list', 'listed', 'sold'].includes(item.status)) ? (
            <span className="status-badge status-badge--sold">
              {metrics.soldCount}/{metrics.itemCount} sold
            </span>
          ) : null}
        </span>
        <span>{formatMoney(lot.purchase_price ?? purchaseValue)} purchase</span>
        <span>{formatMoney(lot.target_sale_price ?? targetValue)} target</span>
        <span>{metrics.soldValue ? `${formatMoney(metrics.soldValue)} sold` : '—'}</span>
        <span
          className={metrics.roi !== null && metrics.roi < 0 ? 'value-negative' : 'value-positive'}
        >
          ROI {metrics.roi === null ? '—' : `${metrics.roi.toFixed(1)}%`}
        </span>
        <span className="table-actions">
          <button
            type="button"
            className="button button--primary"
            onClick={(event) => {
              event.preventDefault()
              onGenerateLot(lot, items, linkedTemplate)
            }}
            disabled={!linkedTemplate}
          >
            Generate
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={(event) => {
              event.preventDefault()
              onDuplicateLot(lot, items)
            }}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={(event) => {
              event.preventDefault()
              onEditLot(lot)
            }}
          >
            Edit
          </button>
          <button
            type="button"
            className="button button--danger"
            onClick={(event) => {
              event.preventDefault()
              onDelete(lot.id)
            }}
          >
            Delete
          </button>
        </span>
      </summary>
      <div className="lot-section__body">
        {lot.notes ? <p className="lot-section__notes">{lot.notes}</p> : null}
        <div className="lot-items-list">
          {items.filter(matches).map((item) => {
            const roi = getItemRoi(item)
            const itemTemplate = templates.find((template) => template.id === item.template_id)
            return (
              <article className="inventory-tree__row inventory-tree__row--item" key={item.id}>
                <span className="inventory-tree__name">
                  <strong>{item.name}</strong>
                  <small>
                    {item.item_type || 'Uncategorised'} · {item.condition || 'Condition not set'}
                  </small>
                </span>
                <span className={`status-badge status-badge--${item.status}`}>
                  {item.status.replace('_', ' ')}
                </span>
                <span>{formatMoney(item.purchase_price)} purchase</span>
                <span>
                  {item.target_sale_price === null ? '—' : formatMoney(item.target_sale_price)}{' '}
                  target
                </span>
                <span>{item.sale_price === null ? '—' : formatMoney(item.sale_price)} sold</span>
                <span className={roi !== null && roi < 0 ? 'value-negative' : 'value-positive'}>
                  ROI {roi === null ? '—' : `${roi.toFixed(1)}%`}
                </span>
                <span className="table-actions">
                  {itemTemplate ? (
                    <button
                      type="button"
                      className="button button--primary"
                      onClick={() => onGenerate(item, itemTemplate)}
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
                </span>
              </article>
            )
          })}
        </div>
      </div>
    </details>
  )
}
