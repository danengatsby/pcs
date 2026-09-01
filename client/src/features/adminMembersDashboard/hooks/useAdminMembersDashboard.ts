import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { readQueryError } from '@lib/queryClient'
import {
  getAdminMembersDashboard,
  type AdminMembersDashboardQuery,
} from '../api/getAdminMembersDashboard'
import { adminMembersDashboardQueryKeys } from '../queryKeys'
import type { AdminMembersDashboardResponse } from '../types'

function buildEmptyGroup(label: string) {
  return {
    label,
    count: 0,
    rows: [],
  }
}

function normalizeDashboardResponse(
  value: AdminMembersDashboardResponse | null | undefined,
  query: AdminMembersDashboardQuery,
): AdminMembersDashboardResponse {
  return {
    summary: {
      total: value?.summary?.total ?? 0,
      aderenti: value?.summary?.aderenti ?? 0,
      membri: value?.summary?.membri ?? 0,
      organizatori: value?.summary?.organizatori ?? 0,
    },
    groups: {
      aderenti: value?.groups?.aderenti ?? buildEmptyGroup('Aderenți'),
      membri: value?.groups?.membri ?? buildEmptyGroup('Membri'),
      organizatori: value?.groups?.organizatori ?? buildEmptyGroup('Organizatori'),
    },
    filters: {
      search: value?.filters?.search ?? query.search ?? '',
      limit: value?.filters?.limit ?? query.limit ?? 10,
    },
  }
}

async function fetchAdminMembersDashboard(query: AdminMembersDashboardQuery) {
  const response = await getAdminMembersDashboard(query)

  if (!response.ok) {
    throw new Error(response.error.message)
  }

  return normalizeDashboardResponse(response.data, query)
}

export function useAdminMembersDashboard(query: AdminMembersDashboardQuery) {
  const queryResult = useQuery({
    queryKey: adminMembersDashboardQueryKeys.detail(query),
    queryFn: () => fetchAdminMembersDashboard(query),
    placeholderData: keepPreviousData,
  })

  return {
    dashboard: queryResult.data ?? null,
    loading: queryResult.isPending || queryResult.isFetching,
    error: queryResult.error ? readQueryError(queryResult.error, 'Eroare la încărcarea dashboard-ului.') : null,
    reload: () => void queryResult.refetch(),
  }
}
