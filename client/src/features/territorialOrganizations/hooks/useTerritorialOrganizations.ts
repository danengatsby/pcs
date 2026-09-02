import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { readQueryError } from '@lib/queryClient'
import {
  createOrganization,
  createOrganizationMandate,
  createOrganizationObjective,
  getOrganizationDetail,
  getOrganizationRegistry,
  updateOrganization,
  updateOrganizationMandate,
  updateOrganizationObjective,
} from '../api/organizations'
import { territorialOrganizationQueryKeys } from '../queryKeys'
import type {
  OrganizationMandateInput,
  OrganizationObjectiveInput,
  OrganizationWriteInput,
} from '../types'

async function unwrap<T>(request: Promise<{ ok: true; data: T } | { ok: false; error: { message: string } }>): Promise<T> {
  const response = await request
  if (!response.ok) {
    throw new Error(response.error.message)
  }
  return response.data
}

export function useOrganizationRegistry() {
  const query = useQuery({
    queryKey: territorialOrganizationQueryKeys.registry(),
    queryFn: () => unwrap(getOrganizationRegistry()),
  })
  return {
    registry: query.data ?? null,
    loading: query.isPending || query.isFetching,
    error: query.error ? readQueryError(query.error, 'Registrul organizațional nu a putut fi încărcat.') : null,
    reload: () => void query.refetch(),
  }
}

export function useOrganizationDetail(id: string | null) {
  const query = useQuery({
    queryKey: territorialOrganizationQueryKeys.detail(id),
    queryFn: () => unwrap(getOrganizationDetail(id as string)),
    enabled: Boolean(id),
  })
  return {
    organization: query.data ?? null,
    loading: Boolean(id) && (query.isPending || query.isFetching),
    error: query.error ? readQueryError(query.error, 'Organizația nu a putut fi încărcată.') : null,
  }
}

type OrganizationMutation =
  | { kind: 'create-organization'; input: OrganizationWriteInput }
  | { kind: 'update-organization'; id: string; input: Partial<OrganizationWriteInput> }
  | { kind: 'create-mandate'; id: string; input: OrganizationMandateInput }
  | { kind: 'update-mandate'; id: string; childId: string; input: Partial<OrganizationMandateInput> }
  | { kind: 'create-objective'; id: string; input: OrganizationObjectiveInput }
  | { kind: 'update-objective'; id: string; childId: string; input: Partial<OrganizationObjectiveInput> }

export function useOrganizationMutations() {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (action: OrganizationMutation) => {
      if (action.kind === 'create-organization') return unwrap(createOrganization(action.input))
      if (action.kind === 'update-organization') return unwrap(updateOrganization(action.id, action.input))
      if (action.kind === 'create-mandate') return unwrap(createOrganizationMandate(action.id, action.input))
      if (action.kind === 'update-mandate') {
        return unwrap(updateOrganizationMandate(action.id, action.childId, action.input))
      }
      if (action.kind === 'create-objective') return unwrap(createOrganizationObjective(action.id, action.input))
      return unwrap(updateOrganizationObjective(action.id, action.childId, action.input))
    },
    onSuccess: async (organization) => {
      queryClient.setQueryData(territorialOrganizationQueryKeys.detail(organization.id), organization)
      await queryClient.invalidateQueries({ queryKey: territorialOrganizationQueryKeys.all })
    },
  })

  return {
    execute: mutation.mutateAsync,
    saving: mutation.isPending,
    error: mutation.error ? readQueryError(mutation.error, 'Modificarea nu a putut fi salvată.') : null,
    reset: mutation.reset,
  }
}
