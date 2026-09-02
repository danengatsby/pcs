import { Button } from '@components'
import { useAdminVolunteerAudit } from '../hooks/useAdminVolunteerAudit'
import { useUpdateVolunteerWorkflow } from '../hooks/useUpdateVolunteerWorkflow'
import type { VolunteerAdminAuditRow, VolunteerAdminRow } from '../types'
import VolunteerWorkflowForm, { type VolunteerWorkflowFormValues } from './VolunteerWorkflowForm'

function formatRoleLabel(role: VolunteerAdminRow['accountRole']): string {
  if (!role) return 'fără cont sincronizat'
  if (role === 'SUSTINATOR') return 'Susținător'
  if (role === 'VICEPRESEDINTE') return 'Vicepreședinte'
  return role.charAt(0) + role.slice(1).toLowerCase()
}

function formatSourceLabel(source: VolunteerAdminRow['recordSource']): string {
  if (source === 'both') return 'cont + formular voluntar'
  if (source === 'user') return 'doar cont utilizator'
  return 'doar formular voluntar'
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('ro-RO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatStatusUpdatedByLabel(volunteer: VolunteerAdminRow): string | null {
  const name = volunteer.statusUpdatedByName?.trim()
  const email = volunteer.statusUpdatedByEmail?.trim()
  const userId = volunteer.statusUpdatedByUserId?.trim()

  if (name && email && name.toLocaleLowerCase() !== email.toLocaleLowerCase()) {
    return `${name} (${email})`
  }

  return name || email || userId || null
}

function formatOwnerLabel(volunteer: VolunteerAdminRow): string | null {
  const name = volunteer.ownerName?.trim()
  const email = volunteer.ownerEmail?.trim()
  const userId = volunteer.ownerUserId?.trim()

  if (name && email && name.toLocaleLowerCase() !== email.toLocaleLowerCase()) {
    return `${name} (${email})`
  }

  return name || email || userId || null
}

function formatAuditValue(value: string | undefined): string {
  return value && value.trim() ? value : '—'
}

function formatAuditDateTime(value: string | undefined): string {
  return value ? formatDateTime(value) : '—'
}

function formatContactChannelLabel(value: VolunteerAdminRow['contactChannel'] | string | undefined): string {
  if (value === 'intalnire') return 'întâlnire'
  if (value === 'whatsapp') return 'WhatsApp'
  if (value) return value
  return '—'
}

function formatPriorityLabel(value: VolunteerAdminRow['priority'] | string | undefined): string {
  if (value === 'scazuta') return 'scăzută'
  if (value === 'ridicata') return 'ridicată'
  if (value === 'critica') return 'critică'
  if (value === 'medie') return 'medie'
  return '—'
}

function buildAuditChangeLines(entry: VolunteerAdminAuditRow): string[] {
  const details = entry.details
  const changedFields = details.changedFields
  const lines: string[] = []

  if (changedFields?.fullName && (details.previousFullName || details.nextFullName)) {
    lines.push(`Nume: ${formatAuditValue(details.previousFullName)} -> ${formatAuditValue(details.nextFullName)}`)
  }
  if (changedFields?.email && (details.previousEmail || details.nextEmail)) {
    lines.push(`Email: ${formatAuditValue(details.previousEmail)} -> ${formatAuditValue(details.nextEmail)}`)
  }
  if (changedFields?.phone && (details.previousPhone || details.nextPhone)) {
    lines.push(`Telefon: ${formatAuditValue(details.previousPhone)} -> ${formatAuditValue(details.nextPhone)}`)
  }
  if (
    typeof details.previousMotivationLength === 'number'
    && typeof details.nextMotivationLength === 'number'
    && details.previousMotivationLength !== details.nextMotivationLength
  ) {
    lines.push(`Motivație: ${details.previousMotivationLength} -> ${details.nextMotivationLength} caractere`)
  }
  if (changedFields?.status && (details.previousStatus || details.nextStatus)) {
    lines.push(`Status: ${formatAuditValue(details.previousStatus)} -> ${formatAuditValue(details.nextStatus)}`)
  }
  if (changedFields?.county && (details.previousCounty || details.nextCounty)) {
    lines.push(`Județ: ${formatAuditValue(details.previousCounty)} -> ${formatAuditValue(details.nextCounty)}`)
  }
  if (changedFields?.locality && (details.previousLocality || details.nextLocality)) {
    lines.push(`Localitate: ${formatAuditValue(details.previousLocality)} -> ${formatAuditValue(details.nextLocality)}`)
  }
  if (changedFields?.skills && (details.previousSkills || details.nextSkills)) {
    lines.push(`Skill-uri: ${formatAuditValue(details.previousSkills)} -> ${formatAuditValue(details.nextSkills)}`)
  }
  if (changedFields?.owner && (details.previousOwnerLabel || details.nextOwnerLabel)) {
    lines.push(`Responsabil: ${formatAuditValue(details.previousOwnerLabel)} -> ${formatAuditValue(details.nextOwnerLabel)}`)
  }
  if (changedFields?.followUpAt && (details.previousFollowUpAt || details.nextFollowUpAt)) {
    lines.push(`Follow-up: ${formatAuditDateTime(details.previousFollowUpAt)} -> ${formatAuditDateTime(details.nextFollowUpAt)}`)
  }
  if (changedFields?.reminderAt && (details.previousReminderAt || details.nextReminderAt)) {
    lines.push(`Reminder: ${formatAuditDateTime(details.previousReminderAt)} -> ${formatAuditDateTime(details.nextReminderAt)}`)
  }
  if (changedFields?.lastContactAt && (details.previousLastContactAt || details.nextLastContactAt)) {
    lines.push(`Ultimul contact: ${formatAuditDateTime(details.previousLastContactAt)} -> ${formatAuditDateTime(details.nextLastContactAt)}`)
  }
  if (changedFields?.contactChannel && (details.previousContactChannel || details.nextContactChannel)) {
    lines.push(
      `Canal contact: ${formatContactChannelLabel(details.previousContactChannel)} -> ${formatContactChannelLabel(details.nextContactChannel)}`
    )
  }
  if (changedFields?.priority && (details.previousPriority || details.nextPriority)) {
    lines.push(`Prioritate: ${formatPriorityLabel(details.previousPriority)} -> ${formatPriorityLabel(details.nextPriority)}`)
  }
  if (
    typeof details.previousRejectionReasonLength === 'number'
    && typeof details.nextRejectionReasonLength === 'number'
    && details.previousRejectionReasonLength !== details.nextRejectionReasonLength
  ) {
    lines.push(`Motiv respingere: ${details.previousRejectionReasonLength} -> ${details.nextRejectionReasonLength} caractere`)
  }
  if (changedFields?.tags && (details.previousTags?.length || details.nextTags?.length)) {
    lines.push(`Tag-uri: ${details.previousTags?.join(', ') || '—'} -> ${details.nextTags?.join(', ') || '—'}`)
  }
  if (changedFields?.skillTags && (details.previousSkillTags?.length || details.nextSkillTags?.length)) {
    lines.push(`Tag-uri skill-uri: ${details.previousSkillTags?.join(', ') || '—'} -> ${details.nextSkillTags?.join(', ') || '—'}`)
  }
  if (
    typeof details.previousNotesLength === 'number'
    && typeof details.nextNotesLength === 'number'
    && details.previousNotesLength !== details.nextNotesLength
  ) {
    lines.push(`Note interne: ${details.previousNotesLength} -> ${details.nextNotesLength} caractere`)
  }

  return lines
}

function formatAuditActionLabel(action: string): string {
  if (action === 'volunteer.workflow_update') {
    return 'Workflow actualizat'
  }

  if (action === 'volunteer.workflow_bulk_update') {
    return 'Workflow actualizat în masă'
  }

  return action
}

type VolunteerDetailsPanelProps = {
  volunteer: VolunteerAdminRow | null
  canManage?: boolean
  canPromote?: boolean
  canViewAudit?: boolean
  loading?: boolean
  error?: string | null
}

export function VolunteerDetailsPanel({ volunteer, canManage = true, canPromote = true, canViewAudit = true, loading = false, error: detailError = null }: VolunteerDetailsPanelProps) {
  const { submit, submitting, error: workflowError, reset } = useUpdateVolunteerWorkflow()
  const {
    entries: auditEntries,
    loading: auditLoading,
    loadingMore: auditLoadingMore,
    canLoadMore: canLoadMoreAudit,
    loadMore: loadMoreAudit,
    error: auditError,
  } = useAdminVolunteerAudit(canViewAudit ? volunteer?.id ?? null : null)

  if (loading) {
    return (
      <section className="panel volunteer-admin__panel volunteer-admin__panel--details">
        <div className="panel__body">
          <div className="volunteer-admin__empty">Se încarcă voluntarul.</div>
        </div>
      </section>
    )
  }

  if (!volunteer) {
    return (
      <section className="panel volunteer-admin__panel volunteer-admin__panel--details">
        <div className="panel__body">
          {detailError ? <div className="alert error">{detailError}</div> : null}
          <div className="volunteer-admin__empty">Selectează un voluntar.</div>
        </div>
      </section>
    )
  }

  const canManageWorkflow = canManage && volunteer.volunteerId !== null
  const statusUpdatedByLabel = formatStatusUpdatedByLabel(volunteer)
  const ownerLabel = formatOwnerLabel(volunteer)

  return (
    <section className="panel volunteer-admin__panel volunteer-admin__panel--details">
      <div className="panel__body volunteer-admin__details">
        <div className="volunteer-admin__identity">
          <h2 className="volunteer-admin__selected-name">{volunteer.fullName}</h2>
          <div className="volunteer-admin__detail-line">
            {volunteer.email} · {volunteer.phone || '—'}
          </div>
          <div className="volunteer-admin__detail-line">
            {volunteer.county && volunteer.locality
              ? `${volunteer.county} / ${volunteer.locality}`
              : 'Fără date din formular'}
            {' · '}
            {volunteer.skills || '—'}
          </div>
          <div className="volunteer-admin__detail-line">
            Status: <strong>{volunteer.workflowStatus}</strong>
          </div>
          <div className="volunteer-admin__detail-line">
            Rol cont: <strong>{formatRoleLabel(volunteer.accountRole)}</strong> · Sursă: {formatSourceLabel(volunteer.recordSource)}
          </div>
          <div className="volunteer-admin__detail-line">
            Ultima actualizare workflow:{' '}
            <strong>{volunteer.statusUpdatedAt ? formatDateTime(volunteer.statusUpdatedAt) : 'niciuna'}</strong>
            {statusUpdatedByLabel ? ` · de ${statusUpdatedByLabel}` : ''}
          </div>
          <div className="volunteer-admin__detail-line">
            Responsabil: <strong>{ownerLabel ?? 'neatribuit'}</strong>
            {' · '}
            Prioritate: <strong>{formatPriorityLabel(volunteer.priority)}</strong>
          </div>
          <div className="volunteer-admin__detail-line">
            Follow-up: <strong>{volunteer.followUpAt ? formatDateTime(volunteer.followUpAt) : 'nesetat'}</strong>
            {' · '}
            Reminder: <strong>{volunteer.reminderAt ? formatDateTime(volunteer.reminderAt) : 'niciunul'}</strong>
            {' · '}
            Ultimul contact: <strong>{volunteer.lastContactAt ? formatDateTime(volunteer.lastContactAt) : 'niciunul'}</strong>
          </div>
          <div className="volunteer-admin__detail-line">
            Canal contact: <strong>{formatContactChannelLabel(volunteer.contactChannel)}</strong>
            {' · '}
            Tag-uri CRM: {volunteer.tags.length > 0 ? volunteer.tags.join(', ') : '—'}
          </div>
          <div className="volunteer-admin__detail-line">
            Tag-uri skill-uri: {volunteer.skillTags.length > 0 ? volunteer.skillTags.join(', ') : '—'}
          </div>
        </div>

        {volunteer.motivation ? (
          <details className="volunteer-admin__motivation-toggle">
            <summary>Motivație</summary>
            <pre className="volunteer-admin__motivation">{volunteer.motivation}</pre>
          </details>
        ) : null}

        {volunteer.rejectionReason ? (
          <details className="volunteer-admin__motivation-toggle">
            <summary>Motiv respingere</summary>
            <pre className="volunteer-admin__motivation">{volunteer.rejectionReason}</pre>
          </details>
        ) : null}

        <div className="volunteer-admin__workflow">
          <h3 className="volunteer-admin__workflow-title">Date voluntar și workflow / CRM</h3>
          {detailError ? <div className="alert error">{detailError}</div> : null}
          {canManageWorkflow ? (
            <>
              {workflowError ? <div className="alert error">{workflowError}</div> : null}
              <VolunteerWorkflowForm
                volunteer={volunteer}
                canPromote={canPromote}
                submitting={submitting}
                onSubmit={async (values: VolunteerWorkflowFormValues) => {
                  if (volunteer.volunteerId === null) {
                    return
                  }

                  reset()
                  try {
                    await submit({
                      volunteerId: volunteer.volunteerId,
                      input: values,
                    })
                  } catch {
                    // Error state is already exposed by the mutation hook.
                  }
                }}
              />
            </>
          ) : canManage ? (
            <div className="muted">
              Acest cont există doar în tabela de utilizatori. Workflow-ul poate fi editat doar pentru înregistrări care au și formular de voluntar.
            </div>
          ) : <div className="muted">Funcția ta permite consultarea dosarului, nu modificarea workflow-ului.</div>}
        </div>

        {canViewAudit ? <div className="volunteer-admin__workflow">
          <h3 className="volunteer-admin__workflow-title">Istoric workflow</h3>
          {auditError ? <div className="alert error">{auditError}</div> : null}
          {auditLoading ? <div className="muted">Se încarcă istoricul.</div> : null}
          {!auditLoading && !auditError && auditEntries.length === 0 ? (
            <div className="muted">Nu există acțiuni înregistrate pentru acest voluntar.</div>
          ) : null}

          {auditEntries.map((entry: VolunteerAdminAuditRow) => {
            const changeLines = buildAuditChangeLines(entry)

            return (
              <article key={entry.id} className="volunteer-admin__audit-entry">
                <div className="volunteer-admin__audit-meta">
                  <strong>{formatAuditActionLabel(entry.action)}</strong>
                  {' · '}
                  {formatDateTime(entry.createdAt)}
                  {' · '}
                  {entry.actorEmail || 'administrator'}
                </div>
                {changeLines.length > 0 ? (
                  <ul className="volunteer-admin__audit-changes">
                    {changeLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="muted">Fără diferențe structurale înregistrate.</div>
                )}
              </article>
            )
          })}

          {canLoadMoreAudit ? (
            <div className="volunteer-admin__audit-actions">
              <Button type="button" onClick={loadMoreAudit} loading={auditLoadingMore}>
                Încarcă mai mult
              </Button>
            </div>
          ) : null}
        </div> : null}
      </div>
    </section>
  )
}
