import { useQuery } from '@tanstack/react-query'
import { readQueryError } from '@lib/queryClient'
import type { NewsItem } from '../types'
import { getNewsById } from '../api/getNewsById'
import { newsQueryKeys } from '../queryKeys'

export function useNewsById(id: string) {
  const query = useQuery<NewsItem>({
    queryKey: newsQueryKeys.detail(id),
    queryFn: () => getNewsById(id),
    enabled: id.trim().length > 0,
    staleTime: 60 * 1000,
  })

  return {
    item: query.data ?? null,
    loading: query.isPending,
    error: query.error ? readQueryError(query.error, 'Știrea nu a putut fi încărcată.') : null,
  }
}
