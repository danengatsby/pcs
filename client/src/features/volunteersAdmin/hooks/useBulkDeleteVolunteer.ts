import { useMutation, useQueryClient } from '@tanstack/react-query'
import { readQueryError } from '@lib/queryClient'
import { bulkDeleteVolunteer } from '../api/bulkDeleteVolunteer'
import { volunteersAdminQueryKeys } from '../queryKeys'
import type {
  VolunteerBulkDeleteInput,
  VolunteerBulkDeleteResponse,
} from '../types'

async function mutateBulkDeleteVolunteer(
  input: VolunteerBulkDeleteInput,
): Promise<VolunteerBulkDeleteResponse> {
  const res = await bulkDeleteVolunteer(input)

  if (!res.ok) {
    throw new Error(res.error.message)
  }

  return res.data
}

export function useBulkDeleteVolunteer() {
  const queryClient = useQueryClient()
  const mutation = useMutation<VolunteerBulkDeleteResponse, Error, VolunteerBulkDeleteInput>({
    mutationFn: mutateBulkDeleteVolunteer,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: volunteersAdminQueryKeys.all })
    },
  })

  return {
    submit: mutation.mutateAsync,
    submitting: mutation.isPending,
    data: mutation.data ?? null,
    error: mutation.error ? readQueryError(mutation.error, 'Eroare la ștergerea bulk a voluntarilor.') : null,
    reset: mutation.reset,
  }
}
