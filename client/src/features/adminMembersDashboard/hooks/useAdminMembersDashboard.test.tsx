import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyMembershipAction, getAdminMembersDashboard } from '../api/getAdminMembersDashboard'
import { useAdminMembersDashboard, useMembershipAction } from './useAdminMembersDashboard'
import type { AdminMembersDashboardResponse } from '../types'

vi.mock('../api/getAdminMembersDashboard', () => ({
  getAdminMembersDashboard: vi.fn(),
  applyMembershipAction: vi.fn(),
}))

describe('membership dashboard hooks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loads a paginated operational registry', async () => {
    vi.mocked(getAdminMembersDashboard).mockResolvedValue({ ok: true, data: buildDashboard() })
    const { result } = renderHook(() => useAdminMembersDashboard({
      search: 'ana',
      status: 'approved',
      limit: 25,
      offset: 25,
    }), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(getAdminMembersDashboard).toHaveBeenCalledWith({
      search: 'ana',
      status: 'approved',
      limit: 25,
      offset: 25,
    })
    expect(result.current.dashboard?.rows[0]?.availableActions).toContain('activate')
  })

  it('surfaces list errors and supports reload', async () => {
    vi.mocked(getAdminMembersDashboard)
      .mockResolvedValueOnce({ ok: false, error: { message: 'Registru indisponibil.' } })
      .mockResolvedValueOnce({ ok: true, data: buildDashboard() })
    const { result } = renderHook(() => useAdminMembersDashboard({ limit: 25 }), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Registru indisponibil.')
    act(() => result.current.reload())
    await waitFor(() => expect(result.current.dashboard).not.toBeNull())
  })

  it('records a membership action', async () => {
    vi.mocked(applyMembershipAction).mockResolvedValue({
      ok: true,
      data: { message: 'Decizie salvată.', membership: buildDashboard().rows[0] },
    })
    const { result } = renderHook(() => useMembershipAction(), { wrapper: createWrapper() })

    await act(async () => {
      await result.current.execute({
        membershipId: '9',
        payload: { action: 'activate', expectedVersion: 2 },
      })
    })
    expect(applyMembershipAction).toHaveBeenCalledWith('9', { action: 'activate', expectedVersion: 2 })
  })
})

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function buildDashboard(): AdminMembersDashboardResponse {
  return {
    generatedAt: '2026-09-01T10:00:00.000Z',
    summary: {
      total: 1,
      supporters: 0,
      applications: 0,
      verified: 0,
      approved: 1,
      active: 0,
      suspended: 0,
      terminated: 0,
      organizers: 0,
      unassigned: 1,
    },
    rows: [{
      id: '9',
      userId: '19',
      volunteerId: '29',
      fullName: 'Ana Pop',
      email: 'ana@example.test',
      role: 'ADERENT',
      membershipStatus: 'approved',
      memberNumber: null,
      organization: null,
      approvalOrganization: null,
      county: 'Cluj',
      locality: 'Cluj-Napoca',
      applicationAt: '2026-08-19T10:00:00.000Z',
      verifiedAt: '2026-08-20T10:00:00.000Z',
      approvedAt: '2026-08-21T10:00:00.000Z',
      activatedAt: null,
      approvalBody: 'Biroul județean',
      suspendedAt: null,
      endedAt: null,
      statusReason: '',
      version: 2,
      createdAt: '2026-08-19T10:00:00.000Z',
      updatedAt: '2026-08-20T10:00:00.000Z',
      history: [],
      availableActions: ['activate', 'transfer', 'terminate'],
    }],
    organizations: [],
    pagination: { total: 1, limit: 25, offset: 0, hasPrevious: false, hasNext: false },
    filters: { search: '', status: null, organizationId: null },
  }
}
