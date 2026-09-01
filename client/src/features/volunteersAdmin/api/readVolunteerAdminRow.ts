import type {
  AdminVolunteersListMeta,
  VolunteerContactChannel,
  VolunteerAdminRecordSource,
  VolunteerAdminRow,
  VolunteerPriority,
  VolunteerWorkflowStatus,
} from '../types'
import type { Role } from '@features/auth/types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isWorkflowStatus(value: unknown): value is VolunteerWorkflowStatus {
  return value === 'nou' || value === 'validat' || value === 'contactat' || value === 'activ'
}

function isRecordSource(value: unknown): value is VolunteerAdminRecordSource {
  return value === 'volunteer' || value === 'user' || value === 'both'
}

function isContactChannel(value: unknown): value is VolunteerContactChannel {
  return value === 'telefon'
    || value === 'email'
    || value === 'whatsapp'
    || value === 'telegram'
    || value === 'facebook'
    || value === 'intalnire'
    || value === 'altul'
}

function isPriority(value: unknown): value is VolunteerPriority {
  return value === 'scazuta'
    || value === 'medie'
    || value === 'ridicata'
    || value === 'critica'
}

function isRole(value: unknown): value is Role {
  return value === 'SUSTINATOR'
    || value === 'ADERENT'
    || value === 'MEMBRU'
    || value === 'CONSILIER'
    || value === 'SECRETAR'
    || value === 'VICEPRESEDINTE'
    || value === 'PRESEDINTE'
}

function readNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== 'string') {
    throw new Error('Răspuns invalid de la server.')
  }

  return value
}

function readNullableRole(value: unknown): Role | null {
  if (value === null || value === undefined) {
    return null
  }

  if (!isRole(value)) {
    throw new Error('Răspuns invalid de la server.')
  }

  return value
}

function readNullableContactChannel(value: unknown): VolunteerContactChannel | null {
  if (value === null || value === undefined) {
    return null
  }

  if (!isContactChannel(value)) {
    throw new Error('Răspuns invalid de la server.')
  }

  return value
}

function readNullablePriority(value: unknown): VolunteerPriority | null {
  if (value === null || value === undefined) {
    return null
  }

  if (!isPriority(value)) {
    throw new Error('Răspuns invalid de la server.')
  }

  return value
}

function readTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error('Răspuns invalid de la server.')
  }

  return value.map((item) => {
    if (typeof item !== 'string') {
      throw new Error('Răspuns invalid de la server.')
    }

    return item
  })
}

function readOptionalFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function readVolunteerAdminRow(value: unknown): VolunteerAdminRow {
  if (!isRecord(value)) {
    throw new Error('Răspuns invalid de la server.')
  }

  if (
    typeof value.id !== 'number'
    || !Number.isFinite(value.id)
    || (value.volunteerId !== null && value.volunteerId !== undefined && typeof value.volunteerId !== 'number')
    || typeof value.fullName !== 'string'
    || typeof value.email !== 'string'
    || typeof value.phone !== 'string'
    || typeof value.county !== 'string'
    || typeof value.locality !== 'string'
    || typeof value.skills !== 'string'
    || typeof value.motivation !== 'string'
    || !isWorkflowStatus(value.workflowStatus)
    || typeof value.internalNotes !== 'string'
    || typeof value.createdAt !== 'string'
    || (value.statusUpdatedAt !== null && value.statusUpdatedAt !== undefined && typeof value.statusUpdatedAt !== 'string')
    || !isRecordSource(value.recordSource)
  ) {
    throw new Error('Răspuns invalid de la server.')
  }

  return {
    id: value.id,
    volunteerId: value.volunteerId ?? null,
    fullName: value.fullName,
    email: value.email,
    phone: value.phone,
    county: value.county,
    locality: value.locality,
    skills: value.skills,
    motivation: value.motivation,
    workflowStatus: value.workflowStatus,
    internalNotes: value.internalNotes,
    createdAt: value.createdAt,
    statusUpdatedAt: value.statusUpdatedAt ?? null,
    statusUpdatedByUserId: readNullableString(value.statusUpdatedByUserId),
    statusUpdatedByName: readNullableString(value.statusUpdatedByName),
    statusUpdatedByEmail: readNullableString(value.statusUpdatedByEmail),
    ownerUserId: readNullableString(value.ownerUserId),
    ownerName: readNullableString(value.ownerName),
    ownerEmail: readNullableString(value.ownerEmail),
    ownerRole: readNullableRole(value.ownerRole),
    followUpAt: readNullableString(value.followUpAt),
    reminderAt: readNullableString(value.reminderAt),
    lastContactAt: readNullableString(value.lastContactAt),
    contactChannel: readNullableContactChannel(value.contactChannel),
    priority: readNullablePriority(value.priority),
    rejectionReason: readNullableString(value.rejectionReason),
    tags: readTags(value.tags ?? []),
    skillTags: readTags(value.skillTags ?? []),
    accountRole: readNullableRole(value.accountRole),
    recordSource: value.recordSource,
  }
}

export function readVolunteerAdminRows(value: unknown): VolunteerAdminRow[] {
  if (!Array.isArray(value)) {
    throw new Error('Răspuns invalid de la server.')
  }

  return value.map(readVolunteerAdminRow)
}

export function readAdminVolunteersListMeta(value: unknown): AdminVolunteersListMeta {
  if (!isRecord(value)) {
    throw new Error('Răspuns invalid de la server.')
  }

  const count = readOptionalFiniteNumber(value.count)
  const limit = readOptionalFiniteNumber(value.limit)
  const nextCursor = value.nextCursor

  if (
    value.mode !== 'keyset'
    || count === undefined
    || limit === undefined
    || (nextCursor !== null && nextCursor !== undefined && typeof nextCursor !== 'string')
  ) {
    throw new Error('Răspuns invalid de la server.')
  }

  return {
    mode: 'keyset',
    count,
    limit,
    nextCursor: nextCursor ?? null,
  }
}
