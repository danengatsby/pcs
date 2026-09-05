import { useState, type FormEvent } from 'react'
import { useAdminWorkspace } from '@features/adminShell/AdminContext'
import { OrganizationSelect } from './OrganizationSelect'
import { useAdminRegister } from './useAdminRegister'

type ArbitrationCase = {
  id: string; caseNumber: string; organizationId: string | null; caseType: string; subject: string
  status: string; filedAt: string; responseDueAt: string | null; decidedAt: string | null
}
const statuses: Record<string, string> = { submitted: 'Depus', response_due: 'Așteaptă răspuns', hearing: 'În examinare', decided: 'Soluționat', appealed: 'Contestat', closed: 'Închis', dismissed: 'Clasat' }
const types: Record<string, string> = { disciplinary: 'Disciplinar', member_dispute: 'Litigiu între membri', competence: 'Competență', election: 'Electoral', other: 'Altă sesizare' }
const pendingStatuses = ['submitted', 'response_due', 'hearing', 'appealed']

export function ArbitrationPage() {
  const { access } = useAdminWorkspace()
  const { query, mutation } = useAdminRegister<ArbitrationCase>('/api/admin/arbitration/cases')
  const canManage = access.capabilities.includes('arbitration.manage')
  const [creating, setCreating] = useState(false)
  const [message, setMessage] = useState('')
  const [pendingOnly, setPendingOnly] = useState(false)

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setMessage('')
    try {
      await mutation.mutateAsync({ suffix: '', body: {
        organizationId: form.get('organizationId') || null, caseType: form.get('caseType'), subject: form.get('subject'),
        facts: form.get('facts'), legalBasis: form.get('legalBasis'),
        responseDueAt: form.get('responseDueAt') ? new Date(String(form.get('responseDueAt'))).toISOString() : null,
      } })
      setCreating(false); setMessage('Dosarul a fost înregistrat.')
    } catch { /* Preserve the confidential form on failure; no logging or local storage. */ }
  }

  const rows = query.data?.filter((item) => !pendingOnly || pendingStatuses.includes(item.status)) ?? []
  return <section className="admin-register">
    <header><div><h1>Arbitraj</h1><p>Registrul confidențial al sesizărilor și termenelor din aria autorizată.</p></div>
      <div className="admin-register__actions">
        {canManage && <button className="btn primary" onClick={() => { setCreating(!creating); mutation.reset() }}>Dosar nou</button>}
        <button className="btn" disabled={query.isFetching} onClick={() => void query.refetch()}>Reîncarcă</button>
      </div>
    </header>
    {!canManage && <p className="muted">Acces de consultare. Înregistrarea sesizărilor necesită capabilitatea de administrare a arbitrajului.</p>}
    {message && <p role="status">{message}</p>}
    {mutation.isError && <p role="alert">{mutation.error.message}</p>}
    {creating && canManage && <form className="card admin-workspace__panel" onSubmit={(event) => void create(event)}>
      <h2>Înregistrează o sesizare</h2><OrganizationSelect allowNational />
      <label>Tipul dosarului<select name="caseType">{Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Subiect<input name="subject" required minLength={5} maxLength={180} /></label>
      <label>Situația de fapt<textarea name="facts" required minLength={20} maxLength={20000} rows={6} /></label>
      <label>Temei statutar invocat<textarea name="legalBasis" maxLength={5000} rows={3} /></label>
      <label>Termen de răspuns (opțional, ora dispozitivului)<input name="responseDueAt" type="datetime-local" /></label>
      <div className="admin-register__actions"><button className="btn primary" disabled={mutation.isPending}>Înregistrează dosarul</button><button className="btn" type="button" disabled={mutation.isPending} onClick={() => setCreating(false)}>Renunță</button></div>
    </form>}
    <label><span><input type="checkbox" checked={pendingOnly} onChange={(event) => setPendingOnly(event.target.checked)} /> Numai dosare de soluționat</span></label>
    {query.isPending ? <p role="status">Se încarcă dosarele…</p> : query.isError ? <p role="alert">{query.error.message}</p> : rows.length === 0 ? <p>Nu există dosare pentru selecția curentă.</p> :
      <div className="admin-register__list">{rows.map((item) => <article className="card admin-workspace__panel" key={item.id}>
        <h2>{item.caseNumber} · {item.subject}</h2><p>{statuses[item.status] ?? item.status} · {types[item.caseType] ?? item.caseType}</p>
        <p>Organizație: {item.organizationId ?? 'Jurisdicție națională'}</p><p>Depus: {new Date(item.filedAt).toLocaleString('ro-RO')}</p>
        <p>Termen de răspuns: {item.responseDueAt ? new Date(item.responseDueAt).toLocaleString('ro-RO') : 'Nestabilit'}
          {item.responseDueAt && Date.parse(item.responseDueAt) < query.dataUpdatedAt && pendingStatuses.includes(item.status) && <strong> · Termen depășit</strong>}</p>
        {item.decidedAt && <p>Soluționat: {new Date(item.decidedAt).toLocaleString('ro-RO')}</p>}
      </article>)}</div>}
  </section>
}
