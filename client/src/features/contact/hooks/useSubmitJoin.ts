import { useMutation } from '@tanstack/react-query'
import { readQueryError } from '@lib/queryClient'
import {
  submitJoin,
  type SubmitJoinRequest,
  type SubmitJoinResponse,
} from '../api/submitJoin'

export function useSubmitJoin() {
  const mutation = useMutation<SubmitJoinResponse, Error, SubmitJoinRequest>({
    mutationFn: submitJoin,
  })

  return {
    submit: mutation.mutateAsync,
    submitting: mutation.isPending,
    error: mutation.error ? readQueryError(mutation.error, 'Eroare la trimiterea cererii.') : null,
    reset: mutation.reset,
  }
}
