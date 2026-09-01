import { callOpenApiData, openApiClients } from '@lib/openapi'
import type { ApiResponse } from '@lib/http'
import type { AdminMembersDashboardResponse } from '../types'

export type AdminMembersDashboardQuery = {
  search?: string
  limit?: number
}

export async function getAdminMembersDashboard(
  query: AdminMembersDashboardQuery = {},
): Promise<ApiResponse<AdminMembersDashboardResponse>> {
  return callOpenApiData(() => openApiClients.adminMembers.listAdminMembersDashboard(query))
}
