import { useQuery } from '@tanstack/react-query'
import { readQueryError } from '@lib/queryClient'
import { getPublicOrganizations } from '../api/getPublicOrganizations'
import { contactQueryKeys } from '../queryKeys'

export function usePublicOrganizations() {
  const query = useQuery({
    queryKey: contactQueryKeys.organizations(),
    queryFn: async () => {
      const response = await getPublicOrganizations()
      if (!response.ok) {
        throw new Error(response.error.message)
      }
      return response.data
    },
    staleTime: 5 * 60 * 1000,
  })

  return {
    organizations: query.data ?? [],
    loading: query.isPending,
    error: query.error
      ? readQueryError(query.error, 'Organizațiile teritoriale nu au putut fi încărcate.')
      : null,
  }
}
