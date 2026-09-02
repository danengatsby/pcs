import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input, Select } from '@components'
import { useAuth } from '@features/auth/context'
import {
  useOrganizationDetail,
  useOrganizationMutations,
  useOrganizationRegistry,
} from '../hooks/useTerritorialOrganizations'
import type {
  MandateStatus,
  ObjectiveStatus,
  OrganizationDetail,
  OrganizationLevel,
  OrganizationListRow,
  OrganizationObjective,
  OrganizationRegistry,
  OrganizationStatus,
  OrganizationTerritoryInput,
  OrganizationWriteInput,
} from '../types'

const levelLabels: Record<OrganizationLevel, string> = {
  national: 'Națională',
  county: 'Județeană',
  local: 'Locală',
}

const statusLabels: Record<OrganizationStatus, string> = {
  forming: 'În constituire',
  active: 'Activă',
  inactive: 'Inactivă',
  dissolved: 'Dizolvată',
}

const mandateStatusLabels: Record<MandateStatus, string> = {
  planned: 'Planificat',
  active: 'În exercițiu',
  completed: 'Încheiat',
  suspended: 'Suspendat',
}

const objectiveStatusLabels: Record<ObjectiveStatus, string> = {
  planned: 'Planificat',
  in_progress: 'În lucru',
  achieved: 'Atins',
  at_risk: 'În risc',
  cancelled: 'Anulat',
}

const today = new Date().toISOString().slice(0, 10)

function formatDate(value: string | null): string {
  if (!value) return 'Nedocumentată'
  return new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium', timeZone: 'UTC' })
    .format(new Date(`${value}T00:00:00.000Z`))
}

type TerritoryDraft = { countyId: string; locality: string }

function emptyTerritories(): TerritoryDraft[] {
  return [{ countyId: '', locality: '' }]
}

function OrganizationEditor({
  registry,
  initial,
  saving,
  error,
  onCancel,
  onSave,
  contactOnly = false,
}: {
  registry: OrganizationRegistry
  initial?: OrganizationDetail
  saving: boolean
  error: string | null
  onCancel: () => void
  onSave: (input: Partial<OrganizationWriteInput>) => Promise<void>
  contactOnly?: boolean
}) {
  const [code, setCode] = useState(initial?.code ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [level, setLevel] = useState<OrganizationLevel>(initial?.level ?? 'national')
  const [status, setStatus] = useState<OrganizationStatus>(initial?.status ?? 'forming')
  const [parentId, setParentId] = useState(initial?.parent?.id ?? '')
  const [membersCount, setMembersCount] = useState(String(initial?.membersCount ?? 0))
  const [officialEmail, setOfficialEmail] = useState(initial?.officialEmail ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [headquarters, setHeadquarters] = useState(initial?.headquarters ?? '')
  const [foundedAt, setFoundedAt] = useState(initial?.foundedAt ?? '')
  const [territories, setTerritories] = useState<TerritoryDraft[]>(
    initial?.territories.length
      ? initial.territories.map((territory) => ({
        countyId: territory.countyId ? String(territory.countyId) : '',
        locality: territory.locality,
      }))
      : emptyTerritories(),
  )

  const parentLevel: OrganizationLevel | null = level === 'county' ? 'national' : level === 'local' ? 'county' : null
  const parentOptions = registry.rows
    .filter((organization) => organization.level === parentLevel && organization.id !== initial?.id && organization.status !== 'dissolved')
    .map((organization) => ({ value: organization.id, label: `${organization.code} — ${organization.name}` }))
  const countyOptions = registry.counties.map((county) => ({ value: String(county.id), label: county.name }))

  function changeLevel(nextLevel: OrganizationLevel) {
    setLevel(nextLevel)
    setParentId('')
    setTerritories(emptyTerritories())
  }

  function updateTerritory(index: number, patch: Partial<TerritoryDraft>) {
    setTerritories((current) => current.map((territory, territoryIndex) => (
      territoryIndex === index ? { ...territory, ...patch } : territory
    )))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (contactOnly) {
      try {
        await onSave({ name, officialEmail, phone, headquarters, foundedAt: foundedAt || null })
      } catch {
        // Mutation state is rendered below the form.
      }
      return
    }
    const territoryType = level === 'national' ? 'national' : level === 'county' ? 'county' : 'locality'
    const payloadTerritories: OrganizationTerritoryInput[] = level === 'national'
      ? [{ type: 'national' }]
      : territories.map((territory) => ({
        type: territoryType,
        countyId: Number(territory.countyId),
        ...(level === 'local' ? { locality: territory.locality } : {}),
      }))

    try {
      await onSave({
        code,
        name,
        level,
        status,
        parentId: level === 'national' ? null : parentId,
        membersCount: Number(membersCount),
        officialEmail,
        phone,
        headquarters,
        foundedAt: foundedAt || null,
        territories: payloadTerritories,
      })
    } catch {
      // Mutation state is rendered below the form.
    }
  }

  return (
    <form className="panel territorial-org__editor" onSubmit={(event) => void submit(event)}>
      <header className="panel__header">
        <div>
          <div className="panel__title">{initial ? 'Editează organizația' : 'Înregistrează o organizație reală'}</div>
          <p className="muted">Folosește datele din hotărârea de constituire, nu valori demonstrative.</p>
        </div>
      </header>
      <div className="panel__body territorial-org__form-grid">
        {!contactOnly ? <Input label="Cod unic" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Ex: PCS-CJ" required /> : null}
        <Input label="Denumire oficială" value={name} onChange={(event) => setName(event.target.value)} required />
        {!contactOnly ? <Select
          label="Nivel"
          value={level}
          onChange={(event) => changeLevel(event.target.value as OrganizationLevel)}
          options={Object.entries(levelLabels).map(([value, label]) => ({ value, label }))}
        /> : null}
        {!contactOnly ? <Select
          label="Stare juridică/operațională"
          value={status}
          onChange={(event) => setStatus(event.target.value as OrganizationStatus)}
          options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))}
        /> : null}
        {!contactOnly && parentLevel ? (
          <Select
            label="Organizație părinte"
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
            placeholder="Selectează organizația părinte"
            options={parentOptions}
            required
          />
        ) : null}
        {!contactOnly ? <Input label="Număr membri" type="number" min="0" value={membersCount} onChange={(event) => setMembersCount(event.target.value)} required /> : null}
        <Input label="Data constituirii" type="date" value={foundedAt} onChange={(event) => setFoundedAt(event.target.value)} />
        <Input label="Email oficial" type="email" value={officialEmail} onChange={(event) => setOfficialEmail(event.target.value)} />
        <Input label="Telefon" value={phone} onChange={(event) => setPhone(event.target.value)} />
        <Input label="Sediu" value={headquarters} onChange={(event) => setHeadquarters(event.target.value)} />
      </div>

      {!contactOnly ? <div className="panel__body territorial-org__territory-editor">
        <div className="territorial-org__subheading">
          <div>
            <strong>Teritoriu statutar</strong>
            <p className="muted">Poți atribui mai multe județe sau localități aceleiași structuri.</p>
          </div>
          {level !== 'national' ? (
            <Button type="button" onClick={() => setTerritories((current) => [...current, { countyId: '', locality: '' }])}>
              Adaugă teritoriu
            </Button>
          ) : null}
        </div>
        {level === 'national' ? <div className="territorial-org__territory-fixed">România — acoperire națională</div> : null}
        {level !== 'national' ? territories.map((territory, index) => (
          <div className="territorial-org__territory-row" key={`${index}-${territory.countyId}`}>
            <Select
              label="Județ"
              value={territory.countyId}
              onChange={(event) => updateTerritory(index, { countyId: event.target.value })}
              placeholder="Selectează județul"
              options={countyOptions}
              required
            />
            {level === 'local' ? (
              <Input label="Localitate / sector" value={territory.locality} onChange={(event) => updateTerritory(index, { locality: event.target.value })} required />
            ) : null}
            {territories.length > 1 ? (
              <Button type="button" onClick={() => setTerritories((current) => current.filter((_, territoryIndex) => territoryIndex !== index))}>
                Elimină
              </Button>
            ) : null}
          </div>
        )) : null}
      </div> : null}
      {error ? <div className="alert error">{error}</div> : null}
      <footer className="panel__footer territorial-org__form-actions">
        <Button type="submit" variant="primary" loading={saving}>{initial ? 'Salvează modificările' : 'Creează organizația'}</Button>
        <Button type="button" onClick={onCancel}>Anulează</Button>
      </footer>
    </form>
  )
}

function MandateForm({ saving, onSave }: { saving: boolean; onSave: (input: {
  fullName: string
  positionTitle: string
  startedAt: string
  endedAt?: string | null
  status: MandateStatus
}) => Promise<void> }) {
  const [fullName, setFullName] = useState('')
  const [positionTitle, setPositionTitle] = useState('')
  const [startedAt, setStartedAt] = useState(today)
  const [endedAt, setEndedAt] = useState('')
  const [status, setStatus] = useState<MandateStatus>('active')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      await onSave({ fullName, positionTitle, startedAt, endedAt: endedAt || null, status })
      setFullName('')
      setPositionTitle('')
      setEndedAt('')
    } catch {
      // Mutation state is rendered by the parent.
    }
  }

  return (
    <form className="territorial-org__inline-form" onSubmit={(event) => void submit(event)}>
      <Input label="Nume complet" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
      <Input label="Funcție" value={positionTitle} onChange={(event) => setPositionTitle(event.target.value)} placeholder="Ex: Președinte filială" required />
      <Input label="Început mandat" type="date" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} required />
      <Input label="Sfârșit mandat" type="date" value={endedAt} onChange={(event) => setEndedAt(event.target.value)} />
      <Select label="Stare" value={status} onChange={(event) => setStatus(event.target.value as MandateStatus)} options={Object.entries(mandateStatusLabels).map(([value, label]) => ({ value, label }))} />
      <Button type="submit" variant="primary" loading={saving}>Adaugă mandat</Button>
    </form>
  )
}

function ObjectiveForm({ saving, onSave }: { saving: boolean; onSave: (input: {
  title: string
  description: string
  metricName: string
  targetValue: number
  currentValue: number
  unit: string
  dueDate: string
  status: ObjectiveStatus
}) => Promise<void> }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [metricName, setMetricName] = useState('')
  const [targetValue, setTargetValue] = useState('0')
  const [currentValue, setCurrentValue] = useState('0')
  const [unit, setUnit] = useState('număr')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState<ObjectiveStatus>('planned')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      await onSave({
        title,
        description,
        metricName,
        targetValue: Number(targetValue),
        currentValue: Number(currentValue),
        unit,
        dueDate,
        status,
      })
      setTitle('')
      setDescription('')
    } catch {
      // Mutation state is rendered by the parent.
    }
  }

  return (
    <form className="territorial-org__inline-form territorial-org__inline-form--objective" onSubmit={(event) => void submit(event)}>
      <Input label="Obiectiv" value={title} onChange={(event) => setTitle(event.target.value)} required />
      <Input label="Indicator" value={metricName} onChange={(event) => setMetricName(event.target.value)} placeholder="Ex: membri noi" />
      <Input label="Țintă" type="number" min="0" step="0.01" value={targetValue} onChange={(event) => setTargetValue(event.target.value)} required />
      <Input label="Valoare curentă" type="number" min="0" step="0.01" value={currentValue} onChange={(event) => setCurrentValue(event.target.value)} required />
      <Input label="Unitate" value={unit} onChange={(event) => setUnit(event.target.value)} required />
      <Input label="Termen" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required />
      <Select label="Stare" value={status} onChange={(event) => setStatus(event.target.value as ObjectiveStatus)} options={Object.entries(objectiveStatusLabels).map(([value, label]) => ({ value, label }))} />
      <label className="field territorial-org__description"><span>Descriere</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></label>
      <Button type="submit" variant="primary" loading={saving}>Adaugă obiectiv</Button>
    </form>
  )
}

function ObjectiveCard({ objective, canWrite, saving, onUpdate }: {
  objective: OrganizationObjective
  canWrite: boolean
  saving: boolean
  onUpdate: (input: { currentValue: number; status: ObjectiveStatus }) => Promise<void>
}) {
  const [currentValue, setCurrentValue] = useState(String(objective.currentValue))
  const [status, setStatus] = useState<ObjectiveStatus>(objective.status)
  const progress = objective.targetValue > 0
    ? Math.min(100, Math.round((objective.currentValue / objective.targetValue) * 100))
    : objective.status === 'achieved' ? 100 : 0

  return (
    <article className={`territorial-org__objective is-${objective.status}`}>
      <div className="territorial-org__item-top">
        <div><h4>{objective.title}</h4><p>{objective.metricName || 'Indicator nespecificat'}</p></div>
        <span className="territorial-org__badge">{objectiveStatusLabels[objective.status]}</span>
      </div>
      <div className="territorial-org__objective-values">
        <strong>{objective.currentValue} / {objective.targetValue} {objective.unit}</strong>
        <span>Termen: {formatDate(objective.dueDate)}</span>
      </div>
      <div className="executive-dashboard__progress"><span style={{ width: `${progress}%` }} /></div>
      {objective.description ? <p>{objective.description}</p> : null}
      {canWrite ? (
        <form className="territorial-org__progress-form" onSubmit={(event) => {
          event.preventDefault()
          void onUpdate({ currentValue: Number(currentValue), status })
        }}>
          <Input label="Progres curent" type="number" min="0" step="0.01" value={currentValue} onChange={(event) => setCurrentValue(event.target.value)} />
          <Select label="Stare" value={status} onChange={(event) => setStatus(event.target.value as ObjectiveStatus)} options={Object.entries(objectiveStatusLabels).map(([value, label]) => ({ value, label }))} />
          <Button type="submit" loading={saving}>Actualizează</Button>
        </form>
      ) : null}
    </article>
  )
}

function OrganizationDetailPanel({ organization, canEdit, canManageMandates, canManageObjectives, saving, mutationError, onEdit, onAction }: {
  organization: OrganizationDetail
  canEdit: boolean
  canManageMandates: boolean
  canManageObjectives: boolean
  saving: boolean
  mutationError: string | null
  onEdit: () => void
  onAction: ReturnType<typeof useOrganizationMutations>['execute']
}) {
  return (
    <div className="territorial-org__detail">
      <section className="panel">
        <header className="panel__header territorial-org__detail-header">
          <div>
            <div className="hero-kicker">{organization.code} · {levelLabels[organization.level]}</div>
            <h2>{organization.name}</h2>
            <p className="muted">{organization.parent ? `Subordonată: ${organization.parent.name}` : 'Structură de nivel național'}</p>
          </div>
          <div className="territorial-org__detail-actions">
            <span className={`territorial-org__status is-${organization.status}`}>{statusLabels[organization.status]}</span>
            {canEdit ? <Button onClick={onEdit}>Editează organizația</Button> : null}
          </div>
        </header>
        <div className="panel__body territorial-org__facts">
          <div><span>Teritorii</span><strong>{organization.territories.map((territory) => territory.label).join(' · ')}</strong></div>
          <div><span>Constituită la</span><strong>{formatDate(organization.foundedAt)}</strong></div>
          <div><span>Membri declarați</span><strong>{organization.membersCount}</strong></div>
          <div><span>Sediu</span><strong>{organization.headquarters || 'Nespecificat'}</strong></div>
          <div><span>Email</span><strong>{organization.officialEmail || 'Nespecificat'}</strong></div>
          <div><span>Telefon</span><strong>{organization.phone || 'Nespecificat'}</strong></div>
        </div>
        {organization.children.length ? (
          <div className="panel__body territorial-org__children">
            <strong>Structuri subordonate</strong>
            <div>{organization.children.map((child) => <span key={child.id}>{child.code} — {child.name}</span>)}</div>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <header className="panel__header"><div><div className="panel__title">Conducere și mandate</div><p className="muted">Istoricul funcțiilor rămâne păstrat după încheierea mandatului.</p></div></header>
        <div className="panel__body territorial-org__mandates">
          {organization.mandates.length === 0 ? <p className="muted">Nu există încă mandate înregistrate.</p> : organization.mandates.map((mandate) => (
            <article className="territorial-org__mandate" key={mandate.id}>
              <div>
                <strong>{mandate.fullName}</strong>
                <span>{mandate.positionTitle}</span>
                <small>{formatDate(mandate.startedAt)} — {mandate.endedAt ? formatDate(mandate.endedAt) : 'prezent'}</small>
              </div>
              <div className="territorial-org__mandate-actions">
                <span className="territorial-org__badge">{mandateStatusLabels[mandate.status]}</span>
                {canManageMandates && mandate.status === 'active' ? (
                  <Button loading={saving} onClick={() => void onAction({
                    kind: 'update-mandate',
                    id: organization.id,
                    childId: mandate.id,
                    input: { status: 'completed', endedAt: today },
                  })}>Încheie mandatul</Button>
                ) : null}
              </div>
            </article>
          ))}
          {canManageMandates ? <MandateForm saving={saving} onSave={(input) => onAction({ kind: 'create-mandate', id: organization.id, input }).then(() => undefined)} /> : null}
        </div>
      </section>

      <section className="panel">
        <header className="panel__header"><div><div className="panel__title">Obiective teritoriale</div><p className="muted">Ținte măsurabile asumate de această organizație.</p></div></header>
        <div className="panel__body territorial-org__objective-grid">
          {organization.objectives.length === 0 ? <p className="muted">Nu există încă obiective asumate.</p> : organization.objectives.map((objective) => (
            <ObjectiveCard
              key={`${objective.id}:${objective.updatedAt}`}
              objective={objective}
              canWrite={canManageObjectives}
              saving={saving}
              onUpdate={(input) => onAction({ kind: 'update-objective', id: organization.id, childId: objective.id, input }).then(() => undefined)}
            />
          ))}
        </div>
        {canManageObjectives ? (
          <div className="panel__body">
            <ObjectiveForm saving={saving} onSave={(input) => onAction({ kind: 'create-objective', id: organization.id, input }).then(() => undefined)} />
          </div>
        ) : null}
      </section>
      {mutationError ? <div className="alert error">{mutationError}</div> : null}
    </div>
  )
}

function OrganizationList({ rows, selectedId, onSelect }: {
  rows: OrganizationListRow[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <section className="panel territorial-org__list-panel">
      <header className="panel__header"><div className="panel__title">Structuri înregistrate</div><span className="muted">{rows.length}</span></header>
      <div className="territorial-org__list">
        {rows.length === 0 ? <div className="territorial-org__empty">Nu există organizații reale înregistrate. Începe cu structura națională.</div> : rows.map((organization) => (
          <button
            type="button"
            className={`territorial-org__list-item${organization.id === selectedId ? ' is-selected' : ''}`}
            key={organization.id}
            onClick={() => onSelect(organization.id)}
          >
            <span><strong>{organization.name}</strong><small>{organization.code} · {levelLabels[organization.level]}</small></span>
            <span><b>{statusLabels[organization.status]}</b><small>{organization.territories.map((territory) => territory.label).join(', ')}</small></span>
          </button>
        ))}
      </div>
    </section>
  )
}

export function TerritorialOrganizationsPage() {
  const { user } = useAuth()
  const { registry, loading, error, reload } = useOrganizationRegistry()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState(false)
  const effectiveSelectedId = selectedId ?? registry?.rows[0]?.id ?? null
  const { organization, loading: detailLoading, error: detailError } = useOrganizationDetail(effectiveSelectedId)
  const mutations = useOrganizationMutations()
  const canCreate = user?.role === 'PRESEDINTE'
  const canEdit = user?.role === 'VICEPRESEDINTE' || user?.role === 'PRESEDINTE'
  const canManageMandates = user?.role === 'PRESEDINTE'
  const canManageObjectives = user?.role === 'SECRETAR' || user?.role === 'VICEPRESEDINTE' || user?.role === 'PRESEDINTE'
  const filteredRows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('ro-RO')
    if (!registry || !needle) return registry?.rows ?? []
    return registry.rows.filter((row) => [row.code, row.name, row.county, ...row.territories.map((territory) => territory.label)]
      .some((value) => value.toLocaleLowerCase('ro-RO').includes(needle)))
  }, [registry, search])

  async function saveOrganization(input: Partial<OrganizationWriteInput>) {
    mutations.reset()
    const saved = organization && editing
      ? await mutations.execute({ kind: 'update-organization', id: organization.id, input })
      : await mutations.execute({ kind: 'create-organization', input: input as OrganizationWriteInput })
    setSelectedId(saved.id)
    setEditing(false)
    setShowCreate(false)
  }

  return (
    <div className="territorial-org">
      <section className="hero territorial-org__hero">
        <div className="hero-kicker">Registru organizațional</div>
        <div className="territorial-org__hero-top">
          <div className="stack-12"><h1>Organizații teritoriale</h1><p className="lead">Filiale reale, ierarhie, teritorii, conduceri, mandate și obiective verificabile.</p></div>
          <div className="territorial-org__hero-actions">
            <Link className="btn" to={user?.role === 'VICEPRESEDINTE' || user?.role === 'PRESEDINTE' ? '/admin/dashboard' : '/admin/volunteers'}>
              {user?.role === 'VICEPRESEDINTE' || user?.role === 'PRESEDINTE' ? 'Tablou de comandă' : 'CRM teritorial'}
            </Link>
            {canCreate ? <Button variant="primary" onClick={() => { setShowCreate(true); setEditing(false); mutations.reset() }}>Organizație nouă</Button> : null}
            <Button onClick={reload} loading={loading}>Reîncarcă</Button>
          </div>
        </div>
      </section>

      {error ? <div className="alert error">{error}</div> : null}
      {registry ? (
        <>
          {registry.access ? <div className="alert success">Arie autorizată: {registry.access.scope}</div> : null}
          <section className="territorial-org__summary" aria-label="Situația registrului">
            <article><span>Total structuri</span><strong>{registry.summary.organizations}</strong></article>
            <article><span>Active</span><strong>{registry.summary.active}</strong></article>
            <article><span>În constituire</span><strong>{registry.summary.forming}</strong></article>
            <article><span>Județe acoperite</span><strong>{registry.summary.countiesCovered}</strong></article>
            <article><span>Mandate active</span><strong>{registry.summary.activeMandates}</strong></article>
            <article className={registry.summary.objectivesAtRisk ? 'is-risk' : ''}><span>Obiective în risc</span><strong>{registry.summary.objectivesAtRisk}</strong></article>
          </section>

          {showCreate ? (
            <OrganizationEditor
              registry={registry}
              saving={mutations.saving}
              error={mutations.error}
              onCancel={() => setShowCreate(false)}
              onSave={saveOrganization}
            />
          ) : null}

          <div className="territorial-org__workspace">
            <div className="territorial-org__sidebar">
              <Input label="Caută în registru" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cod, nume, județ, localitate" />
              <OrganizationList rows={filteredRows} selectedId={effectiveSelectedId} onSelect={(id) => { setSelectedId(id); setEditing(false); mutations.reset() }} />
            </div>
            <main>
              {detailLoading ? <section className="panel"><div className="panel__body">Se încarcă organizația…</div></section> : null}
              {detailError ? <div className="alert error">{detailError}</div> : null}
              {organization && editing ? (
                <OrganizationEditor
                  key={`${organization.id}:${organization.updatedAt}`}
                  registry={registry}
                  initial={organization}
                  saving={mutations.saving}
                  error={mutations.error}
                  onCancel={() => setEditing(false)}
                  onSave={saveOrganization}
                  contactOnly={user?.role === 'VICEPRESEDINTE'}
                />
              ) : null}
              {organization && !editing ? (
                <OrganizationDetailPanel
                  organization={organization}
                  canEdit={canEdit}
                  canManageMandates={canManageMandates}
                  canManageObjectives={canManageObjectives}
                  saving={mutations.saving}
                  mutationError={mutations.error}
                  onEdit={() => { setEditing(true); mutations.reset() }}
                  onAction={mutations.execute}
                />
              ) : null}
              {!organization && !detailLoading && !detailError ? (
                <section className="panel"><div className="panel__body territorial-org__empty">Selectează o structură sau înregistrează organizația națională pe baza documentelor reale.</div></section>
              ) : null}
            </main>
          </div>
        </>
      ) : null}
    </div>
  )
}

export default TerritorialOrganizationsPage
