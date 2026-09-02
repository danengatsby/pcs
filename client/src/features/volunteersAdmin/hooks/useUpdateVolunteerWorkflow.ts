import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { readQueryError } from '@lib/queryClient'
import { updateVolunteerWorkflow } from '../api/updateVolunteerWorkflow'
import { volunteersAdminQueryKeys } from '../queryKeys'
import type {
  AdminVolunteersListResponse,
  VolunteerAdminRow,
  VolunteerWorkflowUpdateInput,
  VolunteerWorkflowUpdateResponse,
} from '../types'

type UpdateVolunteerWorkflowVariables = {
  volunteerId: number
  input: VolunteerWorkflowUpdateInput
}

type VolunteerWorkflowPatch = {
  fullName?: string
  email?: string
  phone?: string
  motivation?: string
  workflowStatus: VolunteerAdminRow['workflowStatus']
  internalNotes: string
  county?: string
  locality?: string
  skills?: string
  ownerUserId?: string | null
  ownerName?: string | null
  ownerEmail?: string | null
  ownerRole?: VolunteerAdminRow['ownerRole']
  followUpAt?: string | null
  reminderAt?: string | null
  lastContactAt?: string | null
  contactChannel?: VolunteerAdminRow['contactChannel']
  priority?: VolunteerAdminRow['priority']
  rejectionReason?: string | null
  tags?: string[]
  skillTags?: string[]
  statusUpdatedAt?: string | null
  statusUpdatedByUserId?: string | null
  statusUpdatedByName?: string | null
  statusUpdatedByEmail?: string | null
}

type UpdateVolunteerWorkflowContext = {
  previousDetailQueries: Array<[readonly unknown[], VolunteerAdminRow | undefined]>
  previousListQueries: Array<[readonly unknown[], InfiniteData<AdminVolunteersListResponse, string | null> | undefined]>
}

async function mutateVolunteerWorkflow({
  volunteerId,
  input,
}: UpdateVolunteerWorkflowVariables): Promise<VolunteerWorkflowUpdateResponse> {
  const res = await updateVolunteerWorkflow(volunteerId, input)

  if (!res.ok) {
    throw new Error(res.error.message)
  }

  return res.data
}

function isVolunteerListQueryKey(queryKey: readonly unknown[]): boolean {
  return queryKey.length === 3
    && queryKey[0] === volunteersAdminQueryKeys.all[0]
    && queryKey[1] === volunteersAdminQueryKeys.all[1]
    && typeof queryKey[2] === 'object'
    && queryKey[2] !== null
}

function isVolunteerDetailQueryKey(queryKey: readonly unknown[]): boolean {
  return queryKey.length === 4
    && queryKey[0] === volunteersAdminQueryKeys.all[0]
    && queryKey[1] === volunteersAdminQueryKeys.all[1]
    && queryKey[2] === 'detail'
}

function matchesVolunteerRow(row: VolunteerAdminRow, volunteerId: number): boolean {
  return row.volunteerId === volunteerId || row.id === volunteerId
}

function applyVolunteerWorkflowPatch(
  current: VolunteerAdminRow,
  patch: VolunteerWorkflowPatch,
): VolunteerAdminRow {
  return {
    ...current,
    fullName: patch.fullName ?? current.fullName,
    email: patch.email ?? current.email,
    phone: patch.phone ?? current.phone,
    motivation: patch.motivation ?? current.motivation,
    workflowStatus: patch.workflowStatus,
    internalNotes: patch.internalNotes,
    county: patch.county ?? current.county,
    locality: patch.locality ?? current.locality,
    skills: patch.skills ?? current.skills,
    ownerUserId: patch.ownerUserId !== undefined ? patch.ownerUserId : current.ownerUserId,
    ownerName: patch.ownerName !== undefined ? patch.ownerName : current.ownerName,
    ownerEmail: patch.ownerEmail !== undefined ? patch.ownerEmail : current.ownerEmail,
    ownerRole: patch.ownerRole !== undefined ? patch.ownerRole : current.ownerRole,
    followUpAt: patch.followUpAt !== undefined ? patch.followUpAt : current.followUpAt,
    reminderAt: patch.reminderAt !== undefined ? patch.reminderAt : current.reminderAt,
    lastContactAt: patch.lastContactAt !== undefined ? patch.lastContactAt : current.lastContactAt,
    contactChannel: patch.contactChannel !== undefined ? patch.contactChannel : current.contactChannel,
    priority: patch.priority !== undefined ? patch.priority : current.priority,
    rejectionReason: patch.rejectionReason !== undefined ? patch.rejectionReason : current.rejectionReason,
    tags: patch.tags ?? current.tags,
    skillTags: patch.skillTags ?? current.skillTags,
    statusUpdatedAt: patch.statusUpdatedAt !== undefined ? patch.statusUpdatedAt : current.statusUpdatedAt,
    statusUpdatedByUserId: patch.statusUpdatedByUserId !== undefined
      ? patch.statusUpdatedByUserId
      : current.statusUpdatedByUserId,
    statusUpdatedByName: patch.statusUpdatedByName !== undefined
      ? patch.statusUpdatedByName
      : current.statusUpdatedByName,
    statusUpdatedByEmail: patch.statusUpdatedByEmail !== undefined
      ? patch.statusUpdatedByEmail
      : current.statusUpdatedByEmail,
  }
}

function buildOptimisticWorkflowPatch(input: VolunteerWorkflowUpdateInput): VolunteerWorkflowPatch {
  return {
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    motivation: input.motivation,
    workflowStatus: input.status,
    internalNotes: input.internalNotes,
    county: input.county,
    locality: input.locality,
    skills: input.skills,
    ownerUserId: input.ownerUserId === undefined
      ? undefined
      : input.ownerUserId === null
        ? null
        : String(input.ownerUserId),
    ownerName: input.ownerUserId === null ? null : undefined,
    ownerEmail: input.ownerUserId === null ? null : undefined,
    ownerRole: input.ownerUserId === null ? null : undefined,
    followUpAt: input.followUpAt,
    reminderAt: input.reminderAt,
    lastContactAt: input.lastContactAt,
    contactChannel: input.contactChannel,
    priority: input.priority,
    rejectionReason: input.rejectionReason && input.rejectionReason.trim().length > 0
      ? input.rejectionReason.trim()
      : null,
    tags: input.tags,
    skillTags: input.skillTags,
    statusUpdatedAt: new Date().toISOString(),
  }
}

function buildResponseWorkflowPatch(volunteer: VolunteerAdminRow): VolunteerWorkflowPatch {
  return {
    fullName: volunteer.fullName,
    email: volunteer.email,
    phone: volunteer.phone,
    motivation: volunteer.motivation,
    workflowStatus: volunteer.workflowStatus,
    internalNotes: volunteer.internalNotes,
    county: volunteer.county,
    locality: volunteer.locality,
    skills: volunteer.skills,
    ownerUserId: volunteer.ownerUserId,
    ownerName: volunteer.ownerName,
    ownerEmail: volunteer.ownerEmail,
    ownerRole: volunteer.ownerRole,
    followUpAt: volunteer.followUpAt,
    reminderAt: volunteer.reminderAt,
    lastContactAt: volunteer.lastContactAt,
    contactChannel: volunteer.contactChannel,
    priority: volunteer.priority,
    rejectionReason: volunteer.rejectionReason,
    tags: volunteer.tags,
    skillTags: volunteer.skillTags,
    statusUpdatedAt: volunteer.statusUpdatedAt,
    statusUpdatedByUserId: volunteer.statusUpdatedByUserId,
    statusUpdatedByName: volunteer.statusUpdatedByName,
    statusUpdatedByEmail: volunteer.statusUpdatedByEmail,
  }
}

function patchVolunteerDetailCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  volunteerId: number,
  patch: VolunteerWorkflowPatch,
) {
  const detailQueries = queryClient.getQueriesData<VolunteerAdminRow>({
    queryKey: volunteersAdminQueryKeys.all,
    predicate: (query) => isVolunteerDetailQueryKey(query.queryKey),
  })

  for (const [queryKey, data] of detailQueries) {
    if (!data || !matchesVolunteerRow(data, volunteerId)) {
      continue
    }

    queryClient.setQueryData<VolunteerAdminRow>(queryKey, applyVolunteerWorkflowPatch(data, patch))
  }
}

function patchVolunteerListCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  volunteerId: number,
  patch: VolunteerWorkflowPatch,
) {
  const listQueries = queryClient.getQueriesData<InfiniteData<AdminVolunteersListResponse, string | null>>({
    queryKey: volunteersAdminQueryKeys.all,
    predicate: (query) => isVolunteerListQueryKey(query.queryKey),
  })

  for (const [queryKey, data] of listQueries) {
    if (!data) {
      continue
    }

    let didChange = false
    const nextPages = data.pages.map((page) => {
      const nextRows = page.data.map((row) => {
        if (!matchesVolunteerRow(row, volunteerId)) {
          return row
        }

        didChange = true
        return applyVolunteerWorkflowPatch(row, patch)
      })

      return didChange ? { ...page, data: nextRows } : page
    })

    if (!didChange) {
      continue
    }

    queryClient.setQueryData<InfiniteData<AdminVolunteersListResponse, string | null>>(queryKey, {
      ...data,
      pages: nextPages,
    })
  }
}

export function useUpdateVolunteerWorkflow() {
  const queryClient = useQueryClient()
  const mutation = useMutation<VolunteerWorkflowUpdateResponse, Error, UpdateVolunteerWorkflowVariables, UpdateVolunteerWorkflowContext>({
    mutationFn: mutateVolunteerWorkflow,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: volunteersAdminQueryKeys.all })

      const previousDetailQueries = queryClient.getQueriesData<VolunteerAdminRow>({
        queryKey: volunteersAdminQueryKeys.all,
        predicate: (query) => isVolunteerDetailQueryKey(query.queryKey),
      })
      const previousListQueries = queryClient.getQueriesData<InfiniteData<AdminVolunteersListResponse, string | null>>({
        queryKey: volunteersAdminQueryKeys.all,
        predicate: (query) => isVolunteerListQueryKey(query.queryKey),
      })
      const optimisticPatch = buildOptimisticWorkflowPatch(variables.input)

      patchVolunteerDetailCaches(queryClient, variables.volunteerId, optimisticPatch)
      patchVolunteerListCaches(queryClient, variables.volunteerId, optimisticPatch)

      return {
        previousDetailQueries,
        previousListQueries,
      }
    },
    onError: (_error, _variables, context) => {
      if (!context) {
        return
      }

      for (const [queryKey, data] of context.previousDetailQueries) {
        queryClient.setQueryData(queryKey, data)
      }

      for (const [queryKey, data] of context.previousListQueries) {
        queryClient.setQueryData(queryKey, data)
      }
    },
    onSuccess: async (response, variables) => {
      const responsePatch = buildResponseWorkflowPatch(response.volunteer)

      patchVolunteerDetailCaches(queryClient, variables.volunteerId, responsePatch)
      patchVolunteerListCaches(queryClient, variables.volunteerId, responsePatch)
      await queryClient.invalidateQueries({ queryKey: volunteersAdminQueryKeys.audit(variables.volunteerId) })
    },
  })

  return {
    submit: mutation.mutateAsync,
    submitting: mutation.isPending,
    error: mutation.error ? readQueryError(mutation.error, 'Eroare la actualizarea voluntarului.') : null,
    reset: mutation.reset,
  }
}
