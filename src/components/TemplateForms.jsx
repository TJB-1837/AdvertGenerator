import { useEffect, useMemo, useState } from 'react'
import { extractVariables, getInitialVariableValue, generateAdvertText } from '../lib/workspace'
import { Modal } from './Modal'

export function TemplateForm({ initialTemplate, onSave, onCancel, onDirtyChange }) {
  const [name, setName] = useState(initialTemplate?.name ?? '')
  const [title, setTitle] = useState(initialTemplate?.title ?? '')
  const [content, setContent] = useState(initialTemplate?.content ?? '')

  const variables = useMemo(() => extractVariables(`${title}\n${content}`), [title, content])

  useEffect(() => {
    const isDirty =
      name !== (initialTemplate?.name ?? '') ||
      title !== (initialTemplate?.title ?? '') ||
      content !== (initialTemplate?.content ?? '')

    onDirtyChange(isDirty)
  }, [content, initialTemplate, name, onDirtyChange, title])

  const handleSubmit = (event) => {
    event.preventDefault()
    onSave({
      ...initialTemplate,
      name,
      title,
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
        <span>Listing title</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Example: Nike sneakers, size 42"
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

export function CrossVariablesPanel({ variables, onSave, onClose }) {
  const [rows, setRows] = useState(() => variables.map((variable) => ({ ...variable })))

  const updateRow = (index, field, value) => {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)),
    )
  }

  const handleSave = (event) => {
    event.preventDefault()
    onSave(
      rows
        .filter((row) => row.variable_name.trim())
        .map((row) => ({
          ...row,
          variable_name: row.variable_name.trim().replace(/^\[|\]$/g, ''),
          default_value: row.default_value,
        })),
    )
  }

  return (
    <Modal
      title="Cross variables"
      subtitle="Set reusable default values for variables used across your templates."
      onClose={onClose}
      wide
    >
      <form className="form cross-variables-form" onSubmit={handleSave}>
        <div className="helper-box cross-variables-intro">
          <div>
            <strong>One value, reused everywhere</strong>
            <p>
              Save a default once and Adrafteo will prefill it whenever the same variable appears in
              a template. You can still adjust the value for a specific advert.
            </p>
          </div>
          <span className="cross-variables-count">
            {rows.length} {rows.length === 1 ? 'variable' : 'variables'}
          </span>
        </div>

        {rows.length > 0 ? (
          <div className="cross-variable-list">
            {rows.map((row, index) => (
              <div className="cross-variable-row" key={row.id ?? index}>
                <span className="cross-variable-row__number" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <label>
                  <span>Variable name</span>
                  <input
                    value={row.variable_name}
                    onChange={(event) => updateRow(index, 'variable_name', event.target.value)}
                    placeholder="Ton secteur / Ta gare"
                  />
                  <small>Use the name inside square brackets in your templates.</small>
                </label>
                <label>
                  <span>Default value</span>
                  <textarea
                    value={row.default_value}
                    onChange={(event) => updateRow(index, 'default_value', event.target.value)}
                    placeholder="Paris"
                    rows={3}
                  />
                </label>
                <button
                  type="button"
                  className="button button--danger"
                  onClick={() =>
                    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="cross-variable-empty">
            <strong>No cross variables yet</strong>
            <p>
              Add a reusable value for information such as your location, shipping method, or seller
              details.
            </p>
          </div>
        )}

        <button
          type="button"
          className="button button--ghost cross-variables-add"
          onClick={() =>
            setRows((current) => [...current, { variable_name: '', default_value: '' }])
          }
        >
          + Add cross variable
        </button>

        <div className="form__actions">
          <button type="button" className="button button--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button--primary">
            Save cross variables
          </button>
        </div>
      </form>
    </Modal>
  )
}

const emptyVariableValues = Object.freeze({})

export function GeneratorPanel({
  template,
  initialValues = emptyVariableValues,
  crossVariables = emptyVariableValues,
  onClose,
}) {
  const variables = useMemo(
    () => extractVariables(`${template.title ?? ''}\n${template.content}`),
    [template.title, template.content],
  )
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      variables.map((variable) => [
        variable,
        getInitialVariableValue(variable, initialValues, crossVariables),
      ]),
    ),
  )
  const [copyStatus, setCopyStatus] = useState('')

  useEffect(() => {
    setValues(
      Object.fromEntries(
        variables.map((variable) => [
          variable,
          getInitialVariableValue(variable, initialValues, crossVariables),
        ]),
      ),
    )
    setCopyStatus('')
  }, [crossVariables, initialValues, template.id, variables])

  const generatedTitle = useMemo(
    () => generateAdvertText(template.title ?? '', values),
    [template.title, values],
  )
  const generatedDescription = useMemo(
    () => generateAdvertText(template.content, values),
    [template.content, values],
  )
  const generatedText = `${generatedTitle}${generatedTitle && generatedDescription ? '\n\n' : ''}${generatedDescription}`

  const handleClose = () => {
    const hasEnteredValues = Object.values(values).some((value) => value.trim())

    if (
      hasEnteredValues &&
      !window.confirm(
        'Are you sure you want to quit this window? Your entered values will be lost.',
      )
    ) {
      return
    }

    onClose()
  }

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
      onClose={handleClose}
      wide
    >
      <div className="generator-layout">
        <section className="generator-layout__inputs">
          <div className="helper-box generator-variables">
            <strong>Recognized variables</strong>
            <div className="chip-list">
              {variables.length > 0 ? (
                variables.map((variable) => (
                  <span className="chip" key={variable}>
                    [{variable}]
                  </span>
                ))
              ) : (
                <span className="status-message">No variables detected</span>
              )}
            </div>
            <p>
              Use one variable per field. Multi-line values are supported for item lists and other
              repeated details.
            </p>
          </div>
          {variables.length > 0 ? (
            variables.map((variable) => (
              <label key={variable}>
                <span>{variable}</span>
                <textarea
                  value={values[variable] ?? ''}
                  onChange={(event) =>
                    setValues((current) => ({
                      ...current,
                      [variable]: event.target.value,
                    }))
                  }
                  placeholder={`Enter ${variable.toLowerCase()}`}
                  rows={
                    variable.toLowerCase().includes('item') ||
                    variable.toLowerCase().includes('list')
                      ? 5
                      : 3
                  }
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
              <strong>Generated advert</strong>
              <button type="button" className="button button--primary" onClick={handleCopy}>
                Copy text
              </button>
            </div>
            <div className="generated-title">
              <span>Title</span>
              <input readOnly value={generatedTitle} aria-label="Generated listing title" />
            </div>
            <textarea
              readOnly
              value={generatedDescription}
              rows={16}
              aria-label="Generated listing description"
            />
            {copyStatus ? <p className="status-message">{copyStatus}</p> : null}
          </div>
        </section>
      </div>
    </Modal>
  )
}
