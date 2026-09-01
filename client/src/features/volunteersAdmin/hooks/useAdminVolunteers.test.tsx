import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listAdminVolunteers } from '../api/listVolunteers'
import { useAdminVolunteers } from './useAdminVolunteers'
import type { AdminVolunteersListResponse, VolunteerAdminRow } from '../types'

vi.mock('../api/listVolunteers', () => ({
  listAdminVolunteers: vi.fn(),
}))

describe('useAdminVolunteers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads rows from the first keyset page', async () => {
    vi.mocked(listAdminVolunteers).mockResolvedValue({
      ok: true,
      data: buildListResponse(),
    })

    const { result } = renderHook(() => useAdminVolunteers(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(listAdminVolunteers).toHaveBeenCalledWith({ limit: 80, cursor: undefined })
    expect(result.current.rows).toEqual([buildVolunteerRow()])
    expect(result.current.canLoadMore).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('reloads using the latest controlled filters', async () => {
    vi.mocked(listAdminVolunteers)
      .mockResolvedValueOnce({
        ok: true,
        data: buildListResponse(),
      })
      .mockResolvedValue({
        ok: true,
        data: buildListResponse({
          meta: {
            mode: 'keyset',
            count: 1,
            limit: 80,
            nextCursor: null,
          },
        }),
      })

    const initialProps: { query: { limit: number; search?: string } } = {
      query: { limit: 80 },
    }

    const { result, rerender } = renderHook(
      ({ query }: { query: { limit: number; search?: string } }) => useAdminVolunteers(query),
      {
        initialProps,
        wrapper: createWrapper(),
      },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    rerender({ query: { limit: 80, search: 'ana' } })

    await waitFor(() =>
      expect(listAdminVolunteers).toHaveBeenLastCalledWith({
        limit: 80,
        cursor: undefined,
        search: 'ana',
      }))

    await act(async () => {
      result.current.reload()
    })

    await waitFor(() => expect(listAdminVolunteers).toHaveBeenCalledTimes(3))
    expect(listAdminVolunteers).toHaveBeenLastCalledWith({
      limit: 80,
      cursor: undefined,
      search: 'ana',
    })
  })

  it('normalizes an invalid controlled query before fetching', async () => {
    vi.mocked(listAdminVolunteers).mockResolvedValue({
      ok: true,
      data: buildListResponse(),
    })

    renderHook(() => useAdminVolunteers({
      limit: 0,
      search: '   ',
      status: 'invalid-status',
    }), {
      wrapper: createWrapper(),
    })

    await waitFor(() =>
      expect(listAdminVolunteers).toHaveBeenCalledWith(expect.objectContaining({ limit: 80 })))
  })

  it('loads the next page when a cursor is available', async () => {
    vi.mocked(listAdminVolunteers)
      .mockResolvedValueOnce({
        ok: true,
        data: buildListResponse({
          meta: {
            mode: 'keyset',
            count: 1,
            limit: 80,
            nextCursor: 'cursor-2',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        data: buildListResponse({
          data: [buildVolunteerRow({ id: 2, volunteerId: 2, fullName: 'Mihai Ionescu', email: 'mihai@example.test' })],
          meta: {
            mode: 'keyset',
            count: 1,
            limit: 80,
            nextCursor: null,
          },
        }),
      })

    const { result } = renderHook(() => useAdminVolunteers(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.rows).toEqual([buildVolunteerRow()])
    expect(result.current.canLoadMore).toBe(true)

    await act(async () => {
      result.current.loadMore()
    })

    await waitFor(() => expect(listAdminVolunteers).toHaveBeenLastCalledWith({
      limit: 80,
      cursor: 'cursor-2',
    }))

    await waitFor(() => expect(result.current.rows).toHaveLength(2))
    expect(result.current.rows[1]).toEqual(expect.objectContaining({ id: 2, fullName: 'Mihai Ionescu' }))
    expect(result.current.canLoadMore).toBe(false)
  })

  it('surfaces request errors in hook state', async () => {
    vi.mocked(listAdminVolunteers).mockResolvedValue({
      ok: false,
      error: {
        message: 'Nu s-au putut încărca voluntarii.',
      },
    })

    const { result } = renderHook(() => useAdminVolunteers(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.rows).toEqual([])
    expect(result.current.canLoadMore).toBe(false)
    expect(result.current.error).toBe('Nu s-au putut încărca voluntarii.')
  })
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function buildVolunteerRow(overrides: Partial<VolunteerAdminRow> = {}): VolunteerAdminRow {
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
    internalNotes: '',
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

function buildListResponse(overrides: Partial<AdminVolunteersListResponse> = {}): AdminVolunteersListResponse {
  return {
    data: [buildVolunteerRow()],
    meta: {
      mode: 'keyset',
      count: 1,
      limit: 80,
      nextCursor: null,
    },
    ...overrides,
  }
}
