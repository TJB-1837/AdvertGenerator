import { useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'advert-template.templates.v1'

const SAMPLE_TEMPLATES = [
  {
    id: 'sample-1',
    name: 'Vintage jacket',
    content:
      '[Variable 1]\n\nHere is the set [Variable 2].\n\nCondition is [Variable 3].\n\nFast and safe shipping.\n\nFor more details, message me.',
  },
  {
    id: 'sample-2',
    name: 'Sneakers listing',
    content:
      'Brand: [Brand]\nSize: [Size]\nColor: [Color]\n\nGently used and ready to ship.\nMessage me if interested.',
  },
]

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  return `template-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeTemplate(template) {
  return {
    ...template,
    name: template.name.trim(),
    content: template.content.trim(),
  }
}

function loadTemplates() {
  if (typeof window === 'undefined') {
    return SAMPLE_TEMPLATES.map((template) => ({
      ...template,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    const now = new Date().toISOString()
    return SAMPLE_TEMPLATES.map((template) => ({
      ...template,
      createdAt: now,
      updatedAt: now,
    }))
  }

  try {
    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      throw new Error('Stored templates must be an array.')
    }

    return parsed
  } catch {
    const now = new Date().toISOString()
    return SAMPLE_TEMPLATES.map((template) => ({
      ...template,
      createdAt: now,
      updatedAt: now,
    }))
  }
}

function extractVariables(content) {
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

function generateAdvertText(content, values) {
  return content.replace(/\[([^\[\]]+)\]/g, (_, rawName) => {
    const name = rawName.trim()
    return values[name]?.trim() || ''
  })
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateString))
}

function TemplateCard({ template, onEdit, onGenerate, onDelete }) {
  const variables = extractVariables(template.content)

  return (
    <article className="template-card">
      <div className="template-card__header">
        <div>
          <h3>{template.name}</h3>
          <p>{variables.length} variable{variables.length === 1 ? '' : 's'} detected</p>
        </div>
        <span className="template-card__badge">Template</span>
      </div>

      <pre className="template-card__preview">{template.content}</pre>

      <div className="template-card__footer">
        <small>Updated {formatDate(template.updatedAt || template.createdAt)}</small>
        <div className="template-card__actions">
          <button type="button" className="button button--ghost" onClick={() => onEdit(template)}>
            Edit
          </button>
          <button type="button" className="button button--primary" onClick={() => onGenerate(template)}>
            Generate
          </button>
          <button type="button" className="button button--danger" onClick={() => onDelete(template.id)}>
            Delete
          </button>
        </div>
      </div>
    </article>
  )
}

function Modal({ title, subtitle, onClose, children, wide = false }) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`modal ${wide ? 'modal--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <div>
            <h2 id="modal-title">{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function TemplateForm({ initialTemplate, onSave, onCancel }) {
  const [name, setName] = useState(initialTemplate?.name ?? '')
  const [content, setContent] = useState(initialTemplate?.content ?? '')

  const variables = useMemo(() => extractVariables(content), [content])

  const handleSubmit = (event) => {
    event.preventDefault()
    onSave({
      ...initialTemplate,
      name,
      content,
    })
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label>
        <span>Template name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Example: Vintage jacket"
          required
        />
      </label>

      <label>
        <span>Template text</span>
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Write your advert and use placeholders like [Brand] or [Size]"
          rows={14}
          required
        />
      </label>

      <div className="helper-box">
        <strong>Detected variables</strong>
        {variables.length > 0 ? (
          <div className="chip-list">
            {variables.map((variable) => (
              <span className="chip" key={variable}>
                {variable}
              </span>
            ))}
          </div>
        ) : (
          <p>Use brackets like [Brand] to create variable fields later.</p>
        )}
      </div>

      <div className="form__actions">
        <button type="button" className="button button--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="button button--primary">
          Save template
        </button>
      </div>
    </form>
  )
}

function GeneratorPanel({ template, onClose }) {
  const variables = useMemo(() => extractVariables(template.content), [template.content])
  const [values, setValues] = useState(() => Object.fromEntries(variables.map((variable) => [variable, ''])))
  const [copyStatus, setCopyStatus] = useState('')

  useEffect(() => {
    setValues(Object.fromEntries(variables.map((variable) => [variable, ''])))
    setCopyStatus('')
  }, [template.id, variables])

  const generatedText = useMemo(
    () => generateAdvertText(template.content, values),
    [template.content, values],
  )

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedText)
      setCopyStatus('Copied to clipboard')
    } catch {
      setCopyStatus('Copy failed. Select the text and copy manually.')
    }
  }

  return (
    <Modal
      title={`Generate: ${template.name}`}
      subtitle="Fill in the variables and copy the finished advert."
      onClose={onClose}
      wide
    >
      <div className="generator-layout">
        <section className="generator-layout__inputs">
          {variables.length > 0 ? (
            variables.map((variable) => (
              <label key={variable}>
                <span>{variable}</span>
                <input
                  value={values[variable] ?? ''}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [variable]: event.target.value,
                    }))
                  }
                  placeholder={`Enter ${variable.toLowerCase()}`}
                />
              </label>
            ))
          ) : (
            <div className="empty-state empty-state--compact">
              <h3>No variables detected</h3>
              <p>This template is ready to copy as is.</p>
            </div>
          )}
        </section>

        <section className="generator-layout__preview">
          <div className="preview-card">
            <div className="preview-card__header">
              <strong>Generated text</strong>
              <button type="button" className="button button--primary" onClick={handleCopy}>
                Copy text
              </button>
            </div>
            <textarea readOnly value={generatedText} rows={18} />
            {copyStatus ? <p className="status-message">{copyStatus}</p> : null}
          </div>
        </section>
      </div>
    </Modal>
  )
}

function App() {
  const [templates, setTemplates] = useState(loadTemplates)
  const [editorTemplate, setEditorTemplate] = useState(null)
  const [generatorTemplate, setGeneratorTemplate] = useState(null)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
  }, [templates])

  const handleSaveTemplate = (draft) => {
    const now = new Date().toISOString()
    const normalized = normalizeTemplate(draft)

    if (!normalized.name || !normalized.content) {
      return
    }

    setTemplates((current) => {
      if (normalized.id) {
        return current.map((template) =>
          template.id === normalized.id
            ? { ...template, ...normalized, updatedAt: now }
            : template,
        )
      }

      return [
        {
          id: createId(),
          ...normalized,
          createdAt: now,
          updatedAt: now,
        },
        ...current,
      ]
    })

    setEditorTemplate(null)
  }

  const handleDeleteTemplate = (id) => {
    setTemplates((current) => current.filter((template) => template.id !== id))
  }

  const templateCount = templates.length

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">AdvertTemplate</p>
          <h1>Build Vinted and eBay adverts faster.</h1>
          <p className="topbar__subtitle">
            Save reusable templates, fill variables, and copy ready-to-post listings in seconds.
          </p>
        </div>
        <button
          type="button"
          className="button button--primary button--large"
          onClick={() => {
            setGeneratorTemplate(null)
            setEditorTemplate({ name: '', content: '' })
          }}
        >
          + Create template
        </button>
      </header>

      <main className="content">
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
            <strong>Local first</strong>
          </div>
        </section>

        {templateCount > 0 ? (
          <section className="grid">
            {templates.map((template) => (
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
                onDelete={handleDeleteTemplate}
              />
            ))}
          </section>
        ) : (
          <section className="empty-state">
            <h2>No templates yet</h2>
            <p>Create your first advert template and reuse it for every listing.</p>
            <button
              type="button"
              className="button button--primary"
              onClick={() => {
                setGeneratorTemplate(null)
                setEditorTemplate({ name: '', content: '' })
              }}
            >
              Create your first template
            </button>
          </section>
        )}
      </main>

      {editorTemplate ? (
        <Modal
          title={editorTemplate.id ? 'Edit template' : 'Create template'}
          subtitle="Write a reusable advert with placeholders in brackets."
          onClose={() => setEditorTemplate(null)}
          wide
        >
          <TemplateForm
            initialTemplate={editorTemplate}
            onSave={handleSaveTemplate}
            onCancel={() => setEditorTemplate(null)}
          />
        </Modal>
      ) : null}

      {generatorTemplate ? (
        <GeneratorPanel template={generatorTemplate} onClose={() => setGeneratorTemplate(null)} />
      ) : null}
    </div>
  )
}

export default App