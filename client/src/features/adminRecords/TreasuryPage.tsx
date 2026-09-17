import { useState, type FormEvent } from 'react'
import { useAdminWorkspace } from '@features/adminShell/AdminContext'
import { OrganizationSelect } from '@features/adminGovernance/OrganizationSelect'
import { RecordHistory, RegisterPagination } from './RecordHistory'
import { useWorkspaceRegister } from './useWorkspaceRegister'

const basePath = '/api/admin/treasury/entries'
const kinds: Record<string, string> = { income: 'Încasare', expense: 'Cheltuială' }
const categories: Record<string, string> = { membership_fee: 'Cotizație', donation: 'Donație', subsidy: 'Subvenție', operations: 'Funcționare', event: 'Eveniment', other: 'Altele' }
const statuses: Record<string, string> = { draft: 'Ciornă', posted: 'Confirmată', voided: 'Anulată' }
const money = (value: string) => Number(value).toLocaleString('ro-RO', { style: 'currency', currency: 'RON' })
type Entry = { id: string; organizationId: string | null; organizationName: string | null; kind: string; category: string; amount: string; occurredOn: string; description: string; reference: string; status: string; version: number; createdByName: string; postedByName: string | null; voidReason: string | null }
type Register = { rows: Entry[]; total: number; totals: { income: string; expense: string; balance: string } }

export function TreasuryPage() {
  const { access } = useAdminWorkspace()
  const canManage = access.capabilities.includes('finance.manage')
  const [filters, setFilters] = useState('')
  const [offset, setOffset] = useState(0)
  const { query, mutation } = useWorkspaceRegister<Register>(basePath, `${filters}&limit=25&offset=${offset}`)
  const [editor, setEditor] = useState<{ requestId: string; row?: Entry } | null>(null)
  const [confirmation, setConfirmation] = useState<{ action: 'post' | 'void'; row: Entry } | null>(null)
  const [message, setMessage] = useState('')

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editor || mutation.isPending) return
    const data = new FormData(event.currentTarget)
    if (!data.has('organizationId')) { setMessage('Așteaptă încărcarea organizațiilor sau reîncearcă selecția înainte de salvare.'); return }
    const body = { organizationId: data.get('organizationId') || null, kind: data.get('kind'), category: data.get('category'),
      amount: String(data.get('amount')).replace(',', '.'), occurredOn: data.get('occurredOn'), description: data.get('description'), reference: data.get('reference'),
      ...(editor.row ? { version: editor.row.version } : { requestId: editor.requestId }) }
    try {
      await mutation.mutateAsync({ suffix: editor.row ? `/${editor.row.id}` : '', method: editor.row ? 'PATCH' : 'POST', body })
      setEditor(null); setMessage('Ciorna a fost salvată. Confirmă operațiunea după verificarea documentului.')
    } catch { /* Keep entered values available for correction or retry. */ }
  }
  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!confirmation || mutation.isPending) return
    const data = new FormData(event.currentTarget)
    try {
      await mutation.mutateAsync({ suffix: `/${confirmation.row.id}/${confirmation.action}`, body: {
        version: confirmation.row.version, ...(confirmation.action === 'post' ? { confirmed: true } : { reason: data.get('reason') }),
      } })
      setMessage(confirmation.action === 'post' ? 'Operațiunea a fost confirmată și inclusă în totaluri.' : 'Operațiunea a fost anulată. Motivul rămâne în istoric.')
      setConfirmation(null)
    } catch { /* The server rejects stale confirmations without overwriting changes. */ }
  }
  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const params = new URLSearchParams()
    for (const [key, value] of new FormData(event.currentTarget)) if (String(value).trim()) params.set(key, String(value).trim())
    setFilters(params.toString()); setOffset(0)
  }
  return <section className="admin-register">
    <header><div><h1>Trezorerie</h1><p>Evidența internă a încasărilor și cheltuielilor în lei, cu document justificativ și titularul fiecărei operații.</p></div>
      <div className="admin-register__actions">{canManage && <button className="btn primary" disabled={mutation.isPending} onClick={() => { setEditor({ requestId: crypto.randomUUID() }); setConfirmation(null); setMessage(''); mutation.reset() }}>Operațiune nouă</button>}<button className="btn" disabled={query.isFetching} onClick={() => void query.refetch()}>Reîncarcă</button></div>
    </header>
    <form className="admin-register__actions" onSubmit={applyFilters}>
      <label>Caută în registru<input name="search" maxLength={120} /></label>
      <label>An<input name="year" type="number" min={2000} max={2100} /></label>
      <label>Tip<select name="kind"><option value="">Toate</option>{Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Stare<select name="status"><option value="">Toate</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button className="btn">Aplică filtrele</button>
    </form>
    {query.data && !query.isError && <div className="card admin-workspace__panel"><h2>Totaluri confirmate pentru selecția curentă</h2><dl className="admin-register__facts">
      <div><dt>Încasări</dt><dd>{money(query.data.totals.income)}</dd></div><div><dt>Cheltuieli</dt><dd>{money(query.data.totals.expense)}</dd></div><div><dt>Sold</dt><dd>{money(query.data.totals.balance)}</dd></div>
    </dl><p className="muted">Totalurile includ toate paginile selecției. Ciornele și operațiunile anulate nu intră în sold. Acest registru este intern.</p></div>}
    {message && <p role="status">{message}</p>}{mutation.isError && <p role="alert">{mutation.error.message}</p>}
    {editor && canManage && <form key={editor.requestId} className="card admin-workspace__panel" onSubmit={(event) => void save(event)}>
      <h2>{editor.row ? 'Modifică ciorna' : 'Înregistrează o operațiune'}</h2><fieldset disabled={mutation.isPending}>
        <OrganizationSelect allowNational defaultValue={editor.row?.organizationId ?? ''} nationalLabel="Operațiune națională (fără filială)" />
        <label>Tipul operațiunii<select name="kind" defaultValue={editor.row?.kind ?? 'income'}>{Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Categorie<select name="category" defaultValue={editor.row?.category ?? 'other'}>{Object.entries(categories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Sumă (RON)<input name="amount" type="number" min="0.01" max="999999999.99" step="0.01" required defaultValue={editor.row?.amount} /></label>
        <label>Data operațiunii<input name="occurredOn" type="date" min="2000-01-01" max="2100-12-31" required defaultValue={editor.row?.occurredOn ?? new Date().toISOString().slice(0, 10)} /></label>
        <label>Descriere<input name="description" minLength={5} maxLength={500} required defaultValue={editor.row?.description} /></label>
        <label>Referință document justificativ<input name="reference" minLength={3} maxLength={180} required defaultValue={editor.row?.reference} /></label>
        <div className="admin-register__actions"><button className="btn primary">Salvează ciorna</button><button className="btn" type="button" onClick={() => setEditor(null)}>Renunță</button></div>
      </fieldset>
    </form>}
    {confirmation && <form className="card admin-workspace__panel" onSubmit={(event) => void confirm(event)}><h2>{confirmation.action === 'post' ? 'Confirmă operațiunea' : 'Anulează operațiunea'}</h2>
      <p>{confirmation.row.description} · {money(confirmation.row.amount)} · {confirmation.row.reference}</p><fieldset disabled={mutation.isPending}>
        {confirmation.action === 'post' ? <label><input type="checkbox" required /> Am verificat suma și documentul justificativ. După confirmare, operațiunea nu mai poate fi editată.</label> : <label>Motivul anulării<textarea name="reason" minLength={10} maxLength={2000} required /></label>}
        <div className="admin-register__actions"><button className="btn primary">{confirmation.action === 'post' ? 'Confirmă înregistrarea' : 'Confirmă anularea'}</button><button className="btn" type="button" onClick={() => setConfirmation(null)}>Renunță</button></div>
      </fieldset>
    </form>}
    {query.isPending ? <p role="status">Se încarcă trezoreria…</p> : query.isError ? <p role="alert">{query.error.message}</p> : <>
      {query.data.rows.length === 0 ? <p>Nu există operațiuni pentru selecția curentă.</p> : <div className="admin-register__list">{query.data.rows.map((row) => <article key={row.id} className="card admin-workspace__panel">
        <header className="admin-register__record-header"><h2>{row.description}</h2><span className="admin-register__status">{statuses[row.status]}</span></header>
        <p><strong>{kinds[row.kind]} · {money(row.amount)}</strong> · {categories[row.category]}</p>
        <dl className="admin-register__facts"><div><dt>Data</dt><dd>{row.occurredOn}</dd></div><div><dt>Organizație</dt><dd>{row.organizationName ?? 'Național'}</dd></div><div><dt>Document</dt><dd>{row.reference}</dd></div><div><dt>Înregistrat de</dt><dd>{row.createdByName}</dd></div>{row.postedByName && <div><dt>Confirmat de</dt><dd>{row.postedByName}</dd></div>}</dl>
        {row.voidReason && <p>Motivul anulării: {row.voidReason}</p>}
        {canManage && row.status !== 'voided' && <div className="admin-register__actions">
          {row.status === 'draft' && <><button className="btn" disabled={mutation.isPending} onClick={() => { setEditor({ requestId: crypto.randomUUID(), row }); setConfirmation(null); mutation.reset() }}>Modifică</button><button className="btn primary" disabled={mutation.isPending} onClick={() => { setConfirmation({ action: 'post', row }); setEditor(null); mutation.reset() }}>Confirmă operațiunea</button></>}
          <button className="btn" disabled={mutation.isPending} onClick={() => { setConfirmation({ action: 'void', row }); setEditor(null); mutation.reset() }}>Anulează cu motiv</button>
        </div>}<RecordHistory path={`${basePath}/${row.id}`} />
      </article>)}</div>}
      <RegisterPagination offset={offset} total={query.data.total} onChange={setOffset} busy={query.isFetching} />
    </>}
  </section>
}
