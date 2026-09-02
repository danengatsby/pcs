import { apiGet, apiPost, type ApiResponse } from '@lib/http'
import type {
  AdminMembersDashboardResponse,
  MembershipActionInput,
  MembershipActionResponse,
  MembershipStatus,
} from '../types'

export type AdminMembersDashboardQuery = {
  search?: string
  status?: MembershipStatus
  organizationId?: string
  limit?: number
  offset?: number
}

export function getAdminMembersDashboard(
  query: AdminMembersDashboardQuery = {},
): Promise<ApiResponse<AdminMembersDashboardResponse>> {
  const params = new URLSearchParams()
  if (query.search?.trim()) params.set('search', query.search.trim())
  if (query.status) params.set('status', query.status)
  if (query.organizationId) params.set('organizationId', query.organizationId)
  if (query.limit !== undefined) params.set('limit', String(query.limit))
  if (query.offset !== undefined) params.set('offset', String(query.offset))
  const suffix = params.size > 0 ? `?${params.toString()}` : ''
  return apiGet<AdminMembersDashboardResponse>(`/api/admin/members/dashboard${suffix}`, { auth: true })
}

export function applyMembershipAction(
  membershipId: string,
  input: MembershipActionInput,
): Promise<ApiResponse<MembershipActionResponse>> {
  return apiPost<MembershipActionResponse>(
    `/api/admin/members/${encodeURIComponent(membershipId)}/actions`,
    input,
    { auth: true },
  )
}
