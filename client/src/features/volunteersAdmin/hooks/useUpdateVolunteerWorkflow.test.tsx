import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { volunteersAdminQueryKeys } from '../queryKeys'
import { updateVolunteerWorkflow } from '../api/updateVolunteerWorkflow'
import { useUpdateVolunteerWorkflow } from './useUpdateVolunteerWorkflow'
import type {
  AdminVolunteersListResponse,
  VolunteerAdminRow,
  VolunteerWorkflowUpdateInput,
  VolunteerWorkflowUpdateResponse,
} from '../types'

vi.mock('../api/updateVolunteerWorkflow', () => ({
  updateVolunteerWorkflow: vi.fn(),
}))

describe('useUpdateVolunteerWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('optimistically patches detail and list queries and preserves combined row fields on success', async () => {
    const queryClient = createQueryClient()
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    const detailKey = volunteersAdminQueryKeys.detail(1)
    const listKey = volunteersAdminQueryKeys.list({ limit: 50 })
    const cachedVolunteer = buildVolunteer({
      accountRole: 'MEMBRU',
      recordSource: 'both',
      workflowStatus: 'nou',
      internalNotes: 'Necesită follow-up',
      statusUpdatedAt: null,
      statusUpdatedByUserId: null,
      statusUpdatedByName: null,
      statusUpdatedByEmail: null,
    })

    queryClient.setQueryData(detailKey, cachedVolunteer)
    queryClient.setQueryData(listKey, buildInfiniteListData([cachedVolunteer]))

    let resolveMutation:
      | ((value: Awaited<ReturnType<typeof updateVolunteerWorkflow>>) => void)
      | undefined
    vi.mocked(updateVolunteerWorkflow).mockImplementation(
      () => new Promise((resolve) => {
        resolveMutation = resolve
      }),
    )

    const { result } = renderHook(() => useUpdateVolunteerWorkflow(), {
      wrapper: createWrapper(queryClient),
    })

    let response: VolunteerWorkflowUpdateResponse | undefined
    let mutationPromise: Promise<VolunteerWorkflowUpdateResponse> | undefined
    await act(async () => {
      mutationPromise = result.current.submit({
        volunteerId: 1,
        input: buildWorkflowInput({
          county: 'Bihor',
          locality: 'Oradea',
          skills: 'juridic',
          ownerUserId: 12,
          followUpAt: '2026-04-05T08:30:00.000Z',
          reminderAt: '2026-04-04T18:00:00.000Z',
          priority: 'ridicata',
          tags: ['student', 'organizator'],
          skillTags: ['door-to-door', 'fundraising'],
        }),
      })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(queryClient.getQueryData<VolunteerAdminRow>(detailKey)).toMatchObject({
        workflowStatus: 'activ',
        internalNotes: 'Voluntar confirmat.',
        county: 'Bihor',
        locality: 'Oradea',
        skills: 'juridic',
        ownerUserId: '12',
        followUpAt: '2026-04-05T08:30:00.000Z',
        reminderAt: '2026-04-04T18:00:00.000Z',
        priority: 'ridicata',
        tags: ['student', 'organizator'],
        skillTags: ['door-to-door', 'fundraising'],
      })
    })

    expect(queryClient.getQueryData<VolunteerAdminRow>(detailKey)).toMatchObject({
      accountRole: 'MEMBRU',
      recordSource: 'both',
    })
    expect(readFirstListRow(queryClient, listKey)).toMatchObject({
      workflowStatus: 'activ',
      county: 'Bihor',
      ownerUserId: '12',
      accountRole: 'MEMBRU',
      recordSource: 'both',
    })

    resolveMutation?.({
      ok: true,
      data: buildWorkflowResponse({
        volunteer: buildVolunteer({
          workflowStatus: 'activ',
          internalNotes: 'Voluntar confirmat.',
          county: 'Bihor',
          locality: 'Oradea',
          skills: 'juridic',
          ownerUserId: '12',
          ownerName: 'Admin Test',
          ownerEmail: 'admin@example.test',
          ownerRole: 'PRESEDINTE',
          followUpAt: '2026-04-05T08:30:00.000Z',
          reminderAt: '2026-04-04T18:00:00.000Z',
          priority: 'ridicata',
          tags: ['student', 'organizator'],
          skillTags: ['door-to-door', 'fundraising'],
          statusUpdatedAt: '2026-04-02T11:00:00.000Z',
          statusUpdatedByUserId: '11',
          statusUpdatedByName: 'Admin Test',
          statusUpdatedByEmail: 'admin@example.test',
          accountRole: null,
          recordSource: 'volunteer',
        }),
      }),
    })

    await act(async () => {
      response = await mutationPromise
    })

    expect(response).toEqual(buildWorkflowResponse({
      volunteer: buildVolunteer({
        workflowStatus: 'activ',
        internalNotes: 'Voluntar confirmat.',
        county: 'Bihor',
        locality: 'Oradea',
        skills: 'juridic',
        ownerUserId: '12',
        ownerName: 'Admin Test',
        ownerEmail: 'admin@example.test',
        ownerRole: 'PRESEDINTE',
        followUpAt: '2026-04-05T08:30:00.000Z',
        reminderAt: '2026-04-04T18:00:00.000Z',
        priority: 'ridicata',
        tags: ['student', 'organizator'],
        skillTags: ['door-to-door', 'fundraising'],
        statusUpdatedAt: '2026-04-02T11:00:00.000Z',
        statusUpdatedByUserId: '11',
        statusUpdatedByName: 'Admin Test',
        statusUpdatedByEmail: 'admin@example.test',
        accountRole: null,
        recordSource: 'volunteer',
      }),
    }))
    expect(updateVolunteerWorkflow).toHaveBeenCalledWith(1, buildWorkflowInput({
      county: 'Bihor',
      locality: 'Oradea',
      skills: 'juridic',
      ownerUserId: 12,
      followUpAt: '2026-04-05T08:30:00.000Z',
      reminderAt: '2026-04-04T18:00:00.000Z',
      priority: 'ridicata',
      tags: ['student', 'organizator'],
      skillTags: ['door-to-door', 'fundraising'],
    }))
    expect(queryClient.getQueryData<VolunteerAdminRow>(detailKey)).toMatchObject({
      workflowStatus: 'activ',
      statusUpdatedByName: 'Admin Test',
      ownerEmail: 'admin@example.test',
      accountRole: 'MEMBRU',
      recordSource: 'both',
    })
    expect(readFirstListRow(queryClient, listKey)).toMatchObject({
      workflowStatus: 'activ',
      statusUpdatedByEmail: 'admin@example.test',
      accountRole: 'MEMBRU',
      recordSource: 'both',
    })
    await waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: volunteersAdminQueryKeys.audit(1) }))
    expect(result.current.error).toBeNull()
    expect(result.current.submitting).toBe(false)
  })

  it('rolls back optimistic cache patches when the mutation fails', async () => {
    const queryClient = createQueryClient()
    const detailKey = volunteersAdminQueryKeys.detail(1)
    const listKey = volunteersAdminQueryKeys.list({ limit: 50 })
    const initialVolunteer = buildVolunteer({
      accountRole: 'MEMBRU',
      recordSource: 'both',
      workflowStatus: 'nou',
      internalNotes: 'Necesită follow-up',
      statusUpdatedAt: null,
    })

    queryClient.setQueryData(detailKey, initialVolunteer)
    queryClient.setQueryData(listKey, buildInfiniteListData([initialVolunteer]))

    let resolveMutation:
      | ((value: Awaited<ReturnType<typeof updateVolunteerWorkflow>>) => void)
      | undefined
    vi.mocked(updateVolunteerWorkflow).mockImplementation(
      () => new Promise((resolve) => {
        resolveMutation = resolve
      }),
    )

    const { result } = renderHook(() => useUpdateVolunteerWorkflow(), {
      wrapper: createWrapper(queryClient),
    })

    let mutationPromise: Promise<VolunteerWorkflowUpdateResponse> | undefined
    await act(async () => {
      mutationPromise = result.current.submit({
        volunteerId: 1,
        input: buildWorkflowInput({
          county: 'Bihor',
          locality: 'Oradea',
          skills: 'juridic',
          ownerUserId: 12,
        }),
      })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(queryClient.getQueryData<VolunteerAdminRow>(detailKey)).toMatchObject({
        workflowStatus: 'activ',
        county: 'Bihor',
      })
    })

    resolveMutation?.({
      ok: false,
      error: {
        message: 'Actualizarea a eșuat.',
      },
    })

    await act(async () => {
      await expect(mutationPromise).rejects.toThrow('Actualizarea a eșuat.')
    })

    await waitFor(() => expect(result.current.error).toBe('Actualizarea a eșuat.'))
    expect(queryClient.getQueryData<VolunteerAdminRow>(detailKey)).toEqual(initialVolunteer)
    expect(readFirstListRow(queryClient, listKey)).toEqual(initialVolunteer)

    act(() => {
      result.current.reset()
    })

    await waitFor(() => expect(result.current.error).toBeNull())
  })
})

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function buildWorkflowInput(overrides: Partial<VolunteerWorkflowUpdateInput> = {}): VolunteerWorkflowUpdateInput {
  return {
    status: 'activ',
    internalNotes: 'Voluntar confirmat.',
    county: 'Cluj',
    locality: 'Cluj-Napoca',
    skills: 'organizare',
    ownerUserId: null,
    followUpAt: null,
    reminderAt: null,
    lastContactAt: null,
    contactChannel: null,
    priority: 'medie',
    rejectionReason: '',
    tags: [],
    skillTags: [],
    ...overrides,
  }
}

function buildWorkflowResponse(overrides: Partial<VolunteerWorkflowUpdateResponse> = {}): VolunteerWorkflowUpdateResponse {
  return {
    message: 'Voluntar actualizat.',
    volunteer: buildVolunteer({
      workflowStatus: 'activ',
      internalNotes: 'Voluntar confirmat.',
      statusUpdatedAt: '2026-04-02T11:00:00.000Z',
      statusUpdatedByUserId: '11',
      statusUpdatedByName: 'Admin Test',
      statusUpdatedByEmail: 'admin@example.test',
      ownerUserId: '12',
      ownerName: 'Admin Test',
      ownerEmail: 'admin@example.test',
      ownerRole: 'PRESEDINTE',
      followUpAt: '2026-04-05T08:30:00.000Z',
      reminderAt: '2026-04-04T18:00:00.000Z',
      lastContactAt: null,
      contactChannel: null,
      priority: 'ridicata',
      rejectionReason: null,
      tags: ['student', 'organizator'],
      skillTags: ['door-to-door', 'fundraising'],
      accountRole: null,
      recordSource: 'volunteer',
    }),
    ...overrides,
  }
}

function buildVolunteer(overrides: Partial<VolunteerAdminRow> = {}): VolunteerAdminRow {
  return {
    id: 1,
    volunteerId: 1,
    fullName: 'Ana Pop',
    email: 'ana@example.test',
    phone: '0712345678',
    county: 'Cluj',
    locality: 'Cluj-Napoca',
    skills: 'organizare',
    motivation: 'Vreau sa ajut.',
    workflowStatus: 'nou',
    internalNotes: 'Necesită follow-up',
    createdAt: '2026-04-02T10:00:00.000Z',
    statusUpdatedAt: null,
    statusUpdatedByUserId: null,
    statusUpdatedByName: null,
    statusUpdatedByEmail: null,
    ownerUserId: null,
    ownerName: null,
    ownerEmail: null,
    ownerRole: null,
    followUpAt: null,
    reminderAt: null,
    lastContactAt: null,
    contactChannel: null,
    priority: 'medie',
    rejectionReason: null,
    tags: [],
    skillTags: [],
    accountRole: null,
    recordSource: 'volunteer',
    ...overrides,
  }
}

function buildInfiniteListData(
  rows: VolunteerAdminRow[],
): InfiniteData<AdminVolunteersListResponse, string | null> {
  return {
    pages: [
      {
        data: rows,
        meta: {
          mode: 'keyset',
          count: rows.length,
          limit: 50,
          nextCursor: null,
        },
      },
    ],
    pageParams: [null],
  }
}

function readFirstListRow(
  queryClient: QueryClient,
  queryKey: ReturnType<typeof volunteersAdminQueryKeys.list>,
): VolunteerAdminRow | undefined {
  return queryClient.getQueryData<InfiniteData<AdminVolunteersListResponse, string | null>>(queryKey)?.pages[0]?.data[0]
}
