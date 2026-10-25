import { formatDate, extractVariables } from '../lib/workspace'

export function TemplateCard({ template, onEdit, onGenerate, onDuplicate, onDelete }) {
  const variables = extractVariables(`${template.title ?? ''}\n${template.content}`)

  return (
    <article className="template-card">
      <div className="template-card__header">
        <div>
          <h3>{template.name}</h3>
          <p>
            {variables.length} variable{variables.length === 1 ? '' : 's'} detected · Updated{' '}
            {formatDate(template.updated_at || template.created_at)}
          </p>
        </div>
        <div className="template-card__quick-actions">
          <button
            type="button"
            className="icon-button"
            onClick={() => onDelete(template.id)}
            aria-label={`Delete ${template.name}`}
          >
            ×
          </button>
        </div>
      </div>

      <pre className="template-card__preview">
        {template.title ? `${template.title}\n\n` : ''}
        {template.content}
      </pre>

      <div className="template-card__footer">
        <div className="template-card__actions">
          <button type="button" className="button button--ghost" onClick={() => onEdit(template)}>
            Edit template
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => onDuplicate(template)}
          >
            Duplicate
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={() => onGenerate(template)}
          >
            Generate
          </button>
        </div>
      </div>
    </article>
  )
}
