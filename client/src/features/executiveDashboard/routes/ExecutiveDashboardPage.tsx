import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input } from '@components'
import { useAuth } from '@features/auth/context'
import { useExecutiveDashboard } from '../hooks/useExecutiveDashboard'
import { useUpdateExecutiveTarget } from '../hooks/useUpdateExecutiveTarget'
import { InterventionsPanel } from '../components/InterventionsPanel'
import type {
  ExecutiveDashboardSummary,
  ExecutiveObjective,
  ExecutiveTrend,
} from '../types'

const summaryCards: Array<{
  key: keyof ExecutiveDashboardSummary
  label: string
  format: 'count' | 'percent'
  helper: string
  alert?: boolean
}> = [
  { key: 'applicationsLast30Days', label: 'Înscrieri noi', format: 'count', helper: 'Cereri înregistrate în ultimele 30 de zile.' },
  { key: 'uncontactedCases', label: 'Dosare necontactate', format: 'count', helper: 'Nu au încă un contact înregistrat.', alert: true },
  { key: 'overdueCases', label: 'Follow-up depășit', format: 'count', helper: 'Necesită intervenție imediată.', alert: true },
  { key: 'contactRate', label: 'Rată de contactare', format: 'percent', helper: 'Cereri contactate din total.' },
  { key: 'memberConversionRate', label: 'Conversie cerere–membru', format: 'percent', helper: 'Dosare ajunse la membru activ.' },
  { key: 'membersTotal', label: 'Membri activi', format: 'count', helper: 'Membri cu statut activ.' },
  { key: 'countiesWithoutResponsible', label: 'Județe fără responsabil', format: 'count', helper: 'Nu au niciun mandat teritorial activ.', alert: true },
  { key: 'applicationsTotal', label: 'Cereri totale', format: 'count', helper: 'Baza de calcul pentru conversie.' },
]

const workflowLabels = {
  nou: 'Nou',
  validat: 'Validat',
  contactat: 'Contactat',
  activ: 'Activ',
} as const

function formatNumber(value: number): string {
  return new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 }).format(value)
}

function formatMetric(value: number, format: 'count' | 'percent'): string {
  return format === 'percent' ? `${formatNumber(value)}%` : formatNumber(value)
}

function formatMonth(value: string): string {
  return new Intl.DateTimeFormat('ro-RO', { month: 'short', year: '2-digit', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00.000Z`))
}

function TrendPanel({ trends }: { trends: ExecutiveTrend[] }) {
  const maximum = Math.max(1, ...trends.map((row) => row.applications))

  return (
    <section className="panel executive-dashboard__trend">
      <header className="panel__header">
        <div>
          <div className="panel__title">Tendință pe șase luni</div>
          <p className="muted">Cohorte lunare și situația lor curentă.</p>
        </div>
        <div className="executive-dashboard__legend" aria-label="Legendă">
          <span><i className="is-applications" /> Cereri</span>
          <span><i className="is-contacted" /> Contactate</span>
          <span><i className="is-members" /> Membri</span>
        </div>
      </header>
      <div className="panel__body executive-dashboard__trend-grid">
        {trends.map((row) => (
          <article className="executive-dashboard__trend-column" key={row.month}>
            <div className="executive-dashboard__trend-values">
              <span>{row.applications}</span>
              <span>{row.contacted}</span>
              <span>{row.members}</span>
            </div>
            <div className="executive-dashboard__bars" aria-label={`${formatMonth(row.month)}: ${row.applications} cereri`}>
              <i className="is-applications" style={{ height: `${Math.max(4, (row.applications / maximum) * 100)}%` }} />
              <i className="is-contacted" style={{ height: `${Math.max(4, (row.contacted / maximum) * 100)}%` }} />
              <i className="is-members" style={{ height: `${Math.max(4, (row.members / maximum) * 100)}%` }} />
            </div>
            <strong>{formatMonth(row.month)}</strong>
          </article>
        ))}
      </div>
    </section>
  )
}

function ObjectiveCard({ objective, canEdit }: { objective: ExecutiveObjective; canEdit: boolean }) {
  const [draft, setDraft] = useState(String(objective.targetValue))
  const { update, updating, error, reset } = useUpdateExecutiveTarget()

  const statusLabel = objective.status === 'achieved'
    ? 'Atins'
    : objective.status === 'on_track'
      ? 'În grafic'
      : 'În risc'
  const unitSuffix = objective.unit === 'percent' ? '%' : ''

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const targetValue = Number(draft)
    if (!Number.isFinite(targetValue) || targetValue < 0) return
    reset()
    try {
      await update({ key: objective.key, targetValue })
    } catch {
      // Mutation state renders the API error next to the edited objective.
    }
  }

  return (
    <article className={`executive-dashboard__objective is-${objective.status}`}>
      <div className="executive-dashboard__objective-top">
        <div>
          <h3>{objective.label}</h3>
          <p>Acum: <strong>{formatNumber(objective.currentValue)}{unitSuffix}</strong> · Țintă: {formatNumber(objective.targetValue)}{unitSuffix}</p>
        </div>
        <span className="executive-dashboard__status">{statusLabel}</span>
      </div>
      <div className="executive-dashboard__progress" aria-label={`Progres ${objective.progressPercent}%`}>
        <span style={{ width: `${objective.progressPercent}%` }} />
      </div>
      {canEdit ? (
        <form className="executive-dashboard__target-form" onSubmit={(event) => void handleSubmit(event)}>
          <Input
            label={`Țintă${unitSuffix ? ' (%)' : ''}`}
            type="number"
            min="0"
            max={objective.unit === 'percent' ? '100' : '100000'}
            step={objective.unit === 'percent' ? '0.1' : '1'}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button type="submit" loading={updating}>Salvează</Button>
        </form>
      ) : null}
      {error ? <div className="alert error">{error}</div> : null}

    </article>
  )
}

export function ExecutiveDashboardPage() {
  const { user } = useAuth()
  const { dashboard, loading, error, reload } = useExecutiveDashboard()
  const canEditTargets = user?.role === 'PRESEDINTE'
  const maximumCountyApplications = useMemo(
    () => Math.max(1, ...(dashboard?.counties.map((county) => county.applications) ?? [1])),
    [dashboard],
  )

  return (
    <div className="executive-dashboard">
      <section className="hero executive-dashboard__hero">
        <div className="hero-kicker">{dashboard?.access?.national ? 'Conducere națională' : 'Conducere teritorială'}</div>
        <div className="executive-dashboard__hero-top">
          <div className="stack-12">
            <h1>Tablou de comandă</h1>
            <p className="lead">Situația recrutării, mobilizării și organizației, într-un singur loc.</p>
            {dashboard ? (
              <p className="muted">
                Arie autorizată: {dashboard.access?.scope ?? 'Național'} · Actualizat la {new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(dashboard.generatedAt))}
              </p>
            ) : null}
          </div>
          <div className="executive-dashboard__actions">
            <Button onClick={reload} loading={loading}>Reîncarcă</Button>
          </div>
        </div>
      </section>

      {error ? <div className="alert error">{error}</div> : null}

      <nav className="admin-section-links" aria-label="Secțiuni tablou de comandă">
        <a href="#dashboard-interventions">Intervenții</a>
        <a href="#dashboard-indicators">Indicatori și evoluție</a>
        <a href="#dashboard-territory">Situație teritorială</a>
        <a href="#dashboard-objectives">Ținte operaționale</a>
      </nav>

      <div className="admin-section" id="dashboard-interventions"><InterventionsPanel /></div>

      <div className="admin-section" id="dashboard-indicators">
      <h2>Indicatori și evoluție</h2>

      <section className="executive-dashboard__summary" aria-label="Indicatori executivi">
        {summaryCards.map((card) => {
          const value = dashboard?.summary[card.key] ?? 0
          const isAlert = card.alert && value > 0
          return (
            <article className={`card executive-dashboard__summary-card${isAlert ? ' is-alert' : ''}`} key={card.key}>
              <div className="hero-kicker">{card.label}</div>
              <strong>{!dashboard ? (loading ? '…' : '—') : formatMetric(value, card.format)}</strong>
              <p>{card.helper}</p>
            </article>
          )
        })}
      </section>
      </div>

      {dashboard ? (
        <>
          <div className="executive-dashboard__main-grid">
            <TrendPanel trends={dashboard.trends} />

            <section className="panel executive-dashboard__workflow-panel">
              <header className="panel__header">
                <div>
                  <div className="panel__title">Fluxul dosarelor</div>
                  <p className="muted">Situația curentă pe etape.</p>
                </div>
              </header>
              <div className="panel__body executive-dashboard__workflow">
                {dashboard.workflow.map((row) => (
                  <div key={row.status}>
                    <span>{workflowLabels[row.status]}</span>
                    <strong>{row.count}</strong>
                  </div>
                ))}
                <Link className="text-link" to="/admin/volunteers?status=nou">Deschide dosarele noi →</Link>
              </div>
            </section>
          </div>

          <div className="admin-section" id="dashboard-territory">
          <h2>Situație teritorială</h2>
          <section className="panel executive-dashboard__counties">
            <header className="panel__header">
              <div>
                <div className="panel__title">Distribuție pe județe</div>
                <p className="muted">Membri, organizatori și acoperire operațională pentru fiecare județ cu cereri.</p>
              </div>
            </header>
            <div className="panel__body executive-dashboard__table-wrap">
              {dashboard.counties.length === 0 ? <p className="muted">Nu există încă date teritoriale.</p> : (
                <table className="executive-dashboard__table">
                  <thead>
                    <tr><th>Județ</th><th>Cereri</th><th>Membri</th><th>Organizatori</th><th>Follow-up</th><th>Responsabil</th></tr>
                  </thead>
                  <tbody>
                    {dashboard.counties.map((county) => (
                      <tr key={county.county}>
                        <th>
                          {county.county}
                          <span className="executive-dashboard__county-track"><i style={{ width: `${(county.applications / maximumCountyApplications) * 100}%` }} /></span>
                        </th>
                        <td>{county.applications}</td>
                        <td>{county.members}</td>
                        <td>{county.organizers}</td>
                        <td className={county.overdue > 0 ? 'is-overdue' : ''}>{county.overdue}</td>
                        <td className={!county.hasResponsible ? 'is-overdue' : ''}>
                          {county.hasResponsible ? 'Da' : 'Lipsește'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="card executive-dashboard__coverage" aria-labelledby="executive-coverage-title">
            <div>
              <div className="hero-kicker">Acoperire teritorială</div>
              <h2 id="executive-coverage-title">Județe fără responsabil activ</h2>
              <p className="muted">Prioritatea operațională este numirea unui responsabil printr-un mandat în registrul organizațional.</p>
            </div>
            {dashboard.countiesWithoutResponsible.length > 0 ? (
              <ul>
                {dashboard.countiesWithoutResponsible.map((county) => <li key={county}>{county}</li>)}
              </ul>
            ) : <p className="alert success">Toate județele din aria autorizată au cel puțin un responsabil activ.</p>}
          </section>

          </div>

          <section className="executive-dashboard__objectives admin-section" id="dashboard-objectives" aria-labelledby="executive-objectives-title">
            <div className="executive-dashboard__section-heading">
              <div>
                <div className="hero-kicker">Obiective asumate</div>
                <h2 id="executive-objectives-title">Ținte operaționale</h2>
              </div>
              <p className="muted">{canEditTargets ? 'Poți actualiza țintele direct din fiecare card.' : 'Țintele pot fi actualizate numai de președinte.'}</p>
            </div>
            <div className="executive-dashboard__objective-grid">
              {dashboard.objectives.map((objective) => (
                <ObjectiveCard
                  key={`${objective.key}:${objective.targetValue}`}
                  objective={objective}
                  canEdit={canEditTargets}
                />
              ))}
            </div>
          </section>

          <details className="card executive-dashboard__definitions">
            <summary>Cum sunt calculați indicatorii</summary>
            <dl>
              <div><dt>Rată de contactare</dt><dd>{dashboard.definitions.contactRate}</dd></div>
              <div><dt>Conversie în membri</dt><dd>{dashboard.definitions.memberConversionRate}</dd></div>
              <div><dt>Dosare restante</dt><dd>{dashboard.definitions.overdueCases}</dd></div>
              <div><dt>Organizații active</dt><dd>{dashboard.definitions.activeOrganizations}</dd></div>
              <div><dt>Dosare necontactate</dt><dd>{dashboard.definitions.uncontactedCases}</dd></div>
              <div><dt>Județe fără responsabil</dt><dd>{dashboard.definitions.countiesWithoutResponsible}</dd></div>
              <div><dt>Tendințe</dt><dd>{dashboard.definitions.trends}</dd></div>
            </dl>
          </details>
        </>
      ) : null}
    </div>
  )
}

export default ExecutiveDashboardPage
