import { useQuery } from '@tanstack/react-query'
import { readQueryError } from '@lib/queryClient'
import { getExecutiveDashboard } from '../api/getExecutiveDashboard'
import { executiveDashboardQueryKeys } from '../queryKeys'

async function fetchExecutiveDashboard() {
  const response = await getExecutiveDashboard()
  if (!response.ok) {
    throw new Error(response.error.message)
  }
  return response.data
}

export function useExecutiveDashboard() {
  const query = useQuery({
    queryKey: executiveDashboardQueryKeys.detail(),
    queryFn: fetchExecutiveDashboard,
  })

  return {
    dashboard: query.data ?? null,
    loading: query.isPending || query.isFetching,
    error: query.error ? readQueryError(query.error, 'Tabloul de comandă nu a putut fi încărcat.') : null,
    reload: () => void query.refetch(),
  }
}
