import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@features/auth/context'
import { useAdminMembersDashboard, useMembershipAction } from '../hooks/useAdminMembersDashboard'
import type { AdminMembersDashboardResponse } from '../types'
import { AdminMembersDashboardPage } from './AdminMembersDashboardPage'

vi.mock('../hooks/useAdminMembersDashboard', () => ({
  useAdminMembersDashboard: vi.fn(),
  useMembershipAction: vi.fn(),
}))

describe('AdminMembersDashboardPage', () => {
  const execute = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAdminMembersDashboard).mockReturnValue({
      dashboard: buildDashboard(),
      loading: false,
      error: null,
      reload: vi.fn(),
    })
    vi.mocked(useMembershipAction).mockReturnValue({
      execute,
      saving: false,
      error: null,
      reset: vi.fn(),
    })
    execute.mockResolvedValue({ message: 'Decizia a fost înregistrată.', membership: buildDashboard().rows[0] })
  })

  it('renders the full paginated registry and operational summaries', () => {
    renderPage('PRESEDINTE')

    expect(screen.getByRole('heading', { name: 'Management membri' })).toBeInTheDocument()
    expect(screen.getByText('Ana Pop')).toBeInTheDocument()
    expect(screen.getAllByText('Aprobat').length).toBeGreaterThan(0)
    expect(screen.getByText('1–1 din 1')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Activează membrul' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Transferă' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Încetează calitatea' })).toBeInTheDocument()
  })

  it('submits an activation with optimistic version protection', async () => {
    const user = userEvent.setup()
    renderPage('PRESEDINTE')

    await user.click(screen.getByRole('button', { name: 'Activează membrul' }))
    expect(screen.getByText(/Decizia va fi salvată în istoricul lui Ana Pop/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirmă decizia' }))

    await waitFor(() => expect(execute).toHaveBeenCalledWith({
      membershipId: '9',
      payload: expect.objectContaining({
        action: 'activate',
        expectedVersion: 2,
      }),
    }))
    expect(await screen.findByText('Decizia a fost înregistrată.')).toBeInTheDocument()
  })

  it('keeps the registry read-only for advisers', () => {
    const dashboard = buildDashboard()
    dashboard.rows[0].availableActions = []
    vi.mocked(useAdminMembersDashboard).mockReturnValue({
      dashboard,
      loading: false,
      error: null,
      reload: vi.fn(),
    })

    renderPage('CONSILIER')
    expect(screen.getByText('Fără operații disponibile pentru rolul tău.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Activează membrul' })).not.toBeInTheDocument()
  })
})

function renderPage(role: 'PRESEDINTE' | 'CONSILIER') {
  const auth: AuthContextValue = {
    user: { id: '1', fullName: 'Lider Test', email: 'lider@example.test', role },
    loading: false,
    signin: vi.fn(),
    reload: vi.fn(),
    signout: vi.fn(),
  }
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AdminMembersDashboardPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
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
      approvalOrganization: { id: 'org-cluj', code: 'PCS-CJ', name: 'Filiala Cluj', level: 'county', status: 'active' },
      county: 'Cluj',
      locality: 'Cluj-Napoca',
      applicationAt: '2026-08-19T10:00:00.000Z',
      verifiedAt: '2026-08-20T10:00:00.000Z',
      approvedAt: '2026-08-21T10:00:00.000Z',
      activatedAt: null,
      approvalBody: '',
      suspendedAt: null,
      endedAt: null,
      statusReason: '',
      version: 2,
      createdAt: '2026-08-19T10:00:00.000Z',
      updatedAt: '2026-08-20T10:00:00.000Z',
      history: [],
      availableActions: ['activate', 'transfer', 'terminate'],
    }],
    organizations: [{ id: 'org-cluj', code: 'PCS-CJ', name: 'Filiala Cluj', level: 'county', status: 'active' }],
    pagination: { total: 1, limit: 25, offset: 0, hasPrevious: false, hasNext: false },
    filters: { search: '', status: null, organizationId: null },
  }
}
