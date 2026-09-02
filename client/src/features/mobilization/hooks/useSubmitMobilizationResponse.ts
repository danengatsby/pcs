import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submitMobilizationResponse } from '../api/submitMobilizationResponse'
import { mobilizationQueryKeys } from '../queryKeys'
import type { MobilizationResponseRequest } from '../types'

export function useSubmitMobilizationResponse() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ slug, payload }: { slug: string; payload: MobilizationResponseRequest }) => (
      submitMobilizationResponse(slug, payload)
    ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mobilizationQueryKeys.actions() }),
  })

  return {
    submit: mutation.mutateAsync,
    submitting: mutation.isPending,
    reset: mutation.reset,
  }
}
