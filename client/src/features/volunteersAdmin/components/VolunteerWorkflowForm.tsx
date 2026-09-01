import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Button, Input, Select } from '@components'
import { useCounties } from '@features/contact/hooks/useCounties'
import { useVolunteerOwners } from '../hooks/useVolunteerOwners'
import type {
  VolunteerAdminRow,
  VolunteerContactChannel,
  VolunteerOwnerOption,
  VolunteerPriority,
  VolunteerWorkflowStatus,
} from '../types'
import {
  volunteerContactChannelValues,
  volunteerPriorityValues,
  volunteerWorkflowStatusValues,
} from '../types'

export type VolunteerWorkflowFormValues = {
  status: VolunteerWorkflowStatus
  internalNotes: string
  county?: string
  locality?: string
  skills?: string
  ownerUserId: number | null
  followUpAt: string | null
  reminderAt: string | null
  lastContactAt: string | null
  contactChannel: VolunteerContactChannel | null
  priority: VolunteerPriority
  rejectionReason: string
  tags: string[]
  skillTags: string[]
}

type VolunteerWorkflowFormState = {
  status: VolunteerWorkflowStatus
  internalNotes: string
  county: string
  locality: string
  skills: string
  ownerUserId: string
  followUpAt: string
  reminderAt: string
  lastContactAt: string
  contactChannel: string
  priority: VolunteerPriority
  rejectionReason: string
  tagsInput: string
  skillTagsInput: string
}

type VolunteerWorkflowFormDraft = Partial<VolunteerWorkflowFormState>

type VolunteerWorkflowFormDraftState = {
  volunteerId: VolunteerAdminRow['id']
  values: VolunteerWorkflowFormDraft
}

function normalizeOptionalInput(value: string): string | undefined {
  const trimmedValue = value.trim()
  return trimmedValue.length > 0 ? trimmedValue : undefined
}

function normalizeOptionalDateTimeInput(value: string): string | null {
  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return null
  }

  const parsedDate = new Date(trimmedValue)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString()
}

function readDateTimeLocalInput(value: string | null): string {
  if (!value) {
    return ''
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return ''
  }

  const pad = (part: number) => String(part).padStart(2, '0')

  return [
    parsedDate.getFullYear(),
    pad(parsedDate.getMonth() + 1),
    pad(parsedDate.getDate()),
  ].join('-') + `T${pad(parsedDate.getHours())}:${pad(parsedDate.getMinutes())}`
}

function parseOwnerUserId(value: string): number | null {
  const trimmedValue = value.trim()
  if (!trimmedValue) {
    return null
  }

  const parsedValue = Number(trimmedValue)
  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : null
}

function normalizeTagsInput(value: string): string[] {
  const seen = new Set<string>()

  return value
    .split(/[,\n;]/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0)
    .filter((item) => {
      if (seen.has(item)) {
        return false
      }

      seen.add(item)
      return true
    })
}

function buildVolunteerWorkflowFormState(volunteer: VolunteerAdminRow): VolunteerWorkflowFormState {
  return {
    status: volunteer.workflowStatus,
    internalNotes: volunteer.internalNotes ?? '',
    county: volunteer.county ?? '',
    locality: volunteer.locality ?? '',
    skills: volunteer.skills ?? '',
    ownerUserId: volunteer.ownerUserId ?? '',
    followUpAt: readDateTimeLocalInput(volunteer.followUpAt),
    reminderAt: readDateTimeLocalInput(volunteer.reminderAt),
    lastContactAt: readDateTimeLocalInput(volunteer.lastContactAt),
    contactChannel: volunteer.contactChannel ?? '',
    priority: volunteer.priority ?? 'medie',
    rejectionReason: volunteer.rejectionReason ?? '',
    tagsInput: volunteer.tags.join(', '),
    skillTagsInput: volunteer.skillTags.join(', '),
  }
}

function buildEffectiveDraftValues(
  draftValues: VolunteerWorkflowFormDraft,
  syncedValues: VolunteerWorkflowFormState,
): VolunteerWorkflowFormDraft {
  const nextDraftValues: VolunteerWorkflowFormDraft = {}
  const nextDraftValuesRecord = nextDraftValues as Record<
    keyof VolunteerWorkflowFormState,
    VolunteerWorkflowFormState[keyof VolunteerWorkflowFormState] | undefined
  >

  for (const field of Object.keys(draftValues) as Array<keyof VolunteerWorkflowFormState>) {
    const value = draftValues[field]
    if (value === undefined) {
      continue
    }

    if (value !== syncedValues[field]) {
      nextDraftValuesRecord[field] = value
    }
  }

  return nextDraftValues
}

function areDraftValuesEqual(
  current: VolunteerWorkflowFormDraft,
  next: VolunteerWorkflowFormDraft,
): boolean {
  const currentKeys = Object.keys(current) as Array<keyof VolunteerWorkflowFormDraft>
  const nextKeys = Object.keys(next) as Array<keyof VolunteerWorkflowFormDraft>

  if (currentKeys.length !== nextKeys.length) {
    return false
  }

  return currentKeys.every((key) => current[key] === next[key])
}

function resolveDraftValues(
  draftState: VolunteerWorkflowFormDraftState,
  volunteerId: VolunteerAdminRow['id'],
): VolunteerWorkflowFormDraft {
  return draftState.volunteerId === volunteerId ? draftState.values : {}
}

function formatOwnerRoleLabel(role: VolunteerOwnerOption['role']): string {
  if (role === 'VICEPRESEDINTE') return 'Vicepreședinte'
  return role.charAt(0) + role.slice(1).toLowerCase()
}

function formatPriorityLabel(value: VolunteerPriority): string {
  if (value === 'scazuta') return 'Scăzută'
  if (value === 'ridicata') return 'Ridicată'
  if (value === 'critica') return 'Critică'
  return 'Medie'
}

function formatContactChannelLabel(value: VolunteerContactChannel): string {
  if (value === 'intalnire') return 'Întâlnire'
  if (value === 'whatsapp') return 'WhatsApp'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function areFormStatesEqual(
  current: VolunteerWorkflowFormState,
  next: VolunteerWorkflowFormState,
): boolean {
  return current.status === next.status
    && current.internalNotes === next.internalNotes
    && current.county === next.county
    && current.locality === next.locality
    && current.skills === next.skills
    && current.ownerUserId === next.ownerUserId
    && current.followUpAt === next.followUpAt
    && current.reminderAt === next.reminderAt
    && current.lastContactAt === next.lastContactAt
    && current.contactChannel === next.contactChannel
    && current.priority === next.priority
    && current.rejectionReason === next.rejectionReason
    && current.tagsInput === next.tagsInput
    && current.skillTagsInput === next.skillTagsInput
}

const statusOptions = volunteerWorkflowStatusValues.map((value) => ({
  value,
  label: value,
}))
const priorityOptions = volunteerPriorityValues.map((value) => ({
  value,
  label: formatPriorityLabel(value),
}))
const contactChannelOptions = [
  { value: '', label: 'Neselectat' },
  ...volunteerContactChannelValues.map((value) => ({
    value,
    label: formatContactChannelLabel(value),
  })),
]

export function VolunteerWorkflowForm({
  volunteer,
  onSubmit,
  submitting,
}: {
  volunteer: VolunteerAdminRow
  submitting: boolean
  onSubmit: (values: VolunteerWorkflowFormValues) => void | Promise<void>
}) {
  const { loading: countiesLoading, error: countiesError, counties } = useCounties()
  const { owners, loading: ownersLoading, error: ownersError } = useVolunteerOwners()
  const syncedValues = buildVolunteerWorkflowFormState(volunteer)
  const [draftState, setDraftState] = useState<VolunteerWorkflowFormDraftState>(() => ({
    volunteerId: volunteer.id,
    values: {},
  }))
  const draftValues = resolveDraftValues(draftState, volunteer.id)
  const effectiveDraftValues = buildEffectiveDraftValues(draftValues, syncedValues)
  const formValues: VolunteerWorkflowFormState = {
    ...syncedValues,
    ...effectiveDraftValues,
  }
  const isDirty = !areFormStatesEqual(formValues, syncedValues)

  const countyOptions = (() => {
    const seen = new Set<string>()

    return [formValues.county, ...counties]
      .filter((value) => value.trim().length > 0)
      .filter((value) => {
        const normalizedValue = value.trim().toLocaleLowerCase()
        if (seen.has(normalizedValue)) {
          return false
        }

        seen.add(normalizedValue)
        return true
      })
      .map((value) => ({
        value,
        label: value,
      }))
  })()

  const ownerOptions = (() => {
    const seen = new Set<string>()
    const mergedOwners: VolunteerOwnerOption[] = []

    if (volunteer.ownerUserId) {
      mergedOwners.push({
        id: volunteer.ownerUserId,
        fullName: volunteer.ownerName ?? volunteer.ownerEmail ?? volunteer.ownerUserId,
        email: volunteer.ownerEmail ?? '',
        role: volunteer.ownerRole ?? 'CONSILIER',
      })
    }

    for (const owner of owners) {
      mergedOwners.push(owner)
    }

    return [
      { value: '', label: 'Neatribuit' },
      ...mergedOwners
        .filter((owner) => {
          if (seen.has(owner.id)) {
            return false
          }

          seen.add(owner.id)
          return true
        })
        .map((owner) => ({
          value: owner.id,
          label: owner.email
            ? `${owner.fullName} (${owner.email}) · ${formatOwnerRoleLabel(owner.role)}`
            : `${owner.fullName} · ${formatOwnerRoleLabel(owner.role)}`,
        })),
    ]
  })()

  function handleReset() {
    setDraftState((current) => (
      current.volunteerId === volunteer.id && Object.keys(current.values).length === 0
        ? current
        : {
            volunteerId: volunteer.id,
            values: {},
          }
    ))
  }

  function updateDraftValue<Field extends keyof VolunteerWorkflowFormState>(
    field: Field,
    value: VolunteerWorkflowFormState[Field],
  ) {
    setDraftState((current) => {
      const currentValues = resolveDraftValues(current, volunteer.id)
      const nextValues = buildEffectiveDraftValues(
        {
          ...currentValues,
          [field]: value,
        },
        syncedValues,
      )

      if (current.volunteerId === volunteer.id && areDraftValuesEqual(currentValues, nextValues)) {
        return current
      }

      return {
        volunteerId: volunteer.id,
        values: nextValues,
      }
    })
  }

  return (
    <form
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (submitting || !isDirty) {
          return
        }

        if (!e.currentTarget.checkValidity()) {
          e.currentTarget.reportValidity()
          return
        }

        onSubmit({
          status: formValues.status,
          internalNotes: formValues.internalNotes.trim(),
          county: normalizeOptionalInput(formValues.county),
          locality: normalizeOptionalInput(formValues.locality),
          skills: normalizeOptionalInput(formValues.skills),
          ownerUserId: parseOwnerUserId(formValues.ownerUserId),
          followUpAt: normalizeOptionalDateTimeInput(formValues.followUpAt),
          reminderAt: normalizeOptionalDateTimeInput(formValues.reminderAt),
          lastContactAt: normalizeOptionalDateTimeInput(formValues.lastContactAt),
          contactChannel: formValues.contactChannel
            ? formValues.contactChannel as VolunteerContactChannel
            : null,
          priority: formValues.priority,
          rejectionReason: formValues.rejectionReason.trim(),
          tags: normalizeTagsInput(formValues.tagsInput),
          skillTags: normalizeTagsInput(formValues.skillTagsInput),
        })
      }}
      className="form"
    >
      <Select
        label="Status"
        value={formValues.status}
        onChange={(event) => updateDraftValue('status', event.target.value as VolunteerWorkflowStatus)}
        options={statusOptions}
      />

      <Select
        label="Responsabil"
        value={formValues.ownerUserId}
        onChange={(event) => updateDraftValue('ownerUserId', event.target.value)}
        options={ownerOptions}
        disabled={ownersLoading}
        hint={ownersError ?? undefined}
      />

      <Select
        label="Prioritate"
        value={formValues.priority}
        onChange={(event) => updateDraftValue('priority', event.target.value as VolunteerPriority)}
        options={priorityOptions}
      />

      <Input
        label="Follow-up la"
        type="datetime-local"
        value={formValues.followUpAt}
        onChange={(event: ChangeEvent<HTMLInputElement>) => updateDraftValue('followUpAt', event.target.value)}
      />

      <Input
        label="Reminder la"
        type="datetime-local"
        value={formValues.reminderAt}
        onChange={(event: ChangeEvent<HTMLInputElement>) => updateDraftValue('reminderAt', event.target.value)}
      />

      <Input
        label="Ultimul contact"
        type="datetime-local"
        value={formValues.lastContactAt}
        onChange={(event: ChangeEvent<HTMLInputElement>) => updateDraftValue('lastContactAt', event.target.value)}
      />

      <Select
        label="Canal contact"
        value={formValues.contactChannel}
        onChange={(event) => updateDraftValue('contactChannel', event.target.value)}
        options={contactChannelOptions}
      />

      <Select
        label="Județ"
        value={formValues.county}
        onChange={(event) => updateDraftValue('county', event.target.value)}
        required
        disabled={countiesLoading}
        placeholder={
          countiesLoading
            ? 'Se încarcă județele…'
            : countiesError
              ? 'Județ indisponibil'
              : 'Alege județul'
        }
        options={countyOptions}
        hint={countiesError ?? undefined}
      />

      <Input
        label="Localitate"
        value={formValues.locality}
        onChange={(event: ChangeEvent<HTMLInputElement>) => updateDraftValue('locality', event.target.value)}
        placeholder="ex: Sector 1"
        required
        minLength={2}
        maxLength={120}
      />

      <Input
        label="Skill-uri"
        value={formValues.skills}
        onChange={(event: ChangeEvent<HTMLInputElement>) => updateDraftValue('skills', event.target.value)}
        placeholder="ex: juridic, IT"
        maxLength={220}
      />

      <Input
        label="Tag-uri CRM"
        value={formValues.tagsInput}
        onChange={(event: ChangeEvent<HTMLInputElement>) => updateDraftValue('tagsInput', event.target.value)}
        placeholder="ex: student, ONG, diaspora"
        maxLength={240}
      />

      <Input
        label="Tag-uri skill-uri"
        value={formValues.skillTagsInput}
        onChange={(event: ChangeEvent<HTMLInputElement>) => updateDraftValue('skillTagsInput', event.target.value)}
        placeholder="ex: organizare, teren, fundraising"
        maxLength={240}
      />

      <label className="field">
        <span>Note interne</span>
        <textarea
          id="volunteer-workflow-internal-notes"
          value={formValues.internalNotes}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateDraftValue('internalNotes', event.target.value)}
          rows={6}
          placeholder="Note interne (max 5000)"
          maxLength={5000}
        />
      </label>

      <label className="field">
        <span>Motiv respingere</span>
        <textarea
          id="volunteer-workflow-rejection-reason"
          value={formValues.rejectionReason}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateDraftValue('rejectionReason', event.target.value)}
          rows={4}
          placeholder="Opțional. Documentează de ce nu continuă fluxul."
          maxLength={2000}
        />
      </label>

      {isDirty ? <div className="muted">Ai modificări nesalvate.</div> : null}

      <div className="row">
        <Button type="button" disabled={!isDirty || submitting} onClick={handleReset}>
          Resetează
        </Button>
        <Button type="submit" disabled={!isDirty || submitting}>
          {submitting ? 'Salvez...' : 'Salvează'}
        </Button>
      </div>
    </form>
  )
}

export default VolunteerWorkflowForm
