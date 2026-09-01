import { useQuery } from '@tanstack/react-query'
import { readQueryError } from '@lib/queryClient'
import { getCounties, type CountyName } from '../api/getCounties'
import { contactQueryKeys } from '../queryKeys'

export type UseCountiesState = {
  loading: boolean
  error: string | null
  counties: CountyName[]
}

export function useCounties(): UseCountiesState {
  const query = useQuery({
    queryKey: contactQueryKeys.counties(),
    queryFn: getCounties,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  })

  return {
    loading: query.isPending,
    error: query.error ? readQueryError(query.error, 'Eroare la încărcarea județelor.') : null,
    counties: query.data ?? [],
  }
}
