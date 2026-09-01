import { useQuery } from '@tanstack/react-query'
import { readQueryError } from '@lib/queryClient'
import { getAdminVolunteerById } from '../api/getAdminVolunteerById'
import { volunteersAdminQueryKeys } from '../queryKeys'
import type { VolunteerAdminRow } from '../types'

export function useAdminVolunteerDetails(id: number | null, initialVolunteer: VolunteerAdminRow | null = null) {
  const query = useQuery<VolunteerAdminRow>({
    queryKey: volunteersAdminQueryKeys.detail(id ?? 0),
    queryFn: () => getAdminVolunteerById(id as number),
    enabled: id !== null,
    initialData: initialVolunteer ?? undefined,
  })

  return {
    volunteer: query.data ?? null,
    loading: id !== null && query.isPending,
    error: query.error ? readQueryError(query.error, 'Voluntarul nu a putut fi încărcat.') : null,
  }
}
