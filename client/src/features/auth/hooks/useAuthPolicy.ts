import { useQuery } from '@tanstack/react-query'
import { getAuthPolicy } from '../api/getAuthPolicy'
import { authQueryKeys } from '../queryKeys'
import { readQueryError } from '@lib/queryClient'

export function useAuthPolicy() {
  const query = useQuery({
    queryKey: authQueryKeys.policy(),
    queryFn: getAuthPolicy,
    staleTime: 5 * 60 * 1000,
  })

  return {
    data: query.data ?? null,
    loading: query.isPending,
    error: query.error ? readQueryError(query.error, 'Eroare necunoscută') : null,
  }
}
