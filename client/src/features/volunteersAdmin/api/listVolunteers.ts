import { apiGetEnvelope, type ApiResponse } from '@lib/http'
import type {
  AdminVolunteersListMeta,
  AdminVolunteersListResponse,
  VolunteerAdminFilters,
  VolunteerAdminRow,
} from '../types'
import { readAdminVolunteersListMeta, readVolunteerAdminRows } from './readVolunteerAdminRow'

export type ListAdminVolunteersQuery = VolunteerAdminFilters & {
  limit?: number
  cursor?: string
}

export async function listAdminVolunteers(
  query: ListAdminVolunteersQuery = {},
): Promise<ApiResponse<AdminVolunteersListResponse>> {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue
    params.set(k, String(v))
  }

  const qs = params.toString()
  const url = qs ? `/api/admin/volunteers?${qs}` : '/api/admin/volunteers'

  const res = await apiGetEnvelope<VolunteerAdminRow[], AdminVolunteersListMeta>(url, {
    auth: true,
    parseData: readVolunteerAdminRows,
    parseMeta: readAdminVolunteersListMeta,
  })

  if (!res.ok) {
    return res
  }

  return {
    ok: true,
    data: {
      data: res.data,
      meta: res.meta ?? buildDefaultMeta(query),
    },
  }
}

function buildDefaultMeta(query: ListAdminVolunteersQuery): AdminVolunteersListMeta {
  return {
    mode: 'keyset',
    count: 0,
    limit: query.limit ?? 50,
    nextCursor: null,
  }
}
