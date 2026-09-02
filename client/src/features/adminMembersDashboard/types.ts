import type { Role } from '@features/auth/types'

export type MembershipStatus = 'supporter' | 'application' | 'verified' | 'approved' | 'active' | 'suspended' | 'terminated'
export type MembershipAction = 'verify' | 'approve' | 'activate' | 'suspend' | 'reactivate' | 'transfer' | 'terminate'

export type MembershipOrganization = {
  id: string
  code: string
  name: string
  level: string
  status: string
}

export type MembershipEvent = {
  id: string
  action: string
  previousStatus: MembershipStatus | null
  nextStatus: MembershipStatus
  previousOrganizationId: string | null
  nextOrganizationId: string | null
  reason: string
  effectiveAt: string
  actorName: string | null
}

export type AdminMembershipRow = {
  id: string
  userId: string | null
  volunteerId: string | null
  fullName: string
  email: string
  role: Role
  membershipStatus: MembershipStatus
  memberNumber: string | null
  organization: MembershipOrganization | null
  approvalOrganization: MembershipOrganization | null
  county: string
  locality: string
  applicationAt: string
  verifiedAt: string | null
  approvedAt: string | null
  activatedAt: string | null
  approvalBody: string
  suspendedAt: string | null
  endedAt: string | null
  statusReason: string
  version: number
  createdAt: string
  updatedAt: string
  history: MembershipEvent[]
  availableActions: MembershipAction[]
}

export type AdminMembersDashboardResponse = {
  generatedAt: string
  summary: {
    total: number
    supporters: number
    applications: number
    verified: number
    approved: number
    active: number
    suspended: number
    terminated: number
    organizers: number
    unassigned: number
  }
  rows: AdminMembershipRow[]
  organizations: MembershipOrganization[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasPrevious: boolean
    hasNext: boolean
  }
  filters: {
    search: string
    status: MembershipStatus | null
    organizationId: string | null
  }
  access?: {
    capabilities: string[]
    scope: string
    national: boolean
  }
}

export type MembershipActionInput = {
  action: MembershipAction
  organizationId?: string
  approvalOrganizationId?: string
  reason?: string
  effectiveAt?: string
  expectedVersion: number
}

export type MembershipActionResponse = {
  message: string
  membership: AdminMembershipRow
}
