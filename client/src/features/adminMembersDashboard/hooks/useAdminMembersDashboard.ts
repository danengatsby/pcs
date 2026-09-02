import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { readQueryError } from '@lib/queryClient'
import {
  applyMembershipAction,
  getAdminMembersDashboard,
  type AdminMembersDashboardQuery,
} from '../api/getAdminMembersDashboard'
import { adminMembersDashboardQueryKeys } from '../queryKeys'
import type { MembershipActionInput } from '../types'

async function fetchAdminMembersDashboard(query: AdminMembersDashboardQuery) {
  const response = await getAdminMembersDashboard(query)
  if (!response.ok) throw new Error(response.error.message)
  return response.data
}

export function useAdminMembersDashboard(query: AdminMembersDashboardQuery) {
  const queryResult = useQuery({
    queryKey: adminMembersDashboardQueryKeys.detail(query),
    queryFn: () => fetchAdminMembersDashboard(query),
    placeholderData: keepPreviousData,
  })

  return {
    dashboard: queryResult.data ?? null,
    loading: queryResult.isPending || queryResult.isFetching,
    error: queryResult.error ? readQueryError(queryResult.error, 'Eroare la încărcarea registrului de membri.') : null,
    reload: () => void queryResult.refetch(),
  }
}

export function useMembershipAction() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (input: { membershipId: string; payload: MembershipActionInput }) => {
      const response = await applyMembershipAction(input.membershipId, input.payload)
      if (!response.ok) throw new Error(response.error.message)
      return response.data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: adminMembersDashboardQueryKeys.all })
    },
  })

  return {
    execute: mutation.mutateAsync,
    saving: mutation.isPending,
    error: mutation.error ? readQueryError(mutation.error, 'Decizia nu a putut fi înregistrată.') : null,
    reset: mutation.reset,
  }
}
