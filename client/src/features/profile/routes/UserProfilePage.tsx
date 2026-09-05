import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input } from '@components'
import { useAuth } from '@features/auth/context'
import { hasAdminAccess, type Role } from '@features/auth/types'
import { mobilizationInterests } from '@features/mobilization/config'
import { useMemberPortal } from '@features/memberPortal/hooks/useMemberPortal'
import type { MemberConsentInput, MemberPortalAction } from '@features/memberPortal/types'

function formatRoleLabel(role: Role): string {
  if (role === 'SUSTINATOR') return 'Susținător'
  if (role === 'VICEPRESEDINTE') return 'Vicepreședinte'
  return role.charAt(0) + role.slice(1).toLowerCase()
}

const membershipLabels: Record<string, string> = {
  supporter: 'Susținător',
  application: 'Cerere depusă',
  verified: 'Verificat',
  approved: 'Aprobat',
  active: 'Membru activ',
  suspended: 'Suspendat',
  terminated: 'Încetat',
}

function formatDate(value: string | null): string {
  if (!value) return 'Nespecificat'
  return new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium' }).format(new Date(value))
}

function TaskReportCard({ action, saving, onReport }: {
  action: MemberPortalAction
  saving: boolean
  onReport: (participantId: string, input: { status: 'in_progress' | 'reported'; report: string; result: string; hours: number }) => Promise<void>
}) {
  const [report, setReport] = useState(action.report)
  const [result, setResult] = useState(action.result)
  const [hours, setHours] = useState(String(action.hours))

  async function save(status: 'in_progress' | 'reported') {
    if (report.trim().length < 5) return
    try {
      await onReport(action.participantId, { status, report, result, hours: Number(hours) || 0 })
    } catch {
      // Eroarea comună este afișată de portal.
    }
  }

  return (
    <article className="card member-portal__action">
      <div className="member-portal__action-top">
        <div>
          <span className="hero-kicker">{action.type === 'campaign' ? 'Campanie' : 'Sarcină'}</span>
          <h3>{action.title}</h3>
        </div>
        <span className="status-pill">{action.status}</span>
      </div>
      <p>{action.summary}</p>
      <p className="muted">Obiectiv: {action.objective || 'stabilit de coordonator'} · Termen: {formatDate(action.dueAt)}</p>
      <form className="member-portal__report" onSubmit={(event) => { event.preventDefault(); void save('reported') }}>
        <label className="field">
          <span>Activitate realizată</span>
          <textarea rows={3} minLength={5} required value={report} onChange={(event) => setReport(event.target.value)} />
        </label>
        <Input label="Rezultat" value={result} onChange={(event) => setResult(event.target.value)} />
        <Input label="Ore" type="number" min="0" step="0.25" value={hours} onChange={(event) => setHours(event.target.value)} />
        <div className="member-portal__row-actions">
          <Button type="button" disabled={saving || report.trim().length < 5} onClick={() => void save('in_progress')}>Salvează progresul</Button>
          <Button type="submit" variant="primary" loading={saving}>Trimite raportul</Button>
        </div>
      </form>
    </article>
  )
}

function ConsentPreferences({ initial, saving, onSave }: {
  initial: MemberConsentInput
  saving: boolean
  onSave: (input: MemberConsentInput) => Promise<void>
}) {
  const [status, setStatus] = useState<string | null>(null)
  const [consent, setConsent] = useState(initial)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus(null)
    try {
      await onSave({ ...consent, consentVersion: 'portal-membru-v1' })
      setStatus('Preferințele și consimțământul au fost salvate.')
    } catch {
      setStatus('Preferințele nu au putut fi salvate.')
    }
  }

  return (
    <form className="member-portal__consent" onSubmit={(event) => void submit(event)}>
      <label className="field checkbox"><input type="checkbox" checked={consent.emailConsent} onChange={(event) => setConsent((current) => ({ ...current, emailConsent: event.target.checked }))} /><span>Email</span></label>
      <label className="field checkbox"><input type="checkbox" checked={consent.smsConsent} onChange={(event) => setConsent((current) => ({ ...current, smsConsent: event.target.checked }))} /><span>SMS</span></label>
      <label className="field checkbox"><input type="checkbox" checked={consent.whatsappConsent} onChange={(event) => setConsent((current) => ({ ...current, whatsappConsent: event.target.checked }))} /><span>WhatsApp</span></label>
      <Input label="Telefon pentru SMS/WhatsApp" value={consent.phone} onChange={(event) => setConsent((current) => ({ ...current, phone: event.target.value }))} />
      <fieldset className="member-portal__interests"><legend>Interese</legend>{mobilizationInterests.map((interest) => <label key={interest.value}><input type="checkbox" checked={consent.interests.includes(interest.value)} onChange={() => setConsent((current) => ({ ...current, interests: current.interests.includes(interest.value) ? current.interests.filter((item) => item !== interest.value) : [...current.interests, interest.value] }))} /> {interest.label}</label>)}</fieldset>
      <Button type="submit" variant="primary" loading={saving}>Salvează preferințele</Button>
      {status ? <p role="status">{status}</p> : null}
    </form>
  )
}

export function UserProfilePage() {
  const { user } = useAuth()
  const { portal, loading, saving, error, respondEvent, reportTask, saveConsent } = useMemberPortal()

  if (!user) return null

  const displayName = user.fullName.trim() || user.email
  const adminAccess = hasAdminAccess(user.role)

  return (
    <div className="profile-page member-portal">
      <section className="hero profile-page__hero">
        <div className="hero-kicker">Portalul membrului</div>
        <div className="profile-page__hero-top">
          <div className="stack-12">
            <h1 className="profile-page__title">Bun venit, {displayName}</h1>
            <p className="lead">Filiala, activitățile, documentele și situația cotizației tale, într-un singur loc.</p>
          </div>
          <div className="profile-page__actions">
            <Link className="btn primary" to="/mobilizare">Centrul de mobilizare</Link>
            {adminAccess ? <Link className="btn" to="/admin">Zona administrativă</Link> : <Link className="btn" to="/">Înapoi la început</Link>}
          </div>
        </div>
      </section>

      {error ? <div className="alert error">{error}</div> : null}
      {loading ? <div className="card">Se încarcă situația ta…</div> : null}

      <section className="profile-page__grid">
        <article className="card profile-page__card">
          <div className="hero-kicker profile-page__card-kicker">Datele tale</div>
          <dl className="profile-page__details">
            <div className="profile-page__detail"><dt>Nume complet</dt><dd>{displayName}</dd></div>
            <div className="profile-page__detail"><dt>Email</dt><dd>{user.email}</dd></div>
            <div className="profile-page__detail"><dt>Rol în platformă</dt><dd>{formatRoleLabel(user.role)}</dd></div>
            <div className="profile-page__detail"><dt>ID utilizator</dt><dd>{user.id}</dd></div>
          </dl>
        </article>

        <article className="card profile-page__card">
          <div className="hero-kicker profile-page__card-kicker">Situația în partid</div>
          {portal?.membership ? (
            <dl className="profile-page__details">
              <div className="profile-page__detail"><dt>Statut</dt><dd>{membershipLabels[portal.membership.status] ?? portal.membership.status}</dd></div>
              <div className="profile-page__detail"><dt>Număr membru</dt><dd>{portal.membership.memberNumber ?? 'Se atribuie la activare'}</dd></div>
              <div className="profile-page__detail"><dt>Data cererii</dt><dd>{formatDate(portal.membership.applicationAt)}</dd></div>
              <div className="profile-page__detail"><dt>Cotizație de achitat</dt><dd>{portal.dues.dueAmount.toLocaleString('ro-RO')} {portal.dues.currency}</dd></div>
            </dl>
          ) : <p>Contul nu are încă o cerere de aderare asociată. <Link className="text-link" to="/contact">Depune cererea</Link>.</p>}
        </article>
      </section>

      {portal?.organization ? (
        <section className="card member-portal__section">
          <div><span className="hero-kicker">Filiala proprie</span><h2>{portal.organization.name}</h2></div>
          <div className="member-portal__branch-grid">
            <p><strong>Sediu</strong><br />{portal.organization.headquarters || 'În curs de publicare'}</p>
            <p><strong>Contact</strong><br />{portal.organization.officialEmail || 'În curs de publicare'}<br />{portal.organization.phone}</p>
            <p><strong>Responsabili</strong><br />{portal.organization.leaders.map((leader) => `${leader.fullName} — ${leader.position}`).join(', ') || 'În curs de desemnare'}</p>
          </div>
        </section>
      ) : null}

      {portal?.events.length ? (
        <section className="member-portal__section">
          <div><span className="hero-kicker">Invitații și prezență</span><h2>Evenimentele tale</h2></div>
          <div className="member-portal__cards">
            {portal.events.map((event) => (
              <article className="card member-portal__action" key={event.participantId}>
                <h3>{event.title}</h3><p>{event.summary}</p>
                <p className="muted">{formatDate(event.startsAt)} · {event.participationMode}</p>
                <p>Răspuns: <strong>{event.status === 'waitlisted' ? 'Pe lista de așteptare' : event.status}</strong> · Prezență: <strong>{event.attendanceStatus}</strong></p>
                <div className="member-portal__row-actions">
                  <Button disabled={saving} variant="primary" onClick={() => { void respondEvent(event.actionId, 'confirmed').catch(() => undefined) }}>Confirm participarea</Button>
                  <Button disabled={saving} onClick={() => { void respondEvent(event.actionId, 'declined').catch(() => undefined) }}>Nu pot participa</Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {portal && [...portal.tasks, ...portal.campaigns].length > 0 ? (
        <section className="member-portal__section">
          <div><span className="hero-kicker">Activitate politică</span><h2>Sarcini și campanii</h2></div>
          <div className="member-portal__cards">
            {[...portal.tasks, ...portal.campaigns].map((action) => <TaskReportCard key={action.participantId} action={action} saving={saving} onReport={reportTask} />)}
          </div>
        </section>
      ) : null}

      {portal ? (
        <section className="profile-page__grid">
          <article className="card profile-page__card">
            <div className="hero-kicker">Documente</div><h2>Biblioteca membrului</h2>
            <div className="stack-12">{portal.documents.map((document) => <Link className="text-link" key={document.id} to={document.path}>{document.title} — {document.description}</Link>)}</div>
          </article>
          <article className="card profile-page__card">
            <div className="hero-kicker">Guvernanță</div><h2>Module reglementate</h2>
            {portal.regulatedModules.map((module) => (
              <p key={module.key}><strong>{module.key === 'electoral' ? 'Modul electoral' : 'Transparență financiară'}:</strong>{' '}
                {module.enabled ? 'activ' : `în așteptare (juridic: ${module.legalStatus}, DPO: ${module.dpoStatus})`}
              </p>
            ))}
          </article>
        </section>
      ) : null}

      {portal ? (
        <section className="card member-portal__section">
          <div><span className="hero-kicker">Comunicare segmentată</span><h2>Acordurile tale</h2><p>Alegi separat fiecare canal și interesele relevante. Le poți retrage oricând.</p></div>
          <ConsentPreferences initial={{ ...portal.communication, consentVersion: 'portal-membru-v1' }} saving={saving} onSave={saveConsent} />
        </section>
      ) : null}

      {adminAccess ? (
        <section className="card member-portal__section"><div className="hero-kicker">Acces administrativ</div><Link className="text-link" to="/admin">Deschide administrarea →</Link></section>
      ) : null}
    </div>
  )
}
