import { useMutation, useQueryClient } from '@tanstack/react-query'
import { readQueryError } from '@lib/queryClient'
import { updateExecutiveTarget } from '../api/updateExecutiveTarget'
import { executiveDashboardQueryKeys } from '../queryKeys'
import type { ExecutiveTargetKey } from '../types'

export function useUpdateExecutiveTarget() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async (input: { key: ExecutiveTargetKey; targetValue: number }) => {
      const response = await updateExecutiveTarget(input.key, input.targetValue)
      if (!response.ok) {
        throw new Error(response.error.message)
      }
      return response.data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: executiveDashboardQueryKeys.all })
    },
  })

  return {
    update: mutation.mutateAsync,
    updating: mutation.isPending,
    error: mutation.error ? readQueryError(mutation.error, 'Ținta nu a putut fi salvată.') : null,
    reset: mutation.reset,
  }
}
