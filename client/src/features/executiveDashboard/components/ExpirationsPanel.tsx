import { useState, type FormEvent } from 'react'
import { useAdminRecordFocus } from '@features/adminShell/useAdminRecordFocus'
import { useExecutiveExpirations } from '../hooks/useExecutiveInterventions'
import type { ExpiryRecord } from '../interventions'

function ExpiryForm({ row, saving, onSave }: { row: ExpiryRecord; saving: boolean; onSave: (expiresOn: string | null) => Promise<unknown> }) {
  const [date, setDate] = useState(row.expiresOn ?? '')
  const [message, setMessage] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage('')
    try { await onSave(date || null); setMessage('Termen salvat în registru.') } catch { /* The panel displays the server error. */ }
  }
  return <form onSubmit={(event) => void submit(event)} className="executive-interventions__expiry-form">
    <label>Data expirării pentru {row.title}<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
    <button className="btn" disabled={saving || date === (row.expiresOn ?? '')}>Salvează termenul</button>
    {message && <p role="status">{message}</p>}
  </form>
}

export function ExpirationsPanel({ record, onShowAll }: { record: string | null; onShowAll: () => void }) {
  const [offset, setOffset] = useState(0)
  const { query, mutation } = useExecutiveExpirations(record, offset)
  useAdminRecordFocus(query.data ? 'executive-expirations' : null)
  return <section className="card executive-interventions" id="executive-expirations" tabIndex={-1} aria-labelledby="executive-expiry-title">
    <header><h2 id="executive-expiry-title">Termenele deciziilor și documentelor</h2><button className="btn" onClick={() => void query.refetch()}>Reîncarcă termenele</button></header>
    <p>Termene operaționale explicite, înregistrate din documentul sursă. Nu modifică automat valabilitatea juridică sau publicarea. Un câmp gol înseamnă „termen neînregistrat”, nu „valabil nelimitat”.</p>
    {record && <button className="btn" onClick={onShowAll}>Toate deciziile și documentele</button>}
    {mutation.isError && <p role="alert">{mutation.error.message}</p>}
    {query.isPending ? <p role="status">Se încarcă termenele…</p> : query.isError ? <p role="alert">{query.error.message}</p> : <>
      {!query.data.canManage && <p>Consultare. Înregistrarea termenelor necesită capabilitatea de administrare a țintelor executive.</p>}
      {query.data.rows.length === 0 && <p>Nu există înregistrări pentru selecția curentă.</p>}
      {query.data.rows.map((row) => <article key={`${row.source}:${row.id}`} className="executive-interventions__item">
        <h3>{row.title}</h3><p>Termen înregistrat: {row.expiresOn ?? 'Nespecificat'}</p>
        {query.data.canManage && <ExpiryForm key={`${row.source}:${row.id}:${row.expiresOn}`} row={row} saving={mutation.isPending} onSave={(expiresOn) => mutation.mutateAsync({ row, expiresOn })} />}
      </article>)}
      <div className="executive-interventions__actions"><button className="btn" disabled={offset === 0 || query.isFetching} onClick={() => setOffset(Math.max(0, offset - 20))}>Termenele anterioare</button>
        <span>{query.data.total} înregistrări</span><button className="btn" disabled={offset + 20 >= query.data.total || query.isFetching} onClick={() => setOffset(offset + 20)}>Următoarele termene</button></div>
    </>}
  </section>
}
