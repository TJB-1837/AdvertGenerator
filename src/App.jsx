import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import {
  normalizeTemplate,
  currencyOptions,
  fallbackCurrencyRates,
  setCurrencySettings,
  extractVariables,
  variableKey,
  getGeneratorValues,
  getLotGeneratorValues,
} from './lib/workspace'
import { AccountPanel } from './components/Account'
import { FeedbackPanel } from './components/FeedbackPanel'
import { Footer, LegalPage, FaqPage, PricingPage, LandingPage } from './pages/PublicPages'
import { TemplateCard } from './components/Templates'
import { Modal } from './components/Modal'
import { TemplateForm, CrossVariablesPanel, GeneratorPanel } from './components/TemplateForms'
import { InventoryForm, LotFormV2, LotSettingsForm } from './components/InventoryForms'
import { ShipmentPage } from './pages/ShipmentPage'
import { OverviewPage } from './pages/OverviewPage'
import { InventoryPage } from './pages/InventoryPage'

function App() {
  const [session, setSession] = useState(null)
  const [templates, setTemplates] = useState([])
  const [crossVariables, setCrossVariables] = useState([])
  const [inventoryItems, setInventoryItems] = useState([])
  const [inventoryLots, setInventoryLots] = useState([])
  const [inventoryShipments, setInventoryShipments] = useState([])
  const [shipmentAllocations, setShipmentAllocations] = useState([])
  const [activeView, setActiveView] = useState('overview')
  const [showLanding, setShowLanding] = useState(false)
  const [templateQuery, setTemplateQuery] = useState('')
  const [editorTemplate, setEditorTemplate] = useState(null)
  const [generatorTemplate, setGeneratorTemplate] = useState(null)
  const [inventoryEditor, setInventoryEditor] = useState(null)
  const [lotEditor, setLotEditor] = useState(null)
  const [shipmentEditor, setShipmentEditor] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [activeLegalPage, setActiveLegalPage] = useState(null)
  const [showFaqPage, setShowFaqPage] = useState(false)
  const [showPricingPage, setShowPricingPage] = useState(false)
  const [showAccountPage, setShowAccountPage] = useState(false)
  const [showCrossVariables, setShowCrossVariables] = useState(false)
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY')
  const [currency, setCurrency] = useState('EUR')
  const [currencyRates, setCurrencyRates] = useState(fallbackCurrencyRates)
  const [editorDirty, setEditorDirty] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  setCurrencySettings(currency, currencyRates)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session)
        setIsLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsLoading(false)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user) {
      setDateFormat('DD/MM/YYYY')
      setCurrency('EUR')
      setTemplates([])
      setCrossVariables([])
      setInventoryItems([])
      setInventoryLots([])
      setInventoryShipments([])
      setShipmentAllocations([])
      return
    }

    const savedDateFormat = window.localStorage.getItem(`adrafteo.dateFormat.${session.user.id}`)
    if (savedDateFormat && ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].includes(savedDateFormat)) {
      setDateFormat(savedDateFormat)
    }
    const savedCurrency = window.localStorage.getItem(`adrafteo.currency.${session.user.id}`)
    if (savedCurrency && Object.prototype.hasOwnProperty.call(currencyOptions, savedCurrency)) {
      setCurrency(savedCurrency)
    }
    fetch('https://api.frankfurter.app/latest?from=EUR&to=GBP,USD')
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error('Currency rates unavailable')),
      )
      .then((data) => setCurrencyRates({ ...fallbackCurrencyRates, ...(data.rates ?? {}) }))
      .catch(() => setCurrencyRates(fallbackCurrencyRates))

    const loadUserTemplates = async () => {
      setError('')
      const { data, error: loadError } = await supabase
        .from('templates')
        .select('*')
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false })

      if (loadError) {
        setError(loadError.message)
        return
      }

      setTemplates(data ?? [])
    }

    loadUserTemplates()

    const loadCrossVariables = async () => {
      const { data, error: loadError } = await supabase
        .from('cross_variables')
        .select('*')
        .eq('user_id', session.user.id)
        .order('variable_name', { ascending: true })

      if (loadError) {
        setError(loadError.message)
        return
      }

      setCrossVariables(data ?? [])
    }

    loadCrossVariables()

    const loadInventory = async () => {
      const { data, error: loadError } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (loadError) {
        setError(loadError.message)
        return
      }

      setInventoryItems(data ?? [])
    }

    loadInventory()

    const loadInventoryLots = async () => {
      const { data, error: loadError } = await supabase
        .from('inventory_lots')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (loadError) {
        setError(loadError.message)
        return
      }

      setInventoryLots(data ?? [])
    }

    loadInventoryLots()

    const loadShipments = async () => {
      const { data, error: loadError } = await supabase
        .from('inventory_shipments')
        .select('*')
        .eq('user_id', session.user.id)
        .order('shipment_date', { ascending: false })
      if (loadError) {
        setError(loadError.message)
        return
      }
      setInventoryShipments(data ?? [])
    }

    const loadShipmentAllocations = async () => {
      const { data, error: loadError } = await supabase
        .from('inventory_shipment_allocations')
        .select('*')
      if (loadError) {
        setError(loadError.message)
        return
      }
      setShipmentAllocations(data ?? [])
    }

    loadShipments()
    loadShipmentAllocations()
  }, [session])

  const handleSaveTemplate = async (draft) => {
    const normalized = normalizeTemplate(draft)

    if (!session?.user || !normalized.name || !normalized.title || !normalized.content) {
      return
    }

    const payload = {
      name: normalized.name,
      title: normalized.title,
      content: normalized.content,
    }
    const query = normalized.id
      ? supabase
          .from('templates')
          .update(payload)
          .eq('id', normalized.id)
          .eq('user_id', session.user.id)
          .select()
          .single()
      : supabase
          .from('templates')
          .insert({ ...payload, user_id: session.user.id })
          .select()
          .single()
    const { data, error: saveError } = await query

    if (saveError) {
      setError(saveError.message)
      return
    }

    setTemplates((current) =>
      normalized.id
        ? current.map((template) => (template.id === data.id ? data : template))
        : [data, ...current],
    )

    setEditorDirty(false)
    setEditorTemplate(null)
  }

  const handleCloseEditor = () => {
    if (
      editorDirty &&
      !window.confirm(
        'Are you sure you want to quit this window? Your unsaved changes will be lost.',
      )
    ) {
      return
    }

    setEditorDirty(false)
    setEditorTemplate(null)
  }

  const handleDeleteTemplate = async (id) => {
    const { error: deleteError } = await supabase
      .from('templates')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setTemplates((current) => current.filter((template) => template.id !== id))
  }

  const handleDuplicateTemplate = async (template) => {
    const { id, created_at, updated_at, ...copy } = template
    const { data, error: duplicateError } = await supabase
      .from('templates')
      .insert({ ...copy, name: `${template.name} (copy)`, user_id: session.user.id })
      .select()
      .single()

    if (duplicateError) {
      setError(duplicateError.message)
      return
    }

    setTemplates((current) => [data, ...current])
  }

  const handleSaveCrossVariables = async (rows) => {
    const currentIds = crossVariables
      .filter((variable) => variable.id && !rows.some((row) => row.id === variable.id))
      .map((variable) => variable.id)

    if (currentIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('cross_variables')
        .delete()
        .in('id', currentIds)
        .eq('user_id', session.user.id)
      if (deleteError) {
        setError(deleteError.message)
        return
      }
    }

    for (const row of rows) {
      const query = row.id
        ? supabase
            .from('cross_variables')
            .update({ variable_name: row.variable_name, default_value: row.default_value })
            .eq('id', row.id)
            .eq('user_id', session.user.id)
            .select()
            .single()
        : supabase
            .from('cross_variables')
            .insert({
              user_id: session.user.id,
              variable_name: row.variable_name,
              default_value: row.default_value,
            })
            .select()
            .single()
      const { error: saveError } = await query

      if (saveError) {
        setError(saveError.message)
        return
      }
    }

    const { data, error: loadError } = await supabase
      .from('cross_variables')
      .select('*')
      .eq('user_id', session.user.id)
      .order('variable_name', { ascending: true })

    if (loadError) {
      setError(loadError.message)
      return
    }

    setCrossVariables(data ?? [])
    setShowCrossVariables(false)
  }

  const refreshInventory = async () => {
    const { data, error: refreshError } = await supabase.rpc('inventory_workspace_snapshot')
    if (refreshError) {
      setError(refreshError.message)
      return false
    }
    setInventoryItems(data.items)
    setInventoryLots(data.lots)
    setInventoryShipments(data.shipments)
    setShipmentAllocations(data.allocations)
    return true
  }

  const handleSaveInventoryItem = async (draft) => {
    if (!session?.user || !draft.name) {
      return
    }

    const { id, ...payload } = draft
    const query = id
      ? supabase
          .from('inventory_items')
          .update(payload)
          .eq('id', id)
          .eq('user_id', session.user.id)
          .select()
          .single()
      : supabase
          .from('inventory_items')
          .insert({ ...payload, user_id: session.user.id })
          .select()
          .single()
    const { data, error: saveError } = await query

    if (saveError) {
      setError(saveError.message)
      return
    }

    await refreshInventory()
    if (id) {
      setInventoryEditor(null)
    }

    return data
  }

  const handleDeleteInventoryItem = async (id) => {
    if (!window.confirm('Delete this inventory item permanently?')) {
      return
    }

    const { error: deleteError } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    await refreshInventory()
  }

  const handleDuplicateInventoryItem = (item) => {
    const { id, created_at, updated_at, ...copy } = item
    setInventoryEditor({ ...copy, name: `${item.name} (copy)` })
  }

  const handleDuplicateInventoryLot = async (lot, items) => {
    const { id, created_at, updated_at, user_id, ...lotCopy } = lot
    const { data: duplicatedLot, error: lotError } = await supabase
      .from('inventory_lots')
      .insert({ ...lotCopy, name: `${lot.name} (copy)`, user_id: session.user.id })
      .select()
      .single()

    if (lotError) {
      setError(lotError.message)
      return
    }

    const duplicatedItems = items.map(
      ({
        id: itemId,
        created_at: itemCreatedAt,
        updated_at: itemUpdatedAt,
        user_id: itemUserId,
        lot_id,
        ...item
      }) => ({
        ...item,
        lot_id: duplicatedLot.id,
        user_id: session.user.id,
      }),
    )
    const { data: savedItems, error: itemsError } = await supabase
      .from('inventory_items')
      .insert(duplicatedItems)
      .select()

    if (itemsError) {
      await supabase
        .from('inventory_lots')
        .delete()
        .eq('id', duplicatedLot.id)
        .eq('user_id', session.user.id)
      setError(itemsError.message)
      return
    }

    await refreshInventory()
  }

  const handleSaveInventoryLot = async ({ name, notes, lotFields, items }) => {
    if (!session?.user || !name || items.some((item) => !item.name)) {
      return
    }

    const lotFinalPrice = Number(
      items.reduce((total, item) => total + Number(item.purchase_price || 0), 0).toFixed(2),
    )
    const { data: lot, error: lotError } = await supabase
      .from('inventory_lots')
      .insert({
        name,
        notes,
        ...lotFields,
        purchase_price: lotFinalPrice,
        final_price: lotFinalPrice,
        user_id: session.user.id,
      })
      .select()
      .single()

    if (lotError) {
      setError(lotError.message)
      return
    }

    const { data: savedItems, error: itemsError } = await supabase
      .from('inventory_items')
      .insert(items.map((item) => ({ ...item, lot_id: lot.id, user_id: session.user.id })))
      .select()

    if (itemsError) {
      await supabase.from('inventory_lots').delete().eq('id', lot.id).eq('user_id', session.user.id)
      setError(itemsError.message)
      return
    }

    await refreshInventory()
    setLotEditor(null)
  }

  const handleUpdateInventoryLot = async (draft) => {
    const { id, created_at, updated_at, user_id, ...payload } = draft
    const { data, error: updateError } = await supabase
      .from('inventory_lots')
      .update(payload)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single()

    if (updateError) {
      setError(updateError.message)
      return
    }

    await refreshInventory()
    setLotEditor(null)
  }

  const handleGenerateLot = (lot, items, template) => {
    setGeneratorTemplate({
      template,
      initialValues: getLotGeneratorValues(
        lot,
        items,
        extractVariables(`${template.title ?? ''}\n${template.content}`),
      ),
    })
  }

  const handleDeleteInventoryLot = async (id) => {
    if (!window.confirm('Delete this lot and all of its items permanently?')) {
      return
    }

    const { error: deleteError } = await supabase
      .from('inventory_lots')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setInventoryLots((current) => current.filter((lot) => lot.id !== id))
    setInventoryItems((current) => current.filter((item) => item.lot_id !== id))
  }

  const applyShipmentChange = async (rpcName, parameters) => {
    setError('')
    const { data, error: changeError } = await supabase.rpc(rpcName, parameters)
    if (changeError) {
      setError(changeError.message)
      return false
    }
    setInventoryItems(data.items)
    setInventoryLots(data.lots)
    setInventoryShipments(data.shipments)
    setShipmentAllocations(data.allocations)
    return true
  }

  const handleSaveShipment = async (draft) => {
    if (!session?.user || !draft.name || !draft.allocations?.length) return
    const saved = await applyShipmentChange('save_inventory_shipment', { draft })
    if (saved) setShipmentEditor(false)
    return saved
  }

  const handleDeleteShipment = async (shipmentId) => {
    const shipment = inventoryShipments.find((entry) => entry.id === shipmentId)
    if (
      !shipment ||
      !window.confirm('Delete "' + shipment.name + '" and remove its allocated costs?')
    )
      return
    await applyShipmentChange('delete_inventory_shipment', { shipment_id: shipmentId })
  }

  if (isLoading) {
    return (
      <main className="auth-shell">
        <p>Loading your workspace...</p>
      </main>
    )
  }

  if (activeLegalPage) {
    return (
      <LegalPage
        page={activeLegalPage}
        onBack={() => setActiveLegalPage(null)}
        onHome={() => setActiveLegalPage(null)}
        onOpenLegalPage={setActiveLegalPage}
        onOpenPricing={() => {
          setActiveLegalPage(null)
          setShowFaqPage(false)
          setShowPricingPage(true)
        }}
      />
    )
  }

  if (showFaqPage) {
    return (
      <FaqPage
        onBack={() => setShowFaqPage(false)}
        onOpenLegalPage={setActiveLegalPage}
        onOpenPricing={() => {
          setActiveLegalPage(null)
          setShowFaqPage(false)
          setShowPricingPage(true)
        }}
      />
    )
  }

  if (showPricingPage) {
    return (
      <PricingPage
        onBack={() => setShowPricingPage(false)}
        onOpenLegalPage={setActiveLegalPage}
        onOpenPricing={() => {
          setActiveLegalPage(null)
          setShowFaqPage(false)
          setShowPricingPage(true)
        }}
      />
    )
  }

  if (showAccountPage && session) {
    return (
      <AccountPanel
        session={session}
        fullPage
        dateFormat={dateFormat}
        currency={currency}
        onCurrencyChange={(nextCurrency) => {
          setCurrency(nextCurrency)
          window.localStorage.setItem(`adrafteo.currency.${session.user.id}`, nextCurrency)
        }}
        onDateFormatChange={(nextFormat) => {
          setDateFormat(nextFormat)
          window.localStorage.setItem(`adrafteo.dateFormat.${session.user.id}`, nextFormat)
        }}
        onClose={() => setShowAccountPage(false)}
        onDeleted={() => setShowAccountPage(false)}
        onOpenFaq={() => setShowFaqPage(true)}
      />
    )
  }

  if (!session) {
    return (
      <LandingPage
        onOpenLegalPage={setActiveLegalPage}
        onOpenFaq={() => setShowFaqPage(true)}
        onOpenPricing={() => {
          setActiveLegalPage(null)
          setShowFaqPage(false)
          setShowPricingPage(true)
        }}
      />
    )
  }

  if (shipmentEditor) {
    return (
      <ShipmentPage
        items={inventoryItems}
        lots={inventoryLots}
        allocations={shipmentAllocations}
        error={error}
        onSave={handleSaveShipment}
        onCancel={() => {
          setShipmentEditor(false)
          setError('')
        }}
      />
    )
  }

  if (showLanding) {
    return (
      <LandingPage
        onOpenLegalPage={setActiveLegalPage}
        onOpenFaq={() => setShowFaqPage(true)}
        onOpenPricing={() => {
          setActiveLegalPage(null)
          setShowFaqPage(false)
          setShowPricingPage(true)
        }}
        onBackWorkspace={() => setShowLanding(false)}
      />
    )
  }

  const templateCount = templates.length
  const visibleTemplates = templates.filter((template) => {
    const query = templateQuery.trim().toLowerCase()
    return (
      !query ||
      `${template.name} ${template.title ?? ''} ${template.content}`.toLowerCase().includes(query)
    )
  })
  const crossVariableValues = Object.fromEntries(
    crossVariables.map((variable) => [variableKey(variable.variable_name), variable.default_value]),
  )

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar__brand">
          <img
            className="brand-mark"
            src="/logo-adrafteo-plume-blanche.png"
            alt=""
            aria-hidden="true"
          />
          <span className="topbar__brand-name">
            <strong>Adrafteo</strong>
          </span>
        </div>
        <span className="topbar__separator" aria-hidden="true">
          ●
        </span>
        <div className="topbar__identity">
          <p className="eyebrow">Workspace listing architecture</p>
          <h1>
            {activeView === 'templates'
              ? 'Structured Listing Templates'
              : activeView === 'inventory'
                ? 'Inventory Registry'
                : 'Seller Performance Overview'}
          </h1>
          <p className="topbar__subtitle">
            {activeView === 'templates'
              ? 'Centralize your marketplace formats, dynamic SEO variables, and reusable copy.'
              : activeView === 'inventory'
                ? 'Track every item from purchase to sale, with your listing workflow close at hand.'
                : 'A practical summary of your current stock, sales, and listing workflow.'}
          </p>
        </div>
        <div className="topbar__actions">
          <button
            type="button"
            className="button button--ghost"
            onClick={() => setShowCrossVariables(true)}
          >
            Cross variables
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => setShowFaqPage(true)}
          >
            FAQ
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => setShowFeedback(true)}
          >
            Give a Feedback!
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => supabase.auth.signOut()}
          >
            Sign out
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => setShowAccountPage(true)}
          >
            Account
          </button>
        </div>
      </header>

      <main className="content">
        {error ? <p className="error-message">{error}</p> : null}
        <nav className="workspace-nav" aria-label="Workspace sections">
          <button
            type="button"
            className="workspace-nav__link"
            onClick={() => setShowLanding(true)}
          >
            Landing
          </button>
          <button
            type="button"
            className={
              activeView === 'overview'
                ? 'workspace-nav__link workspace-nav__link--active'
                : 'workspace-nav__link'
            }
            onClick={() => setActiveView('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            className={
              activeView === 'templates'
                ? 'workspace-nav__link workspace-nav__link--active'
                : 'workspace-nav__link'
            }
            onClick={() => setActiveView('templates')}
          >
            Templates
          </button>
          <button
            type="button"
            className={
              activeView === 'inventory'
                ? 'workspace-nav__link workspace-nav__link--active'
                : 'workspace-nav__link'
            }
            onClick={() => setActiveView('inventory')}
          >
            Inventory
          </button>
          <span className="workspace-nav__spacer" />
          <span className="workspace-nav__user">{session.user.email}</span>
        </nav>

        {activeView === 'overview' ? (
          <OverviewPage
            items={inventoryItems}
            templates={templates}
            onOpenTemplates={() => setActiveView('templates')}
            onOpenInventory={() => setActiveView('inventory')}
          />
        ) : activeView === 'templates' ? (
          <>
            <section className="templates-heading">
              <div>
                <h2>Your templates</h2>
                <p>Reusable listing blueprints for every marketplace workflow.</p>
              </div>
              <input
                className="template-search"
                value={templateQuery}
                onChange={(event) => setTemplateQuery(event.target.value)}
                placeholder="Search templates, tags, keywords..."
                aria-label="Search templates"
              />
            </section>
            <section className="stats-row">
              <div className="stat-card">
                <span>Templates</span>
                <strong>{templateCount}</strong>
              </div>
              <div className="stat-card">
                <span>Workflow</span>
                <strong>Write → Fill → Copy</strong>
              </div>
              <div className="stat-card">
                <span>Storage</span>
                <strong>Cloud synced</strong>
              </div>
              <button
                type="button"
                className="button button--primary template-create-button"
                onClick={() => {
                  setGeneratorTemplate(null)
                  setEditorDirty(false)
                  setEditorTemplate({ name: '', title: '', content: '' })
                }}
              >
                + Create template
              </button>
            </section>

            {templateCount > 0 ? (
              <section className="grid">
                {visibleTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onEdit={(template) => {
                      setGeneratorTemplate(null)
                      setEditorTemplate(template)
                    }}
                    onGenerate={(template) => {
                      setEditorTemplate(null)
                      setGeneratorTemplate(template)
                    }}
                    onDuplicate={handleDuplicateTemplate}
                    onDelete={handleDeleteTemplate}
                  />
                ))}
              </section>
            ) : (
              <section className="empty-state">
                <h2>
                  {templateCount === 0 ? 'No templates yet' : 'No templates match your search'}
                </h2>
                <p>
                  {templateCount === 0
                    ? 'Create your first advert template and reuse it for every listing.'
                    : 'Try another keyword or clear the search field.'}
                </p>
                {templateCount === 0 ? (
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={() => {
                      setGeneratorTemplate(null)
                      setEditorDirty(false)
                      setEditorTemplate({ name: '', title: '', content: '' })
                    }}
                  >
                    Create your first template
                  </button>
                ) : (
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => setTemplateQuery('')}
                  >
                    Clear search
                  </button>
                )}
              </section>
            )}
          </>
        ) : (
          <InventoryPage
            items={inventoryItems}
            lots={inventoryLots}
            templates={templates}
            shipments={inventoryShipments}
            allocations={shipmentAllocations}
            dateFormat={dateFormat}
            onCreate={() => setInventoryEditor({})}
            onCreateLot={() => setLotEditor({})}
            onCreateShipment={() => {
              setError('')
              setShipmentEditor(true)
            }}
            onEdit={setInventoryEditor}
            onEditLot={setLotEditor}
            onDelete={handleDeleteInventoryItem}
            onDuplicate={handleDuplicateInventoryItem}
            onDuplicateLot={handleDuplicateInventoryLot}
            onDeleteLot={handleDeleteInventoryLot}
            onDeleteShipment={handleDeleteShipment}
            onGenerate={(item, template) => {
              setInventoryEditor(null)
              setGeneratorTemplate({
                template,
                initialValues: getGeneratorValues(
                  item,
                  extractVariables(`${template.title ?? ''}\n${template.content}`),
                ),
              })
            }}
            onGenerateLot={handleGenerateLot}
          />
        )}
      </main>

      {editorTemplate ? (
        <Modal
          title={editorTemplate.id ? 'Edit template' : 'Create template'}
          subtitle="Write a reusable advert with placeholders in brackets."
          onClose={handleCloseEditor}
          wide
        >
          <TemplateForm
            initialTemplate={editorTemplate}
            onSave={handleSaveTemplate}
            onCancel={handleCloseEditor}
            onDirtyChange={setEditorDirty}
          />
        </Modal>
      ) : null}

      {generatorTemplate ? (
        <GeneratorPanel
          template={generatorTemplate.template ?? generatorTemplate}
          initialValues={generatorTemplate.initialValues}
          crossVariables={crossVariableValues}
          onClose={() => setGeneratorTemplate(null)}
        />
      ) : null}

      {showCrossVariables ? (
        <CrossVariablesPanel
          variables={crossVariables}
          onSave={handleSaveCrossVariables}
          onClose={() => setShowCrossVariables(false)}
        />
      ) : null}

      {inventoryEditor ? (
        <Modal
          title={inventoryEditor.id ? 'Edit inventory item' : 'Add inventory item'}
          subtitle="Track the purchase, listing and sale details for one item."
          onClose={() => setInventoryEditor(null)}
          wide
        >
          <InventoryForm
            initialItem={inventoryEditor}
            templates={templates}
            onSave={handleSaveInventoryItem}
            onCancel={() => setInventoryEditor(null)}
          />
        </Modal>
      ) : null}

      {lotEditor ? (
        <Modal
          title={lotEditor.id ? 'Edit inventory lot' : 'Create inventory lot'}
          subtitle="Group several items while keeping their individual financial details."
          onClose={() => setLotEditor(null)}
          wide
        >
          {lotEditor.id ? (
            <LotSettingsForm
              lot={lotEditor}
              templates={templates}
              onSave={handleUpdateInventoryLot}
              onCancel={() => setLotEditor(null)}
            />
          ) : (
            <LotFormV2
              templates={templates}
              onSave={handleSaveInventoryLot}
              onCancel={() => setLotEditor(null)}
            />
          )}
        </Modal>
      ) : null}

      {showFeedback ? <FeedbackPanel onClose={() => setShowFeedback(false)} /> : null}
      <Footer
        onOpenLegalPage={setActiveLegalPage}
        onOpenPricing={() => {
          setActiveLegalPage(null)
          setShowFaqPage(false)
          setShowPricingPage(true)
        }}
      />
    </div>
  )
}

export default App
