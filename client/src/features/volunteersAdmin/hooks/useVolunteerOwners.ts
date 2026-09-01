import { useQuery } from '@tanstack/react-query'
import { readQueryError } from '@lib/queryClient'
import { getVolunteerOwners } from '../api/getVolunteerOwners'
import { volunteersAdminQueryKeys } from '../queryKeys'
import type { VolunteerOwnerOption } from '../types'

export function useVolunteerOwners() {
  const query = useQuery<VolunteerOwnerOption[]>({
    queryKey: volunteersAdminQueryKeys.owners(),
    queryFn: getVolunteerOwners,
    staleTime: 5 * 60 * 1000,
  })

  return {
    owners: query.data ?? [],
    loading: query.isPending,
    error: query.error ? readQueryError(query.error, 'Responsabilii nu au putut fi încărcați.') : null,
  }
}
