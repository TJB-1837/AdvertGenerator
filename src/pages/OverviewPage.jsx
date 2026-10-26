import {
  formatMoney,
  isItemInStock,
  getItemProfit,
  getItemRoi,
  getItemPlatforms,
} from '../lib/workspace'

function ComparisonBarChart({ invested, recovered, potential, items }) {
  const futureRevenue = recovered + potential
  const maximum = Math.max(invested, futureRevenue, 1)
  const recoveredWidth = (recovered / maximum) * 100
  const potentialWidth = (potential / maximum) * 100
  const statusSegments = ['kept', 'sold', 'listed', 'to_list', 'in_stock', 'in_transit'].map(
    (status) => ({
      status,
      value: items
        .filter((item) => item.status === status)
        .reduce((total, item) => total + Number(item.purchase_price || 0), 0),
    }),
  )
  const statusLabels = {
    kept: 'Kept',
    sold: 'Sold',
    listed: 'Listed',
    to_list: 'To list',
    in_stock: 'In stock',
    in_transit: 'In transit',
  }
  return (
    <div
      className="comparison-chart"
      role="img"
      aria-label={`Money spent ${formatMoney(invested)}, realised revenue ${formatMoney(recovered)}, and potential resale value ${formatMoney(potential)}`}
    >
      <div className="comparison-chart__row">
        <div className="comparison-chart__label">
          <span>Money spent</span>
          <strong>{formatMoney(invested)}</strong>
        </div>
        <div className="comparison-chart__track">
          {statusSegments.map(({ status, value }) => (
            <i
              className={`comparison-chart__segment comparison-chart__segment--${status}`}
              key={status}
              style={{ width: `${invested > 0 ? (value / maximum) * 100 : 0}%` }}
              title={`${statusLabels[status]}: ${formatMoney(value)} (${invested > 0 ? ((value / invested) * 100).toFixed(1) : '0.0'}%)`}
            />
          ))}
        </div>
        <div className="comparison-chart__legend comparison-chart__legend--spent">
          {statusSegments.map(({ status, value }) => (
            <span key={status}>
              <i
                className={`comparison-chart__legend-swatch comparison-chart__legend-swatch--${status}`}
                aria-hidden="true"
              />
              {statusLabels[status]} {formatMoney(value)} ·{' '}
              {invested > 0 ? ((value / invested) * 100).toFixed(1) : '0.0'}%
            </span>
          ))}
        </div>
      </div>
      <div className="comparison-chart__row">
        <div className="comparison-chart__label">
          <span>Revenue realised + resale potential</span>
          <strong>{formatMoney(futureRevenue)}</strong>
        </div>
        <div className="comparison-chart__track comparison-chart__track--stacked">
          <i
            className="comparison-chart__segment comparison-chart__segment--recovered"
            style={{ width: `${recoveredWidth}%` }}
          />
          <i
            className="comparison-chart__segment comparison-chart__segment--potential"
            style={{ width: `${potentialWidth}%` }}
          />
        </div>
        <div className="comparison-chart__legend">
          <span>
            <i className="comparison-chart__legend-swatch comparison-chart__legend-swatch--recovered" aria-hidden="true" />
            Realised {formatMoney(recovered)}
          </span>
          <span>
            <i className="comparison-chart__legend-swatch comparison-chart__legend-swatch--potential" aria-hidden="true" />
            Potential {formatMoney(potential)}
          </span>
        </div>
      </div>
    </div>
  )
}

function InventoryValueChart({ items }) {
  const categories = [
    { key: 'kept', label: 'Kept', color: '#b0413e', value: 0 },
    { key: 'resale', label: 'To resell', color: '#ffcb47', value: 0 },
    { key: 'sold', label: 'Sold', color: '#6a994e', value: 0 },
  ]
  for (const item of items) {
    const category = item.status === 'kept' ? 0 : item.status === 'sold' ? 2 : 1
    categories[category].value += Math.max(0, Number(item.purchase_price) || 0)
  }
  const total = categories.reduce((sum, category) => sum + category.value, 0)
  const circumference = 2 * Math.PI * 64
  let offset = 0

  return (
    <div className="inventory-value-chart">
      <div className="inventory-value-chart__visual">
        <svg viewBox="0 0 180 180" role="img" aria-label={
          total > 0
            ? categories.map((category) => category.label + ': ' + formatMoney(category.value)).join(', ')
            : 'No purchase value recorded yet'
        }>
          <circle cx="90" cy="90" r="64" fill="none" stroke="#eee7e9" strokeWidth="28" />
          {total > 0 ? categories.map((category) => {
            const length = category.value / total * circumference
            const start = offset
            offset += length
            return category.value > 0 ? (
              <circle key={category.key} cx="90" cy="90" r="64" fill="none"
                stroke={category.color} strokeWidth="28"
                strokeDasharray={length + ' ' + circumference}
                strokeDashoffset={-start} transform="rotate(-90 90 90)" />
            ) : null
          }) : null}
        </svg>
        <div className="inventory-value-chart__total" aria-hidden="true">
          <span>Purchase value</span>
          <strong>{formatMoney(total)}</strong>
        </div>
      </div>
      <div className="inventory-value-chart__details">
        <div className="inventory-value-chart__legend">
          {categories.map((category) => (
            <div className="inventory-value-chart__entry" key={category.key}>
              <span><i style={{ background: category.color }} aria-hidden="true" />{category.label}</span>
              <strong>{formatMoney(category.value)}</strong>
              <small>{total > 0 ? (category.value / total * 100).toFixed(1) : '0.0'}%</small>
            </div>
          ))}
        </div>
        <p className="inventory-value-chart__note">
          {total > 0 ? 'Purchase costs, including acquisition fees. To resell includes items in transit.' : 'Add purchase values to see how your investment is distributed.'}
        </p>
      </div>
    </div>
  )
}

export function OverviewPage({ items, templates, onOpenTemplates, onOpenInventory }) {
  const soldItems = items.filter((item) => item.status === 'sold')
  const stockItems = items.filter(isItemInStock)
  const investedValue = items.reduce((total, item) => total + Number(item.purchase_price || 0), 0)
  const stockValue = stockItems.reduce(
    (total, item) => total + Number(item.target_sale_price || 0),
    0,
  )
  const realisedSales = soldItems.reduce((total, item) => total + Number(item.sale_price || 0), 0)
  const realisedProfit = soldItems.reduce((total, item) => total + (getItemProfit(item) || 0), 0)
  const soldCost = soldItems.reduce((total, item) => total + Number(item.purchase_price || 0), 0)
  const roi = soldCost > 0 ? (realisedProfit / soldCost) * 100 : null
  const platforms = Array.from(new Set(items.flatMap((item) => getItemPlatforms(item))))
  const platformStats = platforms.map((platform) => {
    const platformItems = items.filter((item) => getItemPlatforms(item).includes(platform))
    const platformSold = platformItems.filter((item) => item.status === 'sold')
    return {
      platform,
      count: platformItems.length,
      sold: platformSold.length,
      sales: platformSold.reduce((total, item) => total + Number(item.sale_price || 0), 0),
    }
  })
  const statusStats = [
    { label: 'Kept', status: 'kept', color: '#b0413e' },
    { label: 'In stock', status: 'in_stock', color: '#72a7d1' },
    { label: 'To list', status: 'to_list', color: '#d8aa35' },
    { label: 'Listed', status: 'listed', color: '#8f78a8' },
    { label: 'In transit', status: 'in_transit', color: '#ffcb47' },
    { label: 'Sold', status: 'sold', color: '#6a994e' },
  ].map((entry) => ({
    ...entry,
    value: items.filter((item) => item.status === entry.status).length,
  }))
  const statusMax = Math.max(...statusStats.map((entry) => entry.value), 1)
  const recentItems = [...items]
    .filter((item) => item.status === 'sold')
    .sort(
      (a, b) =>
        new Date(b.sale_date || b.updated_at || b.created_at).getTime() -
        new Date(a.sale_date || a.updated_at || a.created_at).getTime(),
    )
    .slice(0, 5)

  return (
    <section className="overview-page">
      <div className="overview-heading">
        <div>
          <p className="eyebrow">Workspace overview</p>
          <h2>Seller performance and inventory overview</h2>
          <p>One clear view of your stock, templates, and realised sales.</p>
        </div>
        <div className="overview-actions">
          <button type="button" className="button button--ghost" onClick={onOpenTemplates}>
            Manage templates
          </button>
          <button type="button" className="button button--primary" onClick={onOpenInventory}>
            Open inventory
          </button>
        </div>
      </div>

      <div className="overview-metrics" aria-label="Workspace metrics">
        <div>
          <span>Templates</span>
          <strong>{templates.length}</strong>
          <small>Reusable blueprints</small>
        </div>
        <div>
          <span>Items in stock</span>
          <strong>{stockItems.length}</strong>
          <small>{items.length} recorded overall</small>
        </div>
        <div>
          <span>Stock potential</span>
          <strong>{formatMoney(stockValue)}</strong>
          <small>Target sale value</small>
        </div>
        <div>
          <span>Realised sales</span>
          <strong>{formatMoney(realisedSales)}</strong>
          <small>{soldItems.length} sold items</small>
        </div>
        <div>
          <span>Realised ROI</span>
          <strong>{roi === null ? '—' : `${roi.toFixed(1)}%`}</strong>
          <small>{formatMoney(realisedProfit)} profit</small>
        </div>
      </div>

      <div className="overview-columns">
        <section className="overview-section">
          <div className="overview-section__heading">
            <div>
              <p className="eyebrow">Sales channels</p>
              <h3>Marketplace performance</h3>
            </div>
            <span>{formatMoney(realisedSales)} total sales</span>
          </div>
          {platformStats.length > 0 ? (
            <div className="platform-performance">
              {platformStats.map((entry) => (
                <div className="platform-performance__row" key={entry.platform}>
                  <strong>{entry.platform}</strong>
                  <span>
                    {entry.count} items · {entry.sold} sold
                  </span>
                  <b>{formatMoney(entry.sales)}</b>
                </div>
              ))}
            </div>
          ) : (
            <p className="overview-empty">
              Add platforms to inventory items to see channel performance.
            </p>
          )}
        </section>

        <section className="overview-section overview-section--status">
          <div className="overview-section__heading">
            <div>
              <p className="eyebrow">Stock flow</p>
              <h3>Inventory by status</h3>
            </div>
            <span>{items.length} items</span>
          </div>
          <div className="status-chart">
            {statusStats.map((entry) => (
              <div className="status-chart__row" key={entry.status}>
                <span>
                  <i className="status-chart__swatch" style={{ background: entry.color }} aria-hidden="true" />
                  {entry.label}
                </span>
                <div className="status-chart__track">
                  <i
                    style={{
                      width: `${(entry.value / statusMax) * 100}%`,
                      background: entry.color,
                    }}
                  />
                </div>
                <strong>{entry.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="overview-section overview-section--workflow">
          <div className="overview-section__heading">
            <div>
              <p className="eyebrow">Listing workflow</p>
              <h3>Keep the next action visible</h3>
            </div>
          </div>
          <div className="workflow-list">
            <button type="button" onClick={onOpenTemplates}>
              <span>
                <b>{templates.length}</b> templates ready to reuse
              </span>
              <strong>Templates →</strong>
            </button>
            <button type="button" onClick={onOpenInventory}>
              <span>
                <b>{items.filter((item) => item.status === 'to_list').length}</b> items waiting to
                list
              </span>
              <strong>Inventory →</strong>
            </button>
            <div>
              <span>
                <b>{formatMoney(investedValue)}</b> invested in recorded stock
              </span>
              <small>Based on purchase prices</small>
            </div>
          </div>
        </section>
      </div>

      <div className="overview-charts">
        <section className="overview-section chart-section">
          <div className="overview-section__heading">
            <div>
              <p className="eyebrow">Cash flow</p>
              <h3>Money spent vs recovered</h3>
            </div>
          </div>
          <ComparisonBarChart
            invested={investedValue}
            recovered={realisedSales}
            potential={stockValue}
            items={items}
          />
        </section>

        <section className="overview-section chart-section">
          <div className="overview-section__heading">
            <div>
              <p className="eyebrow">Invested capital</p>
              <h3>Purchase value breakdown</h3>
            </div>
          </div>
          <InventoryValueChart items={items} />
        </section>
      </div>

      <section className="overview-section overview-section--activity">
        <div className="overview-section__heading">
          <div>
            <p className="eyebrow">Recent activity</p>
            <h3>Latest completed sales</h3>
          </div>
          <button type="button" className="button button--ghost" onClick={onOpenInventory}>
            View inventory
          </button>
        </div>
        {recentItems.length > 0 ? (
          <div className="activity-table">
            <div className="activity-table__header">
              <span>Item</span>
              <span>Sale date</span>
              <span>Sale price</span>
              <span>Profit</span>
              <span>ROI</span>
            </div>
            {recentItems.map((item) => (
              <div className="activity-table__row" key={item.id}>
                <strong>{item.name}</strong>
                <span>{item.sale_date || 'Date not set'}</span>
                <span>{formatMoney(item.sale_price)}</span>
                <b className={(getItemProfit(item) || 0) < 0 ? 'value-negative' : 'value-positive'}>
                  {formatMoney(getItemProfit(item))}
                </b>
                <span>{getItemRoi(item) === null ? '—' : `${getItemRoi(item).toFixed(1)}%`}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="overview-empty">
            Completed sales will appear here once an inventory item is marked as sold.
          </p>
        )}
      </section>
    </section>
  )
}
