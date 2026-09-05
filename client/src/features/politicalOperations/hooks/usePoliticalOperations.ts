import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { readQueryError } from '@lib/queryClient'
import {
  addPoliticalParticipant,
  createCommunicationDispatch,
  createPoliticalAction,
  getPoliticalOperations,
  previewCommunication,
  updatePoliticalAction,
  updatePoliticalParticipant,
} from '../api/politicalOperations'
import type { CommunicationAudience, CreatePoliticalActionInput, UpdatePoliticalActionInput } from '../types'

const operationsKey = ['admin', 'political-operations'] as const

async function unwrap<T>(request: Promise<{ ok: true; data: T } | { ok: false; error: { message: string } }>): Promise<T> {
  const response = await request
  if (!response.ok) throw new Error(response.error.message)
  return response.data
}

type OperationMutation =
  | { kind: 'create'; input: CreatePoliticalActionInput }
  | { kind: 'update-action'; id: string; input: UpdatePoliticalActionInput }
  | { kind: 'add-participant'; id: string; email: string; dueAt: string | null; notes: string }
  | { kind: 'update-participant'; id: string; input: { status?: string; attendanceStatus?: string } }
  | { kind: 'dispatch'; input: CommunicationAudience & { title: string; message: string; mode: 'draft' | 'send'; confirmConsentSelection: boolean } }

export function usePoliticalOperations(actionId?: string | null) {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: [...operationsKey, actionId ?? null], queryFn: () => unwrap(getPoliticalOperations(actionId)) })
  const mutation = useMutation<unknown, Error, OperationMutation>({
    mutationFn: (action: OperationMutation) => {
      if (action.kind === 'create') return unwrap(createPoliticalAction(action.input))
      if (action.kind === 'update-action') return unwrap(updatePoliticalAction(action.id, action.input))
      if (action.kind === 'add-participant') return unwrap(addPoliticalParticipant(action.id, action.email, action.dueAt, action.notes))
      if (action.kind === 'update-participant') return unwrap(updatePoliticalParticipant(action.id, action.input))
      return unwrap(createCommunicationDispatch(action.input))
    },
    onSuccess: async () => { await Promise.all([
      queryClient.invalidateQueries({ queryKey: operationsKey }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'executive-interventions'] }),
    ]) },
  })

  return {
    data: query.data ?? null,
    loading: query.isPending || query.isFetching,
    saving: mutation.isPending,
    error: query.error
      ? readQueryError(query.error, 'Operațiunile nu au putut fi încărcate.')
      : mutation.error ? readQueryError(mutation.error, 'Modificarea nu a putut fi salvată.') : null,
    reload: () => void query.refetch(),
    createAction: (input: CreatePoliticalActionInput) => mutation.mutateAsync({ kind: 'create', input }),
    updateAction: (id: string, input: UpdatePoliticalActionInput) => mutation.mutateAsync({ kind: 'update-action', id, input }),
    addParticipant: (id: string, email: string, dueAt: string | null, notes: string) => mutation.mutateAsync({ kind: 'add-participant', id, email, dueAt, notes }),
    updateParticipant: (id: string, input: { status?: string; attendanceStatus?: string }) => mutation.mutateAsync({ kind: 'update-participant', id, input }),
    preview: (audience: CommunicationAudience) => unwrap(previewCommunication(audience)),
    dispatch: (input: CommunicationAudience & { title: string; message: string; mode: 'draft' | 'send'; confirmConsentSelection: boolean }) => mutation.mutateAsync({ kind: 'dispatch', input }),
  }
}
