import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { mobilizationActionTypeConfig } from '../config'
import { MobilizationActionCard } from '../components/MobilizationActionCard'
import { MobilizationResponseForm } from '../components/MobilizationResponseForm'
import { useMobilizationActions } from '../hooks/useMobilizationActions'
import type { MobilizationAction, MobilizationActionType } from '../types'

type ActionFilter = 'all' | MobilizationActionType

const filterOrder: ActionFilter[] = ['all', 'event', 'campaign', 'volunteer_task', 'petition', 'consultation']

function filterLabel(filter: ActionFilter): string {
  return filter === 'all' ? 'Toate acțiunile' : mobilizationActionTypeConfig[filter].label
}

export function MobilizationPage() {
  const { actions, loading, error } = useMobilizationActions()
  const [filter, setFilter] = useState<ActionFilter>('all')
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null)
  const selectedAction = actions.find((action) => action.id === selectedActionId) ?? null
  const filteredActions = useMemo(
    () => filter === 'all' ? actions : actions.filter((action) => action.type === filter),
    [actions, filter],
  )
  const approvedResponseCounts = actions
    .map((action) => action.responseCount)
    .filter((count): count is number => count !== null)
  const totalResponses = approvedResponseCounts.reduce((total, count) => total + count, 0)

  useEffect(() => {
    if (!selectedAction) return
    const frame = window.requestAnimationFrame(() => {
      const form = document.getElementById('participa')
      if (form && typeof form.scrollIntoView === 'function') {
        form.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [selectedAction])

  function selectAction(action: MobilizationAction) {
    setSelectedActionId(action.id)
  }

  return (
    <div className="mobilization-page">
      <section className="mobilization-hero">
        <div>
          <div className="hero-kicker">Centrul de mobilizare PCS</div>
          <h1>Nu doar urmărești. Alegi o acțiune și te implici.</h1>
          <p className="lead">
            Confirmă prezența la evenimente, intră într-o campanie, preia o sarcină, semnează o petiție sau
            contribuie la o consultare. Fiecare răspuns ajunge la echipa și tema potrivită.
          </p>
          <div className="hero-actions">
            <a className="btn primary" href="#actiuni">Alege o acțiune</a>
            <Link className="btn" to="/contact#aderare">Aderă la PCS</Link>
          </div>
        </div>
        <aside className="mobilization-hero__summary" aria-label="Mobilizarea PCS pe scurt">
          <div><strong>{actions.length}</strong><span>acțiuni deschise</span></div>
          <div>
            <strong>{approvedResponseCounts.length > 0 ? totalResponses : '—'}</strong>
            <span>{approvedResponseCounts.length > 0 ? 'răspunsuri validate editorial' : 'indicator în curs de validare'}</span>
          </div>
          <p>Aderarea și participarea punctuală sunt fluxuri separate.</p>
        </aside>
      </section>

      <section className="mobilization-path" aria-labelledby="mobilization-path-title">
        <div className="mobilization-section-heading">
          <div>
            <div className="hero-kicker">De la interes la rezultat</div>
            <h2 id="mobilization-path-title">Un traseu clar pentru fiecare participant</h2>
          </div>
          <p>Nu colectăm contacte fără context: alegi acțiunea, județul, interesele și tipul de comunicare dorit.</p>
        </div>
        <ol>
          <li><span>1</span><div><strong>Alegi</strong><p>evenimentul, campania, sarcina, petiția sau consultarea.</p></div></li>
          <li><span>2</span><div><strong>Confirmi</strong><p>datele necesare și domeniile relevante pentru tine.</p></div></li>
          <li><span>3</span><div><strong>Primești un pas concret</strong><p>detalii logistice, responsabil sau termen de răspuns.</p></div></li>
        </ol>
      </section>

      <section className="mobilization-catalog" id="actiuni" aria-labelledby="mobilization-actions-title">
        <div className="mobilization-section-heading">
          <div>
            <div className="hero-kicker">Acțiuni deschise</div>
            <h2 id="mobilization-actions-title">Alege cum vrei să contribui acum</h2>
          </div>
          <p>Poți participa la o singură acțiune fără să depui automat o cerere de aderare la partid.</p>
        </div>

        <div className="mobilization-filters" role="group" aria-label="Filtrează acțiunile">
          {filterOrder.map((item) => {
            const count = item === 'all' ? actions.length : actions.filter((action) => action.type === item).length
            return (
              <button
                key={item}
                type="button"
                className={filter === item ? 'is-active' : ''}
                aria-pressed={filter === item}
                onClick={() => {
                  setFilter(item)
                  setSelectedActionId(null)
                }}
              >
                {filterLabel(item)} <span>{count}</span>
              </button>
            )
          })}
        </div>

        {loading ? <p className="mobilization-state">Se încarcă acțiunile deschise…</p> : null}
        {error ? <p className="alert error">{error}</p> : null}
        {!loading && !error && filteredActions.length === 0 ? (
          <div className="mobilization-state">
            <strong>Nu există momentan acțiuni în această categorie.</strong>
            <p>Poți selecta alt filtru sau poți contacta organizația din județul tău.</p>
          </div>
        ) : null}

        {filteredActions.length > 0 ? (
          <div className="mobilization-grid">
            {filteredActions.map((action) => (
              <MobilizationActionCard
                key={action.id}
                action={action}
                selected={selectedAction?.id === action.id}
                onSelect={selectAction}
              />
            ))}
          </div>
        ) : null}
      </section>

      {selectedAction ? (
        <MobilizationResponseForm
          key={selectedAction.id}
          action={selectedAction}
          onClose={() => setSelectedActionId(null)}
        />
      ) : (
        <section className="mobilization-segmentation" aria-labelledby="mobilization-segmentation-title">
          <div>
            <div className="hero-kicker">Comunicare relevantă, nu mesaje în masă</div>
            <h2 id="mobilization-segmentation-title">Tu alegi ce informații primești.</h2>
          </div>
          <ul>
            <li>după județ și localitate;</li>
            <li>după domeniile de interes selectate;</li>
            <li>numai cu acord separat pentru actualizări;</li>
            <li>cu posibilitatea retragerii acordului.</li>
          </ul>
        </section>
      )}
    </div>
  )
}
