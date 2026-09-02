import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input, Select } from '@components'
import { useAuth } from '@features/auth/context'
import { mobilizationInterests } from '@features/mobilization/config'
import { usePoliticalOperations } from '../hooks/usePoliticalOperations'
import type { CommunicationAudience, PoliticalAction, PoliticalOperationsData } from '../types'

function isoOrNull(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}

function ActionCard({ action, data, saving, addParticipant, updateParticipant, updateAction }: {
  action: PoliticalAction
  data: PoliticalOperationsData
  saving: boolean
  addParticipant: (id: string, email: string, dueAt: string | null, notes: string) => Promise<unknown>
  updateParticipant: (id: string, input: { status?: string; attendanceStatus?: string }) => Promise<unknown>
  updateAction: (id: string, input: { status?: string; resultValue?: number | null; resultSummary?: string; expectedVersion: number }) => Promise<unknown>
}) {
  const [email, setEmail] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [notes, setNotes] = useState('')
  const [resultValue, setResultValue] = useState(action.resultValue === null ? '' : String(action.resultValue))
  const [resultSummary, setResultSummary] = useState(action.resultSummary)

  async function submitParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email) return
    try {
      await addParticipant(action.id, email, isoOrNull(dueAt), notes)
      setEmail('')
      setNotes('')
    } catch {
      return
    }
  }

  return (
    <article className="card political-ops__action">
      <header className="political-ops__action-header">
        <div><span className="hero-kicker">{action.type === 'event' ? 'Eveniment' : action.type === 'campaign' ? 'Campanie' : 'Sarcină'}</span><h2>{action.title}</h2></div>
        <span className="status-pill">{action.status} · {action.visibility}</span>
      </header>
      <p>{action.summary}</p>
      <p><strong>Obiectiv:</strong> {action.objective}</p>
      <p className="muted">Coordonator: {action.coordinator?.fullName || 'neasignat'} · Județe: {action.counties.map((county) => county.name).join(', ') || 'național'}</p>
      <div className="political-ops__metrics">
        <span>Invitați <strong>{action.metrics.invited}</strong></span>
        <span>Confirmați <strong>{action.metrics.confirmed}</strong></span>
        <span>Prezenți <strong>{action.metrics.present}</strong></span>
        <span>Ore raportate <strong>{action.metrics.reportedHours}</strong></span>
      </div>

      <details className="political-ops__details">
        <summary>Participanți și raportare ({action.participants.length})</summary>
        <form className="political-ops__inline-form" onSubmit={(event) => void submitParticipant(event)}>
          <Select label="Membru / voluntar" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="Alege persoana" options={data.candidates.map((candidate) => ({ value: candidate.email, label: `${candidate.fullName} — ${candidate.county || candidate.membershipStatus}` }))} />
          {action.type !== 'event' ? <Input label="Termen" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /> : null}
          <Input label="Instrucțiuni" value={notes} onChange={(event) => setNotes(event.target.value)} />
          <Button type="submit" variant="primary" loading={saving}>Adaugă</Button>
        </form>
        <div className="political-ops__participants">
          {action.participants.map((participant) => (
            <div key={participant.id}>
              <span><strong>{participant.fullName}</strong><small>{participant.status} · {participant.hours} ore</small></span>
              {action.type === 'event' ? (
                <div><Button disabled={saving} onClick={() => void updateParticipant(participant.id, { attendanceStatus: 'present', status: 'completed' })}>Prezent</Button><Button disabled={saving} onClick={() => void updateParticipant(participant.id, { attendanceStatus: 'absent' })}>Absent</Button></div>
              ) : <Button disabled={saving} onClick={() => void updateParticipant(participant.id, { status: 'completed' })}>Validează raportul</Button>}
            </div>
          ))}
        </div>
      </details>

      <details className="political-ops__details">
        <summary>Rezultat și închidere</summary>
        <form className="political-ops__inline-form" onSubmit={(event) => { event.preventDefault(); void updateAction(action.id, { status: 'closed', resultValue: resultValue ? Number(resultValue) : null, resultSummary, expectedVersion: action.version }) }}>
          <Input label={action.targetMetric || 'Rezultat numeric'} type="number" min="0" value={resultValue} onChange={(event) => setResultValue(event.target.value)} />
          <Input label="Rezumat rezultat" value={resultSummary} onChange={(event) => setResultSummary(event.target.value)} />
          <Button type="submit" loading={saving}>Închide și salvează</Button>
        </form>
      </details>
    </article>
  )
}

export function PoliticalOperationsPage() {
  const { user } = useAuth()
  const { data, loading, saving, error, reload, createAction, addParticipant, updateParticipant, updateAction, preview, dispatch } = usePoliticalOperations()
  const [createStatus, setCreateStatus] = useState<string | null>(null)
  const [type, setType] = useState<'event' | 'campaign' | 'volunteer_task'>('event')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [objective, setObjective] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [coordinatorUserId, setCoordinatorUserId] = useState('')
  const [countyId, setCountyId] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [targetMetric, setTargetMetric] = useState('')
  const [targetValue, setTargetValue] = useState('')

  const [channel, setChannel] = useState<'email' | 'sms' | 'whatsapp'>('email')
  const [communicationCounty, setCommunicationCounty] = useState('')
  const [communicationRole, setCommunicationRole] = useState('')
  const [communicationInterest, setCommunicationInterest] = useState('')
  const [messageTitle, setMessageTitle] = useState('')
  const [message, setMessage] = useState('')
  const [audienceResult, setAudienceResult] = useState<{ eligible: number; byCounty: Record<string, number>; byRole: Record<string, number> } | null>(null)
  const [communicationStatus, setCommunicationStatus] = useState<string | null>(null)

  const audience: CommunicationAudience = {
    channel,
    organizationId: null,
    countyIds: communicationCounty ? [Number(communicationCounty)] : [],
    roles: communicationRole ? [communicationRole as CommunicationAudience['roles'][number]] : [],
    interests: communicationInterest ? [communicationInterest as CommunicationAudience['interests'][number]] : [],
  }

  async function submitAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreateStatus(null)
    try {
      await createAction({
        type, title, summary, description: '', objective, status: 'open', visibility: 'members',
        organizationId: organizationId || null,
        coordinatorUserId: coordinatorUserId || null,
        countyIds: countyId ? [Number(countyId)] : [],
        startsAt: type === 'event' ? isoOrNull(startsAt) : null,
        endsAt: null,
        participationMode: type === 'event' ? 'Detalii în portal' : '',
        commitment: type === 'event' ? 'Confirmă invitația în portalul de membru.' : 'Raportează activitatea și rezultatul în portal.',
        capacity: null,
        targetMetric,
        targetValue: targetValue ? Number(targetValue) : null,
      })
      setCreateStatus('Acțiunea a fost creată și este vizibilă în spațiul autorizat.')
      setTitle(''); setSummary(''); setObjective('')
    } catch { setCreateStatus('Acțiunea nu a putut fi creată.') }
  }

  async function previewAudience() {
    setCommunicationStatus(null)
    try { setAudienceResult(await preview(audience)) } catch (cause) { setCommunicationStatus(cause instanceof Error ? cause.message : 'Segment invalid.') }
  }

  async function saveDispatch(mode: 'draft' | 'send') {
    try {
      const result = await dispatch({ ...audience, title: messageTitle, message, mode, confirmConsentSelection: mode === 'send' }) as { status?: string }
      setCommunicationStatus(mode === 'send' ? `Comunicare pregătită: ${result.status ?? 'queued'}.` : 'Draftul a fost salvat cu lista eligibilă la momentul creării.')
    } catch (cause) { setCommunicationStatus(cause instanceof Error ? cause.message : 'Comunicarea nu a putut fi salvată.') }
  }

  return (
    <div className="political-ops">
      <section className="hero political-ops__hero">
        <div className="hero-kicker">60–90 de zile · mobilizare politică</div>
        <div className="political-ops__hero-top"><div><h1>Operațiuni și mobilizare</h1><p className="lead">Evenimente, campanii, sarcini, participare și comunicare segmentată pe consimțământ.</p><p className="muted">Arie autorizată: {data?.access.scope ?? 'se încarcă'}</p></div><div className="political-ops__actions"><Link className="btn" to="/admin/dashboard">Tablou de comandă</Link><Button loading={loading} onClick={reload}>Reîncarcă</Button></div></div>
      </section>
      {error ? <div className="alert error">{error}</div> : null}

      <section className="executive-dashboard__summary" aria-label="Rezumat mobilizare">
        {[['Evenimente', data?.summary.events], ['Campanii', data?.summary.campaigns], ['Sarcini', data?.summary.tasks], ['Participanți', data?.summary.participants], ['Ore raportate', data?.summary.reportedHours]].map(([label, value]) => <article className="card executive-dashboard__summary-card" key={String(label)}><span>{label}</span><strong>{value ?? 0}</strong></article>)}
      </section>

      <section className="card political-ops__create">
        <div><span className="hero-kicker">Planificare</span><h2>Acțiune nouă</h2></div>
        <form className="political-ops__form-grid" onSubmit={(event) => void submitAction(event)}>
          <Select label="Tip" value={type} onChange={(event) => setType(event.target.value as typeof type)} options={[{ value: 'event', label: 'Eveniment / ședință' }, { value: 'campaign', label: 'Campanie' }, { value: 'volunteer_task', label: 'Sarcină voluntar' }]} />
          <Input label="Titlu" value={title} required minLength={3} onChange={(event) => setTitle(event.target.value)} />
          <Input label="Rezumat" value={summary} required minLength={10} onChange={(event) => setSummary(event.target.value)} />
          <Input label="Obiectiv" value={objective} required minLength={5} onChange={(event) => setObjective(event.target.value)} />
          <Select label="Organizație" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} placeholder="Fără organizație specifică" options={(data?.organizations ?? []).map((organization) => ({ value: organization.id, label: organization.name }))} />
          <Select label="Coordonator" value={coordinatorUserId} onChange={(event) => setCoordinatorUserId(event.target.value)} placeholder="Alege ulterior" options={(data?.candidates ?? []).filter((candidate) => candidate.userId && ['CONSILIER', 'SECRETAR', 'VICEPRESEDINTE', 'PRESEDINTE'].includes(candidate.role ?? '')).map((candidate) => ({ value: candidate.userId as string, label: candidate.fullName }))} />
          <Select label="Județ" value={countyId} onChange={(event) => setCountyId(event.target.value)} placeholder={data?.access.national ? 'Național' : 'Alege județul'} options={(data?.counties ?? []).map((county) => ({ value: String(county.id), label: county.name }))} />
          {type === 'event' ? <Input label="Data și ora" type="datetime-local" required value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /> : null}
          <Input label="Indicator țintă" value={targetMetric} onChange={(event) => setTargetMetric(event.target.value)} />
          <Input label="Valoare țintă" type="number" min="0" value={targetValue} onChange={(event) => setTargetValue(event.target.value)} />
          <Button type="submit" variant="primary" loading={saving}>Creează acțiunea</Button>
        </form>
        {createStatus ? <p role="status">{createStatus}</p> : null}
      </section>

      <section className="political-ops__list"><div><span className="hero-kicker">Execuție</span><h2>Acțiuni curente</h2></div>{data?.actions.map((action) => <ActionCard key={action.id} action={action} data={data} saving={saving} addParticipant={addParticipant} updateParticipant={updateParticipant} updateAction={updateAction} />)}</section>

      <section className="card political-ops__communication">
        <div><span className="hero-kicker">Consimțământ verificat</span><h2>Comunicare segmentată</h2><p>Previzualizarea arată numai volume agregate. Destinatarii sunt materializați numai dacă au acord activ pentru canalul ales.</p></div>
        <div className="political-ops__form-grid">
          <Select label="Canal" value={channel} onChange={(event) => { setChannel(event.target.value as typeof channel); setAudienceResult(null) }} options={[{ value: 'email', label: 'Email' }, { value: 'sms', label: 'SMS' }, { value: 'whatsapp', label: 'WhatsApp' }]} />
          <Select label="Județ" value={communicationCounty} onChange={(event) => setCommunicationCounty(event.target.value)} placeholder="Toate din aria mea" options={(data?.counties ?? []).map((county) => ({ value: String(county.id), label: county.name }))} />
          <Select label="Rol" value={communicationRole} onChange={(event) => setCommunicationRole(event.target.value)} placeholder="Toate rolurile" options={['SUSTINATOR', 'ADERENT', 'MEMBRU', 'CONSILIER', 'SECRETAR', 'VICEPRESEDINTE', 'PRESEDINTE'].map((role) => ({ value: role, label: role }))} />
          <Select label="Interes" value={communicationInterest} onChange={(event) => setCommunicationInterest(event.target.value)} placeholder="Toate interesele" options={mobilizationInterests} />
          <Button type="button" onClick={() => void previewAudience()}>Calculează audiența</Button>
        </div>
        {audienceResult ? <div className="political-ops__audience"><strong>{audienceResult.eligible} destinatari eligibili</strong><span>Pe județe: {Object.entries(audienceResult.byCounty).map(([key, value]) => `${key}: ${value}`).join(', ') || '—'}</span><span>Pe roluri: {Object.entries(audienceResult.byRole).map(([key, value]) => `${key}: ${value}`).join(', ') || '—'}</span></div> : null}
        <div className="political-ops__message"><Input label="Subiect" value={messageTitle} onChange={(event) => setMessageTitle(event.target.value)} /><label className="field"><span>Mesaj</span><textarea rows={5} value={message} onChange={(event) => setMessage(event.target.value)} /></label><div className="political-ops__row-actions"><Button disabled={!audienceResult || messageTitle.length < 3 || message.length < 10} onClick={() => void saveDispatch('draft')}>Salvează draft</Button>{user?.role === 'PRESEDINTE' ? <Button variant="primary" disabled={!audienceResult || messageTitle.length < 3 || message.length < 10} onClick={() => void saveDispatch('send')}>{channel === 'email' ? 'Pune emailurile în coadă' : 'Pregătește pentru furnizor'}</Button> : null}</div></div>
        {communicationStatus ? <p role="status">{communicationStatus}</p> : null}
      </section>
    </div>
  )
}
