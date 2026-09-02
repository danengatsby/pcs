import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { readQueryError } from '@lib/queryClient'
import {
  getMemberPortal,
  reportMemberTask,
  respondToMemberEvent,
  updateMemberConsent,
} from '../api/memberPortal'
import type { MemberConsentInput } from '../types'

const portalKey = ['member-portal'] as const

async function unwrap<T>(request: Promise<{ ok: true; data: T } | { ok: false; error: { message: string } }>): Promise<T> {
  const response = await request
  if (!response.ok) throw new Error(response.error.message)
  return response.data
}

type PortalMutation =
  | { kind: 'event'; actionId: string; response: 'confirmed' | 'declined' }
  | { kind: 'task'; participantId: string; input: { status: 'in_progress' | 'reported'; report: string; result: string; hours: number } }
  | { kind: 'consent'; input: MemberConsentInput }

export function useMemberPortal() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: portalKey, queryFn: () => unwrap(getMemberPortal()) })
  const mutation = useMutation<unknown, Error, PortalMutation>({
    mutationFn: (action: PortalMutation) => {
      if (action.kind === 'event') return unwrap(respondToMemberEvent(action.actionId, action.response))
      if (action.kind === 'task') return unwrap(reportMemberTask(action.participantId, action.input))
      return unwrap(updateMemberConsent(action.input))
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: portalKey }) },
  })

  return {
    portal: query.data ?? null,
    loading: query.isPending || query.isFetching,
    saving: mutation.isPending,
    error: query.error
      ? readQueryError(query.error, 'Portalul nu a putut fi încărcat.')
      : mutation.error ? readQueryError(mutation.error, 'Modificarea nu a putut fi salvată.') : null,
    reload: () => void query.refetch(),
    respondEvent: async (actionId: string, response: 'confirmed' | 'declined') => { await mutation.mutateAsync({ kind: 'event', actionId, response }) },
    reportTask: async (participantId: string, input: { status: 'in_progress' | 'reported'; report: string; result: string; hours: number }) => { await mutation.mutateAsync({ kind: 'task', participantId, input }) },
    saveConsent: async (input: MemberConsentInput) => { await mutation.mutateAsync({ kind: 'consent', input }) },
  }
}
