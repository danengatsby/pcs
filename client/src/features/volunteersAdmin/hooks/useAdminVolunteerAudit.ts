import { useCallback } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { readQueryError } from '@lib/queryClient'
import { getAdminVolunteerAudit } from '../api/getAdminVolunteerAudit'
import { volunteersAdminQueryKeys } from '../queryKeys'
import type { VolunteerAdminAuditPage } from '../types'

export function useAdminVolunteerAudit(volunteerId: number | null) {
  const query = useInfiniteQuery({
    queryKey: volunteersAdminQueryKeys.audit(volunteerId ?? 0),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => getAdminVolunteerAudit(volunteerId as number, {
      cursor: pageParam,
    }),
    getNextPageParam: (lastPage) => lastPage.meta.nextCursor ?? undefined,
    enabled: volunteerId !== null,
  })
  const loadMore = useCallback(() => {
    if (!query.hasNextPage || query.isFetchingNextPage) {
      return
    }

    void query.fetchNextPage()
  }, [query])
  const pages: VolunteerAdminAuditPage[] = query.data?.pages ?? []
  const entries = pages.flatMap((page) => page.data)

  return {
    entries,
    loading: volunteerId !== null && query.isPending,
    loadingMore: query.isFetchingNextPage,
    canLoadMore: Boolean(query.hasNextPage),
    loadMore,
    error: query.error ? readQueryError(query.error, 'Istoricul nu a putut fi încărcat.') : null,
  }
}
