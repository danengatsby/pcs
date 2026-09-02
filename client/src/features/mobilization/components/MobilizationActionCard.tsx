import { mobilizationActionTypeConfig } from '../config'
import type { MobilizationAction } from '../types'

type MobilizationActionCardProps = {
  action: MobilizationAction
  selected: boolean
  onSelect: (action: MobilizationAction) => void
}

const dateFormatter = new Intl.DateTimeFormat('ro-RO', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Europe/Bucharest',
})

const deadlineFormatter = new Intl.DateTimeFormat('ro-RO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Bucharest',
})

function responseLabel(action: MobilizationAction): string {
  if (action.type === 'petition') return action.responseCount === 1 ? 'semnătură' : 'semnături'
  if (action.type === 'consultation') return action.responseCount === 1 ? 'contribuție' : 'contribuții'
  if (action.type === 'event') return action.responseCount === 1 ? 'confirmare' : 'confirmări'
  return action.responseCount === 1 ? 'persoană implicată' : 'persoane implicate'
}

function scopeLabel(action: MobilizationAction): string {
  if (action.scope === 'online') return 'Online'
  if (action.scope === 'national') return 'Național'
  return [action.locality, action.county].filter(Boolean).join(', ') || 'Acțiune locală'
}

export function MobilizationActionCard({ action, selected, onSelect }: MobilizationActionCardProps) {
  const config = mobilizationActionTypeConfig[action.type]

  return (
    <article className={`mobilization-card mobilization-card--${action.type}${selected ? ' is-selected' : ''}`}>
      <div className="mobilization-card__topline">
        <span>{config.shortLabel}</span>
        <strong>{scopeLabel(action)}</strong>
      </div>
      <h3>{action.title}</h3>
      <p>{action.summary}</p>

      <dl className="mobilization-card__facts">
        {action.startsAt ? (
          <div>
            <dt>Când</dt>
            <dd>{dateFormatter.format(new Date(action.startsAt))}</dd>
          </div>
        ) : null}
        {action.endsAt && !action.startsAt ? (
          <div>
            <dt>Termen</dt>
            <dd>{deadlineFormatter.format(new Date(action.endsAt))}</dd>
          </div>
        ) : null}
        <div>
          <dt>Cum</dt>
          <dd>{action.participationMode}</dd>
        </div>
      </dl>

      <div className="mobilization-card__impact">
        <span>
          <strong>{action.responseCount}</strong> {responseLabel(action)}
        </span>
        {action.capacity ? <span>{Math.max(action.capacity - action.responseCount, 0)} locuri disponibile</span> : null}
      </div>

      <button className="btn primary" type="button" aria-pressed={selected} onClick={() => onSelect(action)}>
        {selected ? 'Acțiune selectată' : config.cta}
      </button>
    </article>
  )
}
