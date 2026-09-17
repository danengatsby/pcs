import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@features/auth/context'
import { useAdminWorkspace } from '@features/adminShell/AdminContext'
import { apiGet } from '@lib/http'
import { RecordHistory, RegisterPagination } from './RecordHistory'
import { useWorkspaceRegister } from './useWorkspaceRegister'

const basePath = '/api/admin/parliamentary/items'
const kinds: Record<string, string> = { bill: 'Inițiativă legislativă', amendment: 'Amendament', question: 'Întrebare / interpelare', committee_work: 'Activitate de comisie' }
const chambers: Record<string, string> = { deputies: 'Camera Deputaților', senate: 'Senat', joint: 'Activitate comună' }
const statuses: Record<string, string> = { draft: 'În pregătire', submitted: 'Depusă', committee: 'În comisie', scheduled: 'Pe ordinea de zi', adopted: 'Adoptată / finalizată', rejected: 'Respinsă', withdrawn: 'Retrasă' }
type Item = { id: string; title: string; kind: string; chamber: string; reference: string; sourceUrl: string; description: string; assignedTo: string | null; assignedToName: string | null; dueOn: string | null; status: string; version: number; createdByName: string; nextStatuses: string[] }
type Register = { rows: Item[]; total: number }

export function ParliamentaryPage() {
  const { user } = useAuth()
  const { access } = useAdminWorkspace()
  const canManage = access.capabilities.includes('parliamentary.manage')
  const [filters, setFilters] = useState('')
  const [offset, setOffset] = useState(0)
  const { query, mutation } = useWorkspaceRegister<Register>(basePath, `${filters}&limit=25&offset=${offset}`)
  const [editor, setEditor] = useState<{ requestId: string; row?: Item } | null>(null)
  const [transition, setTransition] = useState<Item | null>(null)
  const [message, setMessage] = useState('')
  const assignees = useQuery({ queryKey: ['admin', 'parliamentary-assignees', user?.id], enabled: !!editor && canManage, queryFn: async () => {
    const result = await apiGet<Array<{ id: string; fullName: string }>>('/api/admin/parliamentary/assignees', { auth: true })
    if (!result.ok) throw new Error(result.error.message)
    return result.data
  } })

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editor || mutation.isPending || !assignees.data || assignees.isError) return
    const data = new FormData(event.currentTarget)
    const body = { title: data.get('title'), kind: data.get('kind'), chamber: data.get('chamber'), reference: data.get('reference'), sourceUrl: data.get('sourceUrl'),
      description: data.get('description'), assignedTo: data.get('assignedTo') || null, dueOn: data.get('dueOn') || null,
      ...(editor.row ? { version: editor.row.version } : { requestId: editor.requestId }) }
    try {
      await mutation.mutateAsync({ suffix: editor.row ? `/${editor.row.id}` : '', method: editor.row ? 'PATCH' : 'POST', body })
      setEditor(null); setMessage('Inițiativa a fost salvată în registrul intern.')
    } catch { /* Preserve the form after validation or concurrency errors. */ }
  }
  async function changeStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!transition || mutation.isPending) return
    const data = new FormData(event.currentTarget)
    try {
      await mutation.mutateAsync({ suffix: `/${transition.id}/status`, body: { version: transition.version, status: data.get('status'), reason: data.get('reason') } })
      setTransition(null); setMessage('Etapa inițiativei a fost actualizată și justificarea a fost păstrată în istoric.')
    } catch { /* Stale versions and invalid stage changes are rejected by the API. */ }
  }
  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const params = new URLSearchParams()
    for (const [key, value] of new FormData(event.currentTarget)) if (String(value).trim()) params.set(key, String(value).trim())
    setFilters(params.toString()); setOffset(0)
  }
  return <section className="admin-register">
    <header><div><h1>Grup parlamentar</h1><p>Urmărește inițiativele, responsabilii și termenele. Actualizările consemnează activitatea în registrul intern; depunerea oficială se face prin procedura parlamentară.</p></div>
      <div className="admin-register__actions">{canManage && <button className="btn primary" disabled={mutation.isPending} onClick={() => { setEditor({ requestId: crypto.randomUUID() }); setTransition(null); setMessage(''); mutation.reset() }}>Inițiativă nouă</button>}<button className="btn" disabled={query.isFetching} onClick={() => void query.refetch()}>Reîncarcă</button></div>
    </header>
    <form className="admin-register__actions" onSubmit={applyFilters}>
      <label>Caută în registru<input name="search" maxLength={120} /></label>
      <label>Cameră<select name="chamber"><option value="">Toate</option>{Object.entries(chambers).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Etapă<select name="status"><option value="">Toate</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label><input name="pending" value="true" type="checkbox" /> Fără responsabil sau cu termen depășit</label><button className="btn">Aplică filtrele</button>
    </form>
    {message && <p role="status">{message}</p>}{mutation.isError && <p role="alert">{mutation.error.message}</p>}
    {editor && canManage && <form key={editor.requestId} className="card admin-workspace__panel" onSubmit={(event) => void save(event)}>
      <h2>{editor.row ? 'Modifică inițiativa' : 'Înregistrează o inițiativă'}</h2>
      {assignees.isError && <p role="alert">Responsabilii nu au putut fi încărcați. <button className="btn" type="button" onClick={() => void assignees.refetch()}>Reîncearcă</button></p>}
      <fieldset disabled={mutation.isPending || assignees.isPending || assignees.isError}>
        <label>Titlu<input name="title" minLength={5} maxLength={240} required defaultValue={editor.row?.title} /></label>
        <label>Tipul activității<select name="kind" defaultValue={editor.row?.kind ?? 'bill'}>{Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Camera parlamentară<select name="chamber" defaultValue={editor.row?.chamber ?? 'deputies'}>{Object.entries(chambers).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Referință oficială<input name="reference" maxLength={100} defaultValue={editor.row?.reference} /></label>
        <label>Sursă oficială (HTTPS)<input name="sourceUrl" type="url" pattern="https://.*" maxLength={2000} defaultValue={editor.row?.sourceUrl} /></label>
        <label>Descriere<textarea name="description" minLength={10} maxLength={10000} rows={5} required defaultValue={editor.row?.description} /></label>
        {assignees.data && <label>Responsabil<select name="assignedTo" defaultValue={editor.row?.assignedTo ?? ''}>
          <option value="">De desemnat</option>
          {editor.row?.assignedTo && !assignees.data.some((person) => person.id === editor.row?.assignedTo) && <option value={editor.row.assignedTo} disabled>{editor.row.assignedToName ?? 'Fost responsabil'} — mandat indisponibil</option>}
          {assignees.data.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}
        </select></label>}
        <label>Termen<input name="dueOn" type="date" min="2000-01-01" max="2100-12-31" defaultValue={editor.row?.dueOn ?? ''} /></label>
        <div className="admin-register__actions"><button className="btn primary">Salvează inițiativa</button><button className="btn" type="button" onClick={() => setEditor(null)}>Renunță</button></div>
      </fieldset>
    </form>}
    {transition && <form className="card admin-workspace__panel" onSubmit={(event) => void changeStatus(event)}>
      <h2>Actualizează etapa</h2><p>{transition.title} · Etapa curentă: {statuses[transition.status]}</p><fieldset disabled={mutation.isPending}>
        <label>Etapa următoare<select name="status" required>{transition.nextStatuses.map((value) => <option key={value} value={value}>{statuses[value]}</option>)}</select></label>
        <label>Justificare și referință<textarea name="reason" minLength={10} maxLength={2000} required /></label>
        <div className="admin-register__actions"><button className="btn primary">Confirmă schimbarea</button><button className="btn" type="button" onClick={() => setTransition(null)}>Renunță</button></div>
      </fieldset>
    </form>}
    {query.isPending ? <p role="status">Se încarcă inițiativele…</p> : query.isError ? <p role="alert">{query.error.message}</p> : <>
      {query.data.rows.length === 0 ? <p>Nu există inițiative pentru selecția curentă.</p> : <div className="admin-register__list">{query.data.rows.map((row) => <article key={row.id} className="card admin-workspace__panel">
        <header className="admin-register__record-header"><h2>{row.title}</h2><span className="admin-register__status">{statuses[row.status]}</span></header>
        <p>{kinds[row.kind]} · {chambers[row.chamber]}</p><p style={{ whiteSpace: 'pre-wrap' }}>{row.description}</p>
        <dl className="admin-register__facts"><div><dt>Responsabil</dt><dd>{row.assignedToName ?? 'De desemnat'}</dd></div><div><dt>Referință</dt><dd>{row.reference || 'Necompletată'}</dd></div><div><dt>Termen</dt><dd>{row.dueOn ?? 'Nestabilit'}{row.dueOn && row.dueOn < new Date(query.dataUpdatedAt).toISOString().slice(0, 10) && row.nextStatuses.length > 0 && <strong>Termen depășit</strong>}</dd></div><div><dt>Înregistrat de</dt><dd>{row.createdByName}</dd></div></dl>
        {row.sourceUrl && <p><a href={row.sourceUrl} target="_blank" rel="noopener noreferrer">Consultă sursa oficială</a></p>}
        {canManage && row.nextStatuses.length > 0 && <div className="admin-register__actions"><button className="btn" disabled={mutation.isPending} onClick={() => { setEditor({ requestId: crypto.randomUUID(), row }); setTransition(null); mutation.reset() }}>Modifică</button><button className="btn primary" disabled={mutation.isPending} onClick={() => { setTransition(row); setEditor(null); mutation.reset() }}>Actualizează etapa</button></div>}
        <RecordHistory path={`${basePath}/${row.id}`} />
      </article>)}</div>}
      <RegisterPagination offset={offset} total={query.data.total} onChange={setOffset} busy={query.isFetching} />
    </>}
  </section>
}
