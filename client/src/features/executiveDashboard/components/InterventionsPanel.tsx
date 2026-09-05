import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useExecutiveInterventions } from '../hooks/useExecutiveInterventions'
import { interventionLabels, type InterventionKind } from '../interventions'
import { ExpirationsPanel } from './ExpirationsPanel'
import './interventions.css'

const priorities = { critical: 'Urgent', high: 'Prioritar', normal: 'De planificat' }

export function InterventionsPanel() {
  const [kind, setKind] = useState<InterventionKind | ''>('')
  const [offset, setOffset] = useState(0)
  const [showExpirations, setShowExpirations] = useState(false)
  const [params, setParams] = useSearchParams()
  const selectedExpiry = params.get('expiry')
  const query = useExecutiveInterventions(kind, offset)
  const data = query.isError ? undefined : query.data
  return <>
    <section className="card executive-interventions" aria-labelledby="executive-interventions-title">
      <header><div><div className="hero-kicker">Agenda conducerii</div><h2 id="executive-interventions-title">Intervenții necesare</h2></div>
        <button className="btn" disabled={query.isFetching} onClick={() => void query.refetch()}>Actualizează intervențiile</button></header>
      <p>Cazuri de rezolvat, ordonate după prioritate și termen.</p>
      <label htmlFor="executive-intervention-kind">Tip de intervenție</label>
      <select id="executive-intervention-kind" value={kind} onChange={(event) => { setKind(event.target.value as InterventionKind | ''); setOffset(0) }}>
        <option value="">Toate intervențiile</option>
        {Object.entries(interventionLabels).filter(([key]) => !data || key in data.counts).map(([key, label]) => <option key={key} value={key}>{label}{data ? ` (${data.counts[key as InterventionKind] ?? 0})` : ''}</option>)}
      </select>
      {query.isPending ? <p role="status">Se încarcă intervențiile…</p> : query.isError ? <p role="alert">Intervențiile nu au putut fi încărcate: {query.error.message}. Lista nu poate fi considerată fără restanțe.</p> : data && <>
        <p aria-live="polite">{data.total} intervenții pentru selecția curentă · Actualizat: {new Date(data.generatedAt).toLocaleTimeString('ro-RO')}</p>
        {data.total === 0 ? <p>Nu există intervenții pentru criteriile urmărite și selecția curentă.</p> : <ol className="executive-interventions__list" start={offset + 1}>
          {data.rows.map((row) => <li key={row.key} className={`executive-interventions__item is-${row.priority}`}>
            <div><span className="executive-interventions__priority">{priorities[row.priority]}</span> · {interventionLabels[row.kind]}</div>
            <h3>{row.title}</h3><p>{row.context}</p>
            {row.dueAt && <p>Termen: <time dateTime={row.dueAt}>{new Date(row.dueAt).toLocaleString('ro-RO', { timeZone: 'UTC' })} UTC</time></p>}
            <Link className="btn" to={row.href}>Deschide înregistrarea</Link>
          </li>)}
        </ol>}
        <div className="executive-interventions__actions"><button className="btn" disabled={offset === 0 || query.isFetching} onClick={() => setOffset(Math.max(0, offset - 20))}>Intervențiile anterioare</button>
          <span>Pagina {Math.floor(offset / 20) + 1}</span><button className="btn" disabled={offset + 20 >= data.total || query.isFetching} onClick={() => setOffset(offset + 20)}>Următoarele intervenții</button></div>
        <p className="muted">Decizii/documente cu termen: {data.expiryCoverage.tracked}. Fără termen înregistrat: {data.expiryCoverage.missing}. Cele fără termen nu sunt evaluate pentru expirare.</p>
      </>}
      <details><summary>Cum sunt prioritizate intervențiile?</summary><p className="muted">Urgent: cereri mai vechi de 7 zile, evenimente fără coordonator care încep în cel mult 48 de ore și termene expirate. Expirările sunt urmărite cu 30 de zile înainte, în calendar UTC. Alertele se închid prin actualizarea evidenței sursă.</p></details>
      <button className="btn" onClick={() => { setShowExpirations(!showExpirations); if (selectedExpiry) { const next = new URLSearchParams(params); next.delete('expiry'); setParams(next) } }}>Evidența termenelor</button>
    </section>
    {(showExpirations || selectedExpiry) && <ExpirationsPanel key={selectedExpiry ?? 'all'} record={selectedExpiry} onShowAll={() => { const next = new URLSearchParams(params); next.delete('expiry'); setParams(next); setShowExpirations(true) }} />}
  </>
}
