import { useQuery } from '@tanstack/react-query'
import { readQueryError } from '@lib/queryClient'
import { getMobilizationActions } from '../api/getMobilizationActions'
import { mobilizationQueryKeys } from '../queryKeys'

export function useMobilizationActions() {
  const query = useQuery({
    queryKey: mobilizationQueryKeys.actions(),
    queryFn: getMobilizationActions,
  })

  return {
    actions: query.data ?? [],
    loading: query.isPending,
    error: query.error ? readQueryError(query.error, 'Acțiunile nu au putut fi încărcate.') : null,
  }
}
