import { useMutation, useQueryClient } from '@tanstack/react-query'
import { readQueryError } from '@lib/queryClient'
import { bulkUpdateVolunteerWorkflow } from '../api/bulkUpdateVolunteerWorkflow'
import { volunteersAdminQueryKeys } from '../queryKeys'
import type {
  VolunteerWorkflowBulkUpdateInput,
  VolunteerWorkflowBulkUpdateResponse,
} from '../types'

async function mutateBulkUpdateWorkflow(
  input: VolunteerWorkflowBulkUpdateInput,
): Promise<VolunteerWorkflowBulkUpdateResponse> {
  const res = await bulkUpdateVolunteerWorkflow(input)

  if (!res.ok) {
    throw new Error(res.error.message)
  }

  return res.data
}

export function useBulkUpdateVolunteerWorkflow() {
  const queryClient = useQueryClient()
  const mutation = useMutation<VolunteerWorkflowBulkUpdateResponse, Error, VolunteerWorkflowBulkUpdateInput>({
    mutationFn: mutateBulkUpdateWorkflow,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: volunteersAdminQueryKeys.all })
    },
  })

  return {
    submit: mutation.mutateAsync,
    submitting: mutation.isPending,
    data: mutation.data ?? null,
    error: mutation.error ? readQueryError(mutation.error, 'Eroare la actualizarea bulk a voluntarilor.') : null,
    reset: mutation.reset,
  }
}
