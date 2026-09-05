import { useState, type FormEvent } from 'react'
import { useAdminWorkspace } from '@features/adminShell/AdminContext'
import { OrganizationSelect } from './OrganizationSelect'
import { useAdminRegister } from './useAdminRegister'

type Congress = {
  id: string; organizationId: string; title: string; purpose: 'ordinary' | 'extraordinary' | 'founding'
  status: 'draft' | 'open' | 'closed' | 'validated' | 'cancelled'
  startsAt: string; endsAt: string; quorum: number; delegateCount: number; votedDelegateCount: number
}
const statuses = { draft: 'În pregătire', open: 'Deschis', closed: 'Închis, de validat', validated: 'Validat', cancelled: 'Anulat' }
const purposes = { ordinary: 'Ordinar', extraordinary: 'Extraordinar', founding: 'De constituire' }
const transitions = { draft: { status: 'open', label: 'Deschide congresul' }, open: { status: 'closed', label: 'Închide congresul' }, closed: { status: 'validated', label: 'Validează congresul' } }

export function CongressPage() {
  const { access } = useAdminWorkspace()
  const { query, mutation } = useAdminRegister<Congress>('/api/admin/congresses')
  const canManage = access.capabilities.includes('congress.manage')
  const [creating, setCreating] = useState(false)
  const [confirmation, setConfirmation] = useState<Congress | null>(null)
  const [message, setMessage] = useState('')
  const [formError, setFormError] = useState('')
  const [pendingOnly, setPendingOnly] = useState(false)

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setMessage(''); setFormError('')
    const startsAt = new Date(String(form.get('startsAt')))
    const endsAt = new Date(String(form.get('endsAt')))
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
      setFormError('Închiderea trebuie să fie după deschidere.'); return
    }
    try {
      await mutation.mutateAsync({ suffix: '', body: {
        organizationId: form.get('organizationId'), title: form.get('title'), purpose: form.get('purpose'),
        startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), quorum: Number(form.get('quorum')),
      } })
      setCreating(false); setMessage('Congresul a fost creat în pregătire.')
    } catch { /* The mutation error is displayed and the form is preserved. */ }
  }

  async function transition(congress: Congress) {
    if (!(congress.status in transitions)) return
    const next = transitions[congress.status as keyof typeof transitions]
    setMessage('')
    try {
      await mutation.mutateAsync({ suffix: `/${encodeURIComponent(congress.id)}/status`, body: { status: next.status } })
      setConfirmation(null); setMessage('Starea congresului a fost actualizată.')
    } catch { /* Server enforces transitions, scope and quorum. */ }
  }

  const rows = query.data?.filter((item) => !pendingOnly || ['draft', 'open', 'closed'].includes(item.status)) ?? []
  return <section className="admin-register">
    <header><div><h1>Congres</h1><p>Calendar, cvorum și validarea congreselor din aria autorizată.</p></div>
      <div className="admin-register__actions">
        {canManage && <button className="btn primary" onClick={() => { setCreating(!creating); mutation.reset(); setFormError('') }}>Congres nou</button>}
        <button className="btn" disabled={query.isFetching} onClick={() => void query.refetch()}>Reîncarcă</button>
      </div>
    </header>
    {!canManage && <p className="muted">Acces de consultare. Modificările necesită capabilitatea de administrare a congreselor.</p>}
    {message && <p role="status">{message}</p>}
    {mutation.isError && <p role="alert">{mutation.error.message}</p>}
    {formError && <p role="alert">{formError}</p>}
    {creating && canManage && <form className="card admin-workspace__panel" onSubmit={(event) => void create(event)}>
      <h2>Congres nou</h2>
      <OrganizationSelect />
      <label>Titlu<input name="title" required minLength={5} maxLength={180} /></label>
      <label>Tip<select name="purpose">{Object.entries(purposes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <p className="muted">Datele sunt introduse în fusul orar al dispozitivului.</p>
      <label>Deschidere<input type="datetime-local" name="startsAt" required /></label>
      <label>Închidere<input type="datetime-local" name="endsAt" required /></label>
      <label>Cvorum (delegați prezenți)<input type="number" name="quorum" min={1} step={1} required /></label>
      <div className="admin-register__actions"><button className="btn primary" disabled={mutation.isPending}>Creează în pregătire</button><button type="button" className="btn" disabled={mutation.isPending} onClick={() => setCreating(false)}>Renunță</button></div>
    </form>}
    <label><span><input type="checkbox" checked={pendingOnly} onChange={(event) => setPendingOnly(event.target.checked)} /> Numai congrese nefinalizate</span></label>
    {query.isPending ? <p role="status">Se încarcă congresele…</p> : query.isError ? <p role="alert">{query.error.message}</p> : rows.length === 0 ? <p>Nu există congrese pentru selecția curentă.</p> :
      <div className="admin-register__list">{rows.map((item) => <article className="card admin-workspace__panel" key={item.id}>
        <header className="admin-register__record-header"><div><h2>{item.title}</h2><p>{purposes[item.purpose]} · Organizație: {item.organizationId}</p></div><span className="admin-register__status">{statuses[item.status]}</span></header>
        <dl className="admin-register__facts">
          <div><dt>Deschidere</dt><dd>{new Date(item.startsAt).toLocaleString('ro-RO')}</dd></div>
          <div><dt>Închidere</dt><dd>{new Date(item.endsAt).toLocaleString('ro-RO')}</dd></div>
          <div><dt>Cvorum</dt><dd>{item.quorum} delegați</dd></div>
          <div><dt>Delegați înscriși</dt><dd>{item.delegateCount}</dd></div>
          <div><dt>Delegați care au votat</dt><dd>{item.votedDelegateCount}</dd></div>
        </dl>
        {canManage && item.status in transitions && <div className="admin-register__actions">
          {confirmation?.id === item.id ? <div role="group" aria-label={`Confirmare pentru ${item.title}`}>
            <p>{item.status === 'closed' ? 'Validarea face rezultatele disponibile public. Confirmi?' : 'Confirmi schimbarea stării congresului? Închiderea necesită cvorumul verificat de server.'}</p>
            <button className="btn primary" disabled={mutation.isPending} onClick={() => void transition(item)}>Confirmă schimbarea</button>{' '}
            <button className="btn" disabled={mutation.isPending} onClick={() => setConfirmation(null)}>Renunță</button>
          </div> : <button className="btn" disabled={mutation.isPending} onClick={() => { setConfirmation(item); mutation.reset() }}>{transitions[item.status as keyof typeof transitions].label}</button>}
        </div>}
      </article>)}</div>}
  </section>
}
