import { useInfiniteQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { readQueryError } from '@lib/queryClient'
import { listAdminVolunteers, type ListAdminVolunteersQuery } from '../api/listVolunteers'
import { volunteersAdminQueryKeys } from '../queryKeys'
import { normalizeVolunteersAdminQuery } from '../queryState'
import type { AdminVolunteersListResponse, VolunteerAdminRow } from '../types'

export type UseAdminVolunteersState = {
  loading: boolean
  loadingMore: boolean
  error: string | null
  rows: VolunteerAdminRow[]
  canLoadMore: boolean
  loadMore: () => void
  reload: () => void
}

async function fetchAdminVolunteersPage(
  query: ListAdminVolunteersQuery,
  cursor: string | null,
): Promise<AdminVolunteersListResponse> {
  const res = await listAdminVolunteers({
    ...query,
    cursor: cursor ?? undefined,
  })

  if (!res.ok) {
    throw new Error(res.error.message)
  }

  return res.data
}

export function useAdminVolunteers(query: ListAdminVolunteersQuery = {}): UseAdminVolunteersState {
  const normalizedQuery = {
    ...normalizeVolunteersAdminQuery(query),
    limit: typeof query.limit === 'number' && query.limit > 0 ? query.limit : 80,
    cursor: undefined,
  }
  const queryResult = useInfiniteQuery({
    queryKey: volunteersAdminQueryKeys.list(normalizedQuery),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchAdminVolunteersPage(normalizedQuery, pageParam),
    getNextPageParam: (lastPage) => {
      if (lastPage.meta.mode !== 'keyset' || !lastPage.meta.nextCursor) {
        return undefined
      }

      return lastPage.meta.nextCursor
    },
  })

  const reload = useCallback(() => {
    void queryResult.refetch()
  }, [queryResult])

  const loadMore = useCallback(() => {
    if (!queryResult.hasNextPage || queryResult.isFetchingNextPage) {
      return
    }

    void queryResult.fetchNextPage()
  }, [queryResult])

  const pages = queryResult.data?.pages ?? []
  const rows = pages.flatMap((page) => page.data)

  return {
    loading: queryResult.isPending || (queryResult.isFetching && !queryResult.isFetchingNextPage),
    loadingMore: queryResult.isFetchingNextPage,
    error: queryResult.error ? readQueryError(queryResult.error, 'Eroare la încărcarea voluntarilor.') : null,
    rows,
    canLoadMore: Boolean(queryResult.hasNextPage),
    loadMore,
    reload,
  }
}
