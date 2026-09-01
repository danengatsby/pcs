import { apiGetEnvelope } from '@lib/http'
import type {
  VolunteerAdminAuditMeta,
  VolunteerAdminAuditPage,
  VolunteerAdminAuditRow,
  VolunteerWorkflowAuditDetails,
} from '../types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function readOptionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  return value.flatMap((item) => (typeof item === 'string' ? [item] : []))
}

function readAuditDetails(value: unknown): VolunteerWorkflowAuditDetails {
  if (!isRecord(value)) {
    return {}
  }

  const changedFieldsRecord = isRecord(value.changedFields) ? value.changedFields : null

  return {
    changedFields: changedFieldsRecord ? {
      status: changedFieldsRecord.status === true,
      county: changedFieldsRecord.county === true,
      locality: changedFieldsRecord.locality === true,
      skills: changedFieldsRecord.skills === true,
      owner: changedFieldsRecord.owner === true,
      followUpAt: changedFieldsRecord.followUpAt === true,
      reminderAt: changedFieldsRecord.reminderAt === true,
      lastContactAt: changedFieldsRecord.lastContactAt === true,
      contactChannel: changedFieldsRecord.contactChannel === true,
      priority: changedFieldsRecord.priority === true,
      rejectionReason: changedFieldsRecord.rejectionReason === true,
      tags: changedFieldsRecord.tags === true,
      skillTags: changedFieldsRecord.skillTags === true,
    } : undefined,
    previousStatus: readOptionalString(value.previousStatus),
    nextStatus: readOptionalString(value.nextStatus),
    previousCounty: readOptionalString(value.previousCounty),
    nextCounty: readOptionalString(value.nextCounty),
    previousLocality: readOptionalString(value.previousLocality),
    nextLocality: readOptionalString(value.nextLocality),
    previousSkills: readOptionalString(value.previousSkills),
    nextSkills: readOptionalString(value.nextSkills),
    previousOwnerLabel: readOptionalString(value.previousOwnerLabel),
    nextOwnerLabel: readOptionalString(value.nextOwnerLabel),
    previousFollowUpAt: readOptionalString(value.previousFollowUpAt),
    nextFollowUpAt: readOptionalString(value.nextFollowUpAt),
    previousReminderAt: readOptionalString(value.previousReminderAt),
    nextReminderAt: readOptionalString(value.nextReminderAt),
    previousLastContactAt: readOptionalString(value.previousLastContactAt),
    nextLastContactAt: readOptionalString(value.nextLastContactAt),
    previousContactChannel: readOptionalString(value.previousContactChannel),
    nextContactChannel: readOptionalString(value.nextContactChannel),
    previousPriority: readOptionalString(value.previousPriority),
    nextPriority: readOptionalString(value.nextPriority),
    previousRejectionReasonLength: readOptionalNumber(value.previousRejectionReasonLength),
    nextRejectionReasonLength: readOptionalNumber(value.nextRejectionReasonLength),
    previousTags: readOptionalStringArray(value.previousTags),
    nextTags: readOptionalStringArray(value.nextTags),
    previousSkillTags: readOptionalStringArray(value.previousSkillTags),
    nextSkillTags: readOptionalStringArray(value.nextSkillTags),
    previousNotesLength: readOptionalNumber(value.previousNotesLength),
    nextNotesLength: readOptionalNumber(value.nextNotesLength),
  }
}

function readAuditRow(value: unknown): VolunteerAdminAuditRow {
  if (!isRecord(value)) {
    throw new Error('Răspuns invalid de la server.')
  }

  if (
    typeof value.id !== 'string'
    || (value.actorUserId !== null && value.actorUserId !== undefined && typeof value.actorUserId !== 'string')
    || typeof value.actorEmail !== 'string'
    || typeof value.actorRole !== 'string'
    || typeof value.action !== 'string'
    || typeof value.targetType !== 'string'
    || typeof value.targetId !== 'string'
    || typeof value.createdAt !== 'string'
  ) {
    throw new Error('Răspuns invalid de la server.')
  }

  return {
    id: value.id,
    actorUserId: value.actorUserId ?? null,
    actorEmail: value.actorEmail,
    actorRole: value.actorRole,
    action: value.action,
    targetType: value.targetType,
    targetId: value.targetId,
    details: readAuditDetails(value.details),
    createdAt: value.createdAt,
  }
}

function readAuditRows(value: unknown): VolunteerAdminAuditRow[] {
  if (!Array.isArray(value)) {
    throw new Error('Răspuns invalid de la server.')
  }

  return value.map(readAuditRow)
}

function readAuditMeta(value: unknown): VolunteerAdminAuditMeta {
  if (!isRecord(value)) {
    throw new Error('Răspuns invalid de la server.')
  }

  if (
    typeof value.count !== 'number'
    || !Number.isFinite(value.count)
    || typeof value.limit !== 'number'
    || !Number.isFinite(value.limit)
    || (value.nextCursor !== null && value.nextCursor !== undefined && typeof value.nextCursor !== 'string')
  ) {
    throw new Error('Răspuns invalid de la server.')
  }

  return {
    count: value.count,
    limit: value.limit,
    nextCursor: value.nextCursor ?? null,
  }
}

export async function getAdminVolunteerAudit(
  volunteerId: number,
  options: {
    limit?: number
    cursor?: string | null
  } = {},
): Promise<VolunteerAdminAuditPage> {
  const limit = options.limit ?? 12
  const params = new URLSearchParams({
    limit: String(limit),
    targetType: 'volunteer',
    targetId: String(volunteerId),
  })
  if (options.cursor) {
    params.set('cursor', options.cursor)
  }

  const response = await apiGetEnvelope<VolunteerAdminAuditRow[], VolunteerAdminAuditMeta>(
    `/api/admin/audit?${params.toString()}`,
    {
      auth: true,
      parseData: readAuditRows,
      parseMeta: readAuditMeta,
    },
  )

  if (!response.ok) {
    throw new Error(response.error.message)
  }

  return {
    data: response.data,
    meta: response.meta ?? {
      count: response.data.length,
      limit,
      nextCursor: null,
    },
  }
}
