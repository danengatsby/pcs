import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@features/auth/context'
import { apiGet } from '@lib/http'

const labels: Record<string, string> = {
  'treasury.create': 'Înregistrare creată', 'treasury.update': 'Ciornă modificată', 'treasury.post': 'Operațiune confirmată', 'treasury.void': 'Operațiune anulată',
  'parliamentary.create': 'Inițiativă creată', 'parliamentary.update': 'Inițiativă actualizată', 'parliamentary.status': 'Etapă actualizată',
}
type HistoryEntry = { id: string; action: string; actorName: string; createdAt: string; details: { reason?: string } }

export function RecordHistory({ path }: { path: string }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const query = useQuery({ queryKey: ['admin', 'record-history', user?.id, path], enabled: open, queryFn: async () => {
    const result = await apiGet<HistoryEntry[]>(`${path}/history`, { auth: true })
    if (!result.ok) throw new Error(result.error.message)
    return result.data
  } })
  return <details onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>Istoric și responsabilitate</summary>
    {open && (query.isPending ? <p role="status">Se încarcă istoricul…</p> : query.isError ? <p role="alert">{query.error.message} <button className="btn" onClick={() => void query.refetch()}>Reîncearcă</button></p> : <>
      <p className="muted">Ultimele 50 de operații, cu titularul și momentul efectuării.</p>
      <ol>{query.data.map((entry) => <li key={entry.id}><strong>{labels[entry.action] ?? 'Actualizare'}</strong> · {entry.actorName} · {new Date(entry.createdAt).toLocaleString('ro-RO')}{entry.details.reason && <p>{entry.details.reason}</p>}</li>)}</ol>
    </>)}
  </details>
}

export function RegisterPagination({ offset, total, onChange, busy }: { offset: number; total: number; onChange: (offset: number) => void; busy: boolean }) {
  return <nav className="admin-register__actions" aria-label="Paginarea registrului">
    <button className="btn" disabled={busy || offset === 0} onClick={() => onChange(Math.max(0, offset - 25))}>Pagina precedentă</button>
    <span>{total === 0 ? '0 înregistrări' : `${offset + 1}–${Math.min(offset + 25, total)} din ${total}`}</span>
    <button className="btn" disabled={busy || offset + 25 >= total || offset + 25 > 10000} onClick={() => onChange(offset + 25)}>Pagina următoare</button>
  </nav>
}
