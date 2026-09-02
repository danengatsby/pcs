import type { Role } from '@features/auth/types'

export const volunteerWorkflowStatusValues = ['nou', 'validat', 'contactat', 'activ'] as const
export const volunteerContactChannelValues = [
  'telefon',
  'email',
  'whatsapp',
  'telegram',
  'facebook',
  'intalnire',
  'altul',
] as const
export const volunteerPriorityValues = ['scazuta', 'medie', 'ridicata', 'critica'] as const

export type VolunteerWorkflowStatus = (typeof volunteerWorkflowStatusValues)[number]
export type VolunteerContactChannel = (typeof volunteerContactChannelValues)[number]
export type VolunteerPriority = (typeof volunteerPriorityValues)[number]

export type VolunteerAdminFilters = {
  status?: string
  search?: string
  county?: string
  locality?: string
  skills?: string
}

export type VolunteerAdminRecordSource = 'volunteer' | 'user' | 'both'

export type VolunteerWorkflowAuditDetails = {
  changedFields?: {
    fullName?: boolean
    email?: boolean
    phone?: boolean
    motivation?: boolean
    status?: boolean
    county?: boolean
    locality?: boolean
    skills?: boolean
    owner?: boolean
    followUpAt?: boolean
    reminderAt?: boolean
    lastContactAt?: boolean
    contactChannel?: boolean
    priority?: boolean
    rejectionReason?: boolean
    tags?: boolean
    skillTags?: boolean
  }
  previousFullName?: string
  nextFullName?: string
  previousEmail?: string
  nextEmail?: string
  previousPhone?: string
  nextPhone?: string
  previousMotivationLength?: number
  nextMotivationLength?: number
  previousStatus?: string
  nextStatus?: string
  previousCounty?: string
  nextCounty?: string
  previousLocality?: string
  nextLocality?: string
  previousSkills?: string
  nextSkills?: string
  previousOwnerLabel?: string
  nextOwnerLabel?: string
  previousFollowUpAt?: string
  nextFollowUpAt?: string
  previousReminderAt?: string
  nextReminderAt?: string
  previousLastContactAt?: string
  nextLastContactAt?: string
  previousContactChannel?: string
  nextContactChannel?: string
  previousPriority?: string
  nextPriority?: string
  previousRejectionReasonLength?: number
  nextRejectionReasonLength?: number
  previousTags?: string[]
  nextTags?: string[]
  previousSkillTags?: string[]
  nextSkillTags?: string[]
  previousNotesLength?: number
  nextNotesLength?: number
}

export type VolunteerAdminRow = {
  id: number
  volunteerId: number | null
  fullName: string
  email: string
  phone: string
  county: string
  locality: string
  skills: string
  motivation: string
  workflowStatus: VolunteerWorkflowStatus
  internalNotes: string
  createdAt: string
  statusUpdatedAt: string | null
  statusUpdatedByUserId: string | null
  statusUpdatedByName: string | null
  statusUpdatedByEmail: string | null
  ownerUserId: string | null
  ownerName: string | null
  ownerEmail: string | null
  ownerRole: Role | null
  followUpAt: string | null
  reminderAt: string | null
  lastContactAt: string | null
  contactChannel: VolunteerContactChannel | null
  priority: VolunteerPriority | null
  rejectionReason: string | null
  tags: string[]
  skillTags: string[]
  accountRole: Role | null
  recordSource: VolunteerAdminRecordSource
}

export type VolunteerOwnerOption = {
  id: string
  fullName: string
  email: string
  role: Role
}

export type AdminVolunteersListMeta = {
  mode: 'keyset'
  count: number
  limit: number
  nextCursor: string | null
}

export type AdminVolunteersListResponse = {
  data: VolunteerAdminRow[]
  meta: AdminVolunteersListMeta
}

export type VolunteerWorkflowUpdateInput = {
  fullName?: string
  email?: string
  phone?: string
  motivation?: string
  status: VolunteerWorkflowStatus
  internalNotes: string
  county?: string
  locality?: string
  skills?: string
  ownerUserId?: number | null
  followUpAt?: string | null
  reminderAt?: string | null
  lastContactAt?: string | null
  contactChannel?: VolunteerContactChannel | null
  priority?: VolunteerPriority
  rejectionReason?: string
  tags?: string[]
  skillTags?: string[]
}

export type VolunteerWorkflowUpdateResponse = {
  message: string
  volunteer: VolunteerAdminRow
}

export type VolunteerAdminAuditRow = {
  id: string
  actorUserId: string | null
  actorEmail: string
  actorRole: string
  action: string
  targetType: string
  targetId: string
  details: VolunteerWorkflowAuditDetails
  createdAt: string
}

export type VolunteerAdminAuditMeta = {
  count: number
  limit: number
  nextCursor: string | null
}

export type VolunteerAdminAuditPage = {
  data: VolunteerAdminAuditRow[]
  meta: VolunteerAdminAuditMeta
}

export type VolunteerWorkflowBulkUpdateInput = {
  target: VolunteerBulkTarget
  status: VolunteerWorkflowStatus
}

export type VolunteerBulkTarget =
  | {
      type: 'ids'
      volunteerIds: number[]
    }
  | {
      type: 'filters'
      filters: VolunteerAdminFilters
    }

export type VolunteerWorkflowBulkUpdateResponse = {
  message: string
  updatedCount: number
  skippedCount: number
  missingCount: number
  updatedVolunteerIds: number[]
  skippedVolunteerIds: number[]
  missingVolunteerIds: number[]
}

export type VolunteerBulkDeleteInput = {
  target: VolunteerBulkTarget
}

export type VolunteerBulkDeleteResponse = {
  message: string
  deletedCount: number
  missingCount: number
  deletedVolunteerIds: number[]
  missingVolunteerIds: number[]
}
