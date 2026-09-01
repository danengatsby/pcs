import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAdminMembersDashboard } from '../api/getAdminMembersDashboard'
import { useAdminMembersDashboard } from './useAdminMembersDashboard'
import type { AdminDashboardMember, AdminMembersDashboardResponse } from '../types'

vi.mock('../api/getAdminMembersDashboard', () => ({
  getAdminMembersDashboard: vi.fn(),
}))

describe('useAdminMembersDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('normalizes missing dashboard sections from the response', async () => {
    vi.mocked(getAdminMembersDashboard).mockResolvedValue({
      ok: true,
      data: {
        summary: {
          total: 1,
          aderenti: 1,
          membri: 0,
          organizatori: 0,
        },
        groups: {
          aderenti: {
            label: 'Aderenți',
            count: 1,
            rows: [buildMember()],
          },
        },
      } as unknown as AdminMembersDashboardResponse,
    })

    const { result } = renderHook(() => useAdminMembersDashboard({ search: 'ana', limit: 15 }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(getAdminMembersDashboard).toHaveBeenCalledWith({ search: 'ana', limit: 15 })
    expect(result.current.dashboard).toEqual({
      summary: {
        total: 1,
        aderenti: 1,
        membri: 0,
        organizatori: 0,
      },
      groups: {
        aderenti: {
          label: 'Aderenți',
          count: 1,
          rows: [buildMember()],
        },
        membri: {
          label: 'Membri',
          count: 0,
          rows: [],
        },
        organizatori: {
          label: 'Organizatori',
          count: 0,
          rows: [],
        },
      },
      filters: {
        search: 'ana',
        limit: 15,
      },
    })
    expect(result.current.error).toBeNull()
  })

  it('surfaces request errors in hook state', async () => {
    vi.mocked(getAdminMembersDashboard).mockResolvedValue({
      ok: false,
      error: {
        message: 'Dashboard indisponibil.',
      },
    })

    const { result } = renderHook(() => useAdminMembersDashboard({ limit: 10 }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.dashboard).toBeNull()
    expect(result.current.error).toBe('Dashboard indisponibil.')
  })

  it('reloads the dashboard on demand', async () => {
    vi.mocked(getAdminMembersDashboard)
      .mockResolvedValueOnce({
        ok: true,
        data: buildDashboardResponse(),
      })
      .mockResolvedValueOnce({
        ok: true,
        data: buildDashboardResponse({
          summary: {
            total: 2,
            aderenti: 1,
            membri: 1,
            organizatori: 0,
          },
        }),
      })

    const { result } = renderHook(() => useAdminMembersDashboard({ limit: 10 }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.dashboard?.summary.total).toBe(1)

    await act(async () => {
      result.current.reload()
    })

    await waitFor(() => expect(getAdminMembersDashboard).toHaveBeenCalledTimes(2))
    expect(result.current.dashboard?.summary.total).toBe(2)
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

function buildMember(overrides: Partial<AdminDashboardMember> = {}): AdminDashboardMember {
  return {
    id: '1',
    fullName: 'Ana Pop',
    email: 'ana@example.test',
    role: 'ADERENT',
    createdAt: '2026-04-02T10:00:00.000Z',
    ...overrides,
  }
}

function buildDashboardResponse(
  overrides: Partial<AdminMembersDashboardResponse> = {},
): AdminMembersDashboardResponse {
  return {
    summary: {
      total: 1,
      aderenti: 1,
      membri: 0,
      organizatori: 0,
    },
    groups: {
      aderenti: {
        label: 'Aderenți',
        count: 1,
        rows: [buildMember()],
      },
      membri: {
        label: 'Membri',
        count: 0,
        rows: [],
      },
      organizatori: {
        label: 'Organizatori',
        count: 0,
        rows: [],
      },
    },
    filters: {
      search: '',
      limit: 10,
    },
    ...overrides,
  }
}
