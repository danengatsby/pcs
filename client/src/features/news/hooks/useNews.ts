import { useQuery } from '@tanstack/react-query'
import { readQueryError } from '@lib/queryClient'
import type { NewsItem } from '../types'
import { getNews } from '../api/getNews'
import { newsQueryKeys } from '../queryKeys'

export function useNews() {
  const query = useQuery<NewsItem[]>({
    queryKey: newsQueryKeys.list(),
    queryFn: getNews,
    staleTime: 60 * 1000,
  })

  return {
    items: query.data ?? [],
    loading: query.isPending,
    error: query.error ? readQueryError(query.error, 'Eroare necunoscută') : null,
  }
}
