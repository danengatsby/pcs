import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { volunteersAdminQueryKeys } from '../queryKeys'
import { bulkDeleteVolunteer } from '../api/bulkDeleteVolunteer'
import { useBulkDeleteVolunteer } from './useBulkDeleteVolunteer'
import type { VolunteerBulkDeleteInput, VolunteerBulkDeleteResponse } from '../types'

vi.mock('../api/bulkDeleteVolunteer', () => ({
  bulkDeleteVolunteer: vi.fn(),
}))

describe('useBulkDeleteVolunteer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('invalidates volunteer queries on success', async () => {
    const queryClient = createQueryClient()
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

    vi.mocked(bulkDeleteVolunteer).mockResolvedValue({
      ok: true,
      data: buildBulkDeleteResponse(),
    })

    const { result } = renderHook(() => useBulkDeleteVolunteer(), {
      wrapper: createWrapper(queryClient),
    })

    let response: VolunteerBulkDeleteResponse | undefined
    await act(async () => {
      response = await result.current.submit(buildBulkDeleteInput())
    })

    expect(response).toEqual(buildBulkDeleteResponse())
    expect(bulkDeleteVolunteer).toHaveBeenCalledWith(buildBulkDeleteInput())
    await waitFor(() => expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: volunteersAdminQueryKeys.all }))
    expect(result.current.error).toBeNull()
  })

  it('surfaces request errors and clears them on reset', async () => {
    vi.mocked(bulkDeleteVolunteer).mockResolvedValue({
      ok: false,
      error: {
        message: 'Ștergerea bulk a eșuat.',
      },
    })

    const { result } = renderHook(() => useBulkDeleteVolunteer(), {
      wrapper: createWrapper(createQueryClient()),
    })

    await act(async () => {
      await expect(result.current.submit(buildBulkDeleteInput())).rejects.toThrow('Ștergerea bulk a eșuat.')
    })

    await waitFor(() => expect(result.current.error).toBe('Ștergerea bulk a eșuat.'))

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

function buildBulkDeleteInput(overrides: Partial<VolunteerBulkDeleteInput> = {}): VolunteerBulkDeleteInput {
  return {
    target: {
      type: 'ids',
      volunteerIds: [1, 2],
    },
    ...overrides,
  }
}

function buildBulkDeleteResponse(overrides: Partial<VolunteerBulkDeleteResponse> = {}): VolunteerBulkDeleteResponse {
  return {
    message: 'Formularele de voluntar selectate au fost șterse.',
    deletedCount: 2,
    missingCount: 0,
    deletedVolunteerIds: [1, 2],
    missingVolunteerIds: [],
    ...overrides,
  }
}
