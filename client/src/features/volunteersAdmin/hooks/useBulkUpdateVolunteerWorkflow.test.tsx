import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { volunteersAdminQueryKeys } from '../queryKeys'
import { bulkUpdateVolunteerWorkflow } from '../api/bulkUpdateVolunteerWorkflow'
import { useBulkUpdateVolunteerWorkflow } from './useBulkUpdateVolunteerWorkflow'
import type { VolunteerWorkflowBulkUpdateInput, VolunteerWorkflowBulkUpdateResponse } from '../types'

vi.mock('../api/bulkUpdateVolunteerWorkflow', () => ({
  bulkUpdateVolunteerWorkflow: vi.fn(),
}))

describe('useBulkUpdateVolunteerWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('invalidates volunteer queries on success', async () => {
    const queryClient = createQueryClient()
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

    vi.mocked(bulkUpdateVolunteerWorkflow).mockResolvedValue({
      ok: true,
      data: buildBulkResponse(),
    })

    const { result } = renderHook(() => useBulkUpdateVolunteerWorkflow(), {
      wrapper: createWrapper(queryClient),
    })

    let response: VolunteerWorkflowBulkUpdateResponse | undefined
    await act(async () => {
      response = await result.current.submit(buildBulkInput())
    })

    expect(response).toEqual(buildBulkResponse())
    expect(bulkUpdateVolunteerWorkflow).toHaveBeenCalledWith(buildBulkInput())
    await waitFor(() => expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: volunteersAdminQueryKeys.all }))
    expect(result.current.error).toBeNull()
  })

  it('surfaces request errors and clears them on reset', async () => {
    vi.mocked(bulkUpdateVolunteerWorkflow).mockResolvedValue({
      ok: false,
      error: {
        message: 'Actualizarea bulk a eșuat.',
      },
    })

    const { result } = renderHook(() => useBulkUpdateVolunteerWorkflow(), {
      wrapper: createWrapper(createQueryClient()),
    })

    await act(async () => {
      await expect(result.current.submit(buildBulkInput())).rejects.toThrow('Actualizarea bulk a eșuat.')
    })

    await waitFor(() => expect(result.current.error).toBe('Actualizarea bulk a eșuat.'))

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

function buildBulkInput(overrides: Partial<VolunteerWorkflowBulkUpdateInput> = {}): VolunteerWorkflowBulkUpdateInput {
  return {
    target: {
      type: 'ids',
      volunteerIds: [1, 2],
    },
    status: 'activ',
    ...overrides,
  }
}

function buildBulkResponse(overrides: Partial<VolunteerWorkflowBulkUpdateResponse> = {}): VolunteerWorkflowBulkUpdateResponse {
  return {
    message: 'Workflow-ul selectat a fost actualizat.',
    updatedCount: 2,
    skippedCount: 0,
    missingCount: 0,
    updatedVolunteerIds: [1, 2],
    skippedVolunteerIds: [],
    missingVolunteerIds: [],
    ...overrides,
  }
}
