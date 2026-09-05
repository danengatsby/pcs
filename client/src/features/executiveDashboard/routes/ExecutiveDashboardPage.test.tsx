import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@features/auth/context'
import { useExecutiveDashboard } from '../hooks/useExecutiveDashboard'
import { useUpdateExecutiveTarget } from '../hooks/useUpdateExecutiveTarget'
import type { ExecutiveDashboardData } from '../types'
import { ExecutiveDashboardPage } from './ExecutiveDashboardPage'

vi.mock('../hooks/useExecutiveDashboard', () => ({
  useExecutiveDashboard: vi.fn(),
}))

vi.mock('../hooks/useUpdateExecutiveTarget', () => ({
  useUpdateExecutiveTarget: vi.fn(),
}))

vi.mock('../hooks/useExecutiveInterventions', () => ({
  useExecutiveInterventions: () => ({
    isPending: false, isError: false, isFetching: false, refetch: vi.fn(),
    data: { rows: [], counts: {}, total: 0, limit: 20, offset: 0, generatedAt: '2026-10-10T12:00:00Z', expiryCoverage: { tracked: 0, missing: 3, windowDays: 30 } },
  }),
}))

const updateTarget = vi.fn().mockResolvedValue(undefined)

describe('ExecutiveDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useExecutiveDashboard).mockReturnValue({
      dashboard: buildDashboard(),
      loading: false,
      error: null,
      reload: vi.fn(),
    })
    vi.mocked(useUpdateExecutiveTarget).mockReturnValue({
      update: updateTarget,
      updating: false,
      error: null,
      reset: vi.fn(),
    })
  })

  it('renders the executive indicators, territorial distribution and objectives', () => {
    renderPage('PRESEDINTE')

    expect(screen.getByRole('heading', { name: 'Tablou de comandă' })).toBeInTheDocument()
    const interventions = screen.getByRole('region', { name: 'Intervenții necesare' })
    const indicators = screen.getByRole('region', { name: 'Indicatori executivi' })
    expect(interventions.compareDocumentPosition(indicators) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const contactCard = screen.getByText('Rată de contactare', { selector: '.hero-kicker' }).closest('article')
    expect(contactCard).not.toBeNull()
    expect(within(contactCard as HTMLElement).getByText('50%')).toBeInTheDocument()

    expect(screen.getByText('Cluj')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ținte operaționale' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Conversie în membri' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Salvează' })).toHaveLength(4)
    expect(screen.getByText('Cereri noi neatinse de peste 48 de ore.')).toBeInTheDocument()
  })

  it('allows the president to update an operational target', async () => {
    const user = userEvent.setup()
    renderPage('PRESEDINTE')

    const objective = screen.getByRole('heading', { name: 'Rată de contactare' }).closest('article')
    expect(objective).not.toBeNull()
    const input = within(objective as HTMLElement).getByLabelText('Țintă (%)')

    await user.clear(input)
    await user.type(input, '82')
    await user.click(within(objective as HTMLElement).getByRole('button', { name: 'Salvează' }))

    expect(updateTarget).toHaveBeenCalledWith({ key: 'contact_rate', targetValue: 82 })
  })

  it('keeps targets read-only for administrative roles outside the presidency', () => {
    renderPage('CONSILIER')

    expect(screen.queryByRole('button', { name: 'Salvează' })).not.toBeInTheDocument()
    expect(screen.getByText('Țintele pot fi actualizate numai de președinte.')).toBeInTheDocument()
  })
})

function renderPage(role: 'PRESEDINTE' | 'CONSILIER') {
  const auth: AuthContextValue = {
    user: {
      id: '1',
      fullName: 'Lider Test',
      email: 'lider@example.test',
      role,
    },
    loading: false,
    signin: vi.fn(),
    reload: vi.fn(),
    signout: vi.fn(),
  }

  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ExecutiveDashboardPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

function buildDashboard(): ExecutiveDashboardData {
  return {
    generatedAt: '2026-09-01T10:00:00.000Z',
    summary: {
      applicationsTotal: 40,
      applicationsLast30Days: 12,
      contactedTotal: 20,
      uncontactedCases: 20,
      membersTotal: 8,
      contactRate: 50,
      memberConversionRate: 20,
      overdueCases: 3,
      activeOrganizations: 6,
      countiesWithoutResponsible: 1,
    },
    trends: [
      { month: '2026-04-01', applications: 3, contacted: 2, members: 1 },
      { month: '2026-05-01', applications: 5, contacted: 3, members: 1 },
      { month: '2026-06-01', applications: 4, contacted: 2, members: 1 },
      { month: '2026-07-01', applications: 7, contacted: 4, members: 2 },
      { month: '2026-08-01', applications: 9, contacted: 5, members: 2 },
      { month: '2026-09-01', applications: 12, contacted: 4, members: 1 },
    ],
    counties: [
      { county: 'Cluj', applications: 12, contacted: 8, members: 3, organizers: 2, overdue: 1, hasResponsible: true },
      { county: 'Iași', applications: 8, contacted: 4, members: 2, organizers: 0, overdue: 0, hasResponsible: false },
    ],
    countiesWithoutResponsible: ['Iași'],
    workflow: [
      { status: 'nou', count: 10 },
      { status: 'validat', count: 10 },
      { status: 'contactat', count: 12 },
      { status: 'activ', count: 8 },
    ],
    objectives: [
      buildObjective('contact_rate', 'Rată de contactare', 80, 50, 'percent', 'at_least'),
      buildObjective('member_conversion_rate', 'Conversie în membri', 25, 20, 'percent', 'at_least'),
      buildObjective('overdue_cases', 'Dosare restante', 0, 3, 'count', 'at_most'),
      buildObjective('active_organizations', 'Organizații active', 10, 6, 'count', 'at_least'),
    ],
    definitions: {
      contactRate: 'Cereri contactate raportate la total.',
      memberConversionRate: 'Dosare ajunse la membru raportate la total.',
      overdueCases: 'Cereri noi neatinse de peste 48 de ore.',
      activeOrganizations: 'Organizații active în registru.',
      uncontactedCases: 'Dosare fără contact înregistrat.',
      countiesWithoutResponsible: 'Județe fără mandat teritorial activ.',
      trends: 'Cohorte lunare.',
    },
  }
}

function buildObjective(
  key: ExecutiveDashboardData['objectives'][number]['key'],
  label: string,
  targetValue: number,
  currentValue: number,
  unit: ExecutiveDashboardData['objectives'][number]['unit'],
  direction: ExecutiveDashboardData['objectives'][number]['direction'],
): ExecutiveDashboardData['objectives'][number] {
  return {
    key,
    label,
    targetValue,
    currentValue,
    unit,
    direction,
    status: 'at_risk',
    progressPercent: 60,
    updatedAt: '2026-09-01T09:00:00.000Z',
  }
}
