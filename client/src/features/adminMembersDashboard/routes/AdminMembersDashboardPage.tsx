import { useDeferredValue, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input, Select } from '@components'
import { useAuth } from '@features/auth/context'
import { useAdminMembersDashboard, useMembershipAction } from '../hooks/useAdminMembersDashboard'
import type {
  AdminMembershipRow,
  MembershipAction,
  MembershipOrganization,
  MembershipStatus,
} from '../types'

const pageSize = 25

const statusLabels: Record<MembershipStatus, string> = {
  supporter: 'Susținător',
  application: 'Cerere depusă',
  verified: 'Verificat',
  approved: 'Aprobat',
  active: 'Membru activ',
  suspended: 'Suspendat',
  terminated: 'Calitate încetată',
}

const actionLabels: Record<MembershipAction, string> = {
  verify: 'Marchează verificat',
  approve: 'Aprobă aderarea',
  activate: 'Activează membrul',
  suspend: 'Suspendă',
  reactivate: 'Reactivează',
  transfer: 'Transferă',
  terminate: 'Încetează calitatea',
}

const historyActionLabels: Record<string, string> = {
  ...actionLabels,
  import: 'Import inițial',
  submit: 'Cerere depusă',
}

const summaryCards = [
  { key: 'applications', label: 'Cereri', helper: 'Solicitări depuse, încă neverificate.' },
  { key: 'verified', label: 'Verificate', helper: 'Dosare verificate, în așteptarea aprobării.' },
  { key: 'approved', label: 'Aprobate', helper: 'Aprobate de un organ PCS, încă neactivate.' },
  { key: 'active', label: 'Membri activi', helper: 'Include titularii de funcții.' },
  { key: 'suspended', label: 'Suspendați', helper: 'Calitate oprită temporar.' },
  { key: 'unassigned', label: 'Fără organizație', helper: 'Necesită repartizare teritorială.' },
  { key: 'total', label: 'Total evidențe', helper: 'Inclusiv calități încetate.' },
] as const

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium' }).format(new Date(value))
}

function formatRole(role: AdminMembershipRow['role']): string {
  if (role === 'VICEPRESEDINTE') return 'Vicepreședinte'
  return role.charAt(0) + role.slice(1).toLowerCase()
}

function statusOptions(): Array<{ value: string; label: string }> {
  return [
    { value: '', label: 'Toate stările' },
    ...Object.entries(statusLabels).map(([value, label]) => ({ value, label })),
  ]
}

function organizationOptions(organizations: MembershipOrganization[]): Array<{ value: string; label: string }> {
  return [
    { value: '', label: 'Toate organizațiile' },
    { value: 'unassigned', label: 'Fără organizație' },
    ...organizations.map((organization) => ({
      value: organization.id,
      label: `${organization.code} — ${organization.name}`,
    })),
  ]
}

function MembershipActionForm({
  member,
  action,
  organizations,
  saving,
  error,
  onCancel,
  onSubmit,
}: {
  member: AdminMembershipRow
  action: MembershipAction
  organizations: MembershipOrganization[]
  saving: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (input: { organizationId?: string; approvalOrganizationId?: string; reason?: string; effectiveAt?: string }) => Promise<void>
}) {
  const [organizationId, setOrganizationId] = useState('')
  const [approvalOrganizationId, setApprovalOrganizationId] = useState('')
  const [reason, setReason] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10))
  const requiresReason = action === 'suspend' || action === 'terminate'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const today = new Date().toISOString().slice(0, 10)
    await onSubmit({
      organizationId: action === 'transfer' ? organizationId : undefined,
      approvalOrganizationId: action === 'approve' ? approvalOrganizationId : undefined,
      reason: reason.trim() || undefined,
      effectiveAt: effectiveDate
        ? effectiveDate === today ? new Date().toISOString() : `${effectiveDate}T12:00:00.000Z`
        : undefined,
    })
  }

  return (
    <form className="admin-members__decision" onSubmit={(event) => void handleSubmit(event)}>
      <div>
        <strong>{actionLabels[action]}</strong>
        <p className="muted">Decizia va fi salvată în istoricul lui {member.fullName}.</p>
      </div>
      {action === 'transfer' ? (
        <Select
          label="Organizația destinație"
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
          options={[
            { value: '', label: organizations.length > 0 ? 'Selectează organizația' : 'Nu există organizații disponibile' },
            ...organizations.map((organization) => ({
              value: organization.id,
              label: `${organization.code} — ${organization.name}`,
            })),
          ]}
          required
          disabled={organizations.length === 0}
        />
      ) : null}
      {action === 'approve' ? (
        <Select
          label="Organul care aprobă"
          value={approvalOrganizationId}
          onChange={(event) => setApprovalOrganizationId(event.target.value)}
          options={[
            { value: '', label: organizations.length > 0 ? 'Selectează organul aprobator' : 'Nu există organizații disponibile' },
            ...organizations.map((organization) => ({
              value: organization.id,
              label: `${organization.code} — ${organization.name}`,
            })),
          ]}
          required
          disabled={organizations.length === 0}
        />
      ) : null}
      <Input
        label="Data efectivă"
        type="date"
        value={effectiveDate}
        max={new Date().toISOString().slice(0, 10)}
        onChange={(event) => setEffectiveDate(event.target.value)}
        required
      />
      {(requiresReason || action === 'transfer') ? (
        <label className="field">
          <span className="label">Motiv{requiresReason ? ' obligatoriu' : ' / observații'}</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={requiresReason ? 5 : undefined}
            maxLength={1200}
            rows={3}
            required={requiresReason}
          />
        </label>
      ) : null}
      {error ? <div className="alert error">{error}</div> : null}
      <div className="admin-members__decision-actions">
        <Button type="button" onClick={onCancel} disabled={saving}>Renunță</Button>
        <Button
          type="submit"
          variant="primary"
          loading={saving}
          disabled={(action === 'transfer' || action === 'approve') && organizations.length === 0}
        >
          Confirmă decizia
        </Button>
      </div>
    </form>
  )
}

function MembershipRow({
  member,
  organizations,
  activeAction,
  saving,
  mutationError,
  onSelectAction,
  onCancel,
  onExecute,
}: {
  member: AdminMembershipRow
  organizations: MembershipOrganization[]
  activeAction: MembershipAction | null
  saving: boolean
  mutationError: string | null
  onSelectAction: (action: MembershipAction) => void
  onCancel: () => void
  onExecute: (input: { organizationId?: string; approvalOrganizationId?: string; reason?: string; effectiveAt?: string }) => Promise<void>
}) {
  return (
    <article className={`admin-members__record is-${member.membershipStatus}`}>
      <div className="admin-members__record-main">
        <div className="admin-members__identity">
          <h2>{member.fullName}</h2>
          <a className="text-link" href={`mailto:${member.email}`}>{member.email}</a>
          <p className="muted">
            {[member.county, member.locality].filter(Boolean).join(' · ') || 'Localitate necompletată'}
          </p>
        </div>
        <div className="admin-members__badges">
          <span className={`admin-members__status is-${member.membershipStatus}`}>
            {statusLabels[member.membershipStatus]}
          </span>
          <span className="admin-members__role">{formatRole(member.role)}</span>
        </div>
      </div>

      <dl className="admin-members__facts">
        <div><dt>Număr membru</dt><dd>{member.memberNumber ?? 'Se alocă la activare'}</dd></div>
        <div><dt>Data cererii</dt><dd>{formatDate(member.applicationAt)}</dd></div>
        <div><dt>Organizație</dt><dd>{member.organization?.name ?? 'Nerepartizat'}</dd></div>
        <div><dt>Verificat</dt><dd>{formatDate(member.verifiedAt)}</dd></div>
        <div><dt>Aprobat</dt><dd>{formatDate(member.approvedAt)}</dd></div>
        <div><dt>Organ aprobator</dt><dd>{member.approvalOrganization?.name || member.approvalBody || '—'}</dd></div>
        <div><dt>Membru activ din</dt><dd>{formatDate(member.activatedAt)}</dd></div>
        <div><dt>Actualizat</dt><dd>{formatDate(member.updatedAt)}</dd></div>
      </dl>

      {member.statusReason ? <p className="admin-members__reason"><strong>Motiv:</strong> {member.statusReason}</p> : null}

      <div className="admin-members__record-actions" aria-label={`Operații pentru ${member.fullName}`}>
        {member.availableActions.map((action) => (
          <Button
            key={action}
            type="button"
            variant={action === 'verify' || action === 'approve' || action === 'activate' || action === 'reactivate' ? 'primary' : 'default'}
            onClick={() => onSelectAction(action)}
            disabled={saving}
          >
            {actionLabels[action]}
          </Button>
        ))}
        {member.availableActions.length === 0 ? <span className="muted">Fără operații disponibile pentru rolul tău.</span> : null}
      </div>

      {activeAction ? (
        <MembershipActionForm
          key={`${member.id}-${activeAction}`}
          member={member}
          action={activeAction}
          organizations={activeAction === 'transfer'
            ? organizations.filter((organization) => organization.id !== member.organization?.id)
            : organizations}
          saving={saving}
          error={mutationError}
          onCancel={onCancel}
          onSubmit={onExecute}
        />
      ) : null}

      {member.history.length > 0 ? (
        <details className="admin-members__history">
          <summary>Istoric recent ({member.history.length})</summary>
          <ol>
            {member.history.map((event) => (
              <li key={event.id}>
                <strong>{historyActionLabels[event.action] ?? event.action}</strong>
                {' · '}{formatDate(event.effectiveAt)}
                {event.actorName ? ` · ${event.actorName}` : ''}
                {event.reason ? <p>{event.reason}</p> : null}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </article>
  )
}

export function AdminMembersDashboardPage() {
  const { user } = useAuth()
  const [searchInput, setSearchInput] = useState('')
  const [status, setStatus] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [offset, setOffset] = useState(0)
  const [decision, setDecision] = useState<{ memberId: string; action: MembershipAction } | null>(null)
  const [successMessage, setSuccessMessage] = useState('')
  const deferredSearch = useDeferredValue(searchInput)
  const { dashboard, loading, error, reload } = useAdminMembersDashboard({
    search: deferredSearch,
    status: status ? status as MembershipStatus : undefined,
    organizationId: organizationId || undefined,
    limit: pageSize,
    offset,
  })
  const membershipMutation = useMembershipAction()
  const paginationTotal = dashboard?.pagination.total ?? 0
  const paginationStart = paginationTotal === 0 ? 0 : offset + 1
  const paginationEnd = Math.min(offset + pageSize, paginationTotal)

  async function executeDecision(
    member: AdminMembershipRow,
    input: { organizationId?: string; approvalOrganizationId?: string; reason?: string; effectiveAt?: string },
  ) {
    if (!decision) return
    membershipMutation.reset()
    setSuccessMessage('')
    try {
      const result = await membershipMutation.execute({
        membershipId: member.id,
        payload: {
          action: decision.action,
          expectedVersion: member.version,
          ...input,
        },
      })
      setSuccessMessage(result.message)
      setDecision(null)
    } catch {
      // Eroarea mutației este afișată în formularul deciziei.
    }
  }

  return (
    <div className="admin-members">
      <section className="hero admin-members__hero">
        <div className="hero-kicker">Registru operațional</div>
        <div className="admin-members__hero-top">
          <div className="stack-12">
            <h1 className="admin-members__title">Management membri</h1>
            <p className="lead">
              Urmărește separat cererea, verificarea, aprobarea și activarea; fiecare decizie rămâne în istoric.
            </p>
            <p className="muted">Conectat ca {user?.fullName ?? 'administrator'} · {user ? formatRole(user.role) : '—'}</p>
          </div>
          <div className="admin-members__actions">
            {user?.role === 'VICEPRESEDINTE' || user?.role === 'PRESEDINTE'
              ? <Link className="btn" to="/admin/dashboard">Tablou de comandă</Link>
              : <Link className="btn" to="/admin/volunteers">CRM teritorial</Link>}
            <Link className="btn" to="/admin/organizations">Organizații teritoriale</Link>
            <Button onClick={reload} loading={loading}>Reîncarcă</Button>
          </div>
        </div>

        <div className="admin-members__filters">
          <Input
            label="Caută nume, email, județ sau organizație"
            value={searchInput}
            onChange={(event) => { setSearchInput(event.target.value); setOffset(0) }}
            placeholder="Ex: Ana, Cluj sau PCS-CJ"
          />
          <Select
            label="Starea calității"
            value={status}
            onChange={(event) => { setStatus(event.target.value); setOffset(0) }}
            options={statusOptions()}
          />
          <Select
            label="Organizația"
            value={organizationId}
            onChange={(event) => { setOrganizationId(event.target.value); setOffset(0) }}
            options={organizationOptions(dashboard?.organizations ?? [])}
          />
        </div>
      </section>

      {error ? <div className="alert error">{error}</div> : null}
      {dashboard?.access ? <div className="alert success">Arie autorizată: {dashboard.access.scope}</div> : null}
      {successMessage ? <div className="alert success">{successMessage}</div> : null}

      <section className="admin-members__stats">
        {summaryCards.map((card) => (
          <article key={card.key} className="card admin-members__stat">
            <div className="hero-kicker admin-members__stat-kicker">{card.label}</div>
            <strong className="admin-members__stat-value">{dashboard?.summary[card.key] ?? (loading ? '…' : 0)}</strong>
            <p>{card.helper}</p>
          </article>
        ))}
      </section>

      <section className="panel admin-members__registry">
        <header className="panel__header admin-members__registry-header">
          <div>
            <div className="panel__title">Evidența nominală</div>
            <p className="muted">
              {dashboard
                ? `${dashboard.pagination.total} rezultate · pagina ${Math.floor(offset / pageSize) + 1}`
                : 'Se încarcă evidența…'}
            </p>
          </div>
          <span className="admin-members__count">{dashboard?.pagination.total ?? 0}</span>
        </header>
        <div className="panel__body admin-members__registry-body">
          {dashboard?.rows.length === 0 && !loading ? (
            <div className="admin-members__empty">Nu există evidențe pentru filtrele selectate.</div>
          ) : (
            dashboard?.rows.map((member) => (
              <MembershipRow
                key={member.id}
                member={member}
                organizations={dashboard.organizations}
                activeAction={decision?.memberId === member.id ? decision.action : null}
                saving={membershipMutation.saving}
                mutationError={decision?.memberId === member.id ? membershipMutation.error : null}
                onSelectAction={(action) => { membershipMutation.reset(); setDecision({ memberId: member.id, action }) }}
                onCancel={() => { membershipMutation.reset(); setDecision(null) }}
                onExecute={(input) => executeDecision(member, input)}
              />
            ))
          )}
        </div>
        <footer className="admin-members__pagination">
          <Button
            type="button"
            disabled={!dashboard?.pagination.hasPrevious || loading}
            onClick={() => { setDecision(null); setOffset(Math.max(0, offset - pageSize)) }}
          >
            Pagina anterioară
          </Button>
          <span>{paginationStart}–{paginationEnd} din {paginationTotal}</span>
          <Button
            type="button"
            disabled={!dashboard?.pagination.hasNext || loading}
            onClick={() => { setDecision(null); setOffset(offset + pageSize) }}
          >
            Pagina următoare
          </Button>
        </footer>
      </section>
    </div>
  )
}
