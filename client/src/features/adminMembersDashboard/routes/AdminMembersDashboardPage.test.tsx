import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminMembersDashboard } from '../hooks/useAdminMembersDashboard'
import { AdminMembersDashboardPage } from './AdminMembersDashboardPage'
import type { AdminMembersDashboardQuery } from '../api/getAdminMembersDashboard'
import type { AdminDashboardMember, AdminDashboardGroup, AdminMembersDashboardResponse } from '../types'

vi.mock('../hooks/useAdminMembersDashboard', () => ({
  useAdminMembersDashboard: vi.fn(),
}))

describe('AdminMembersDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dashboard summary and grouped members', () => {
    const reload = vi.fn()
    mockDashboardHook({ reload })

    renderPage()

    expect(screen.getByRole('heading', { name: 'Dashboard membri' })).toBeInTheDocument()
    expect(screen.getByText('Afișăm primele 10 rezultate pe categorie.')).toBeInTheDocument()
    expect(screen.getByText('Ana Pop')).toBeInTheDocument()
    expect(screen.getByText('Mara Ionescu')).toBeInTheDocument()
    expect(screen.getByText('Dan Pavel')).toBeInTheDocument()

    const statsSection = screen.getByText('Total').closest('section')
    expect(statsSection).not.toBeNull()

    const totalCard = within(statsSection as HTMLElement).getByText('Total').closest('article')
    const aderentiCard = within(statsSection as HTMLElement).getByText('Aderenți').closest('article')

    expect(totalCard).not.toBeNull()
    expect(aderentiCard).not.toBeNull()
    expect(within(totalCard as HTMLElement).getByText('3')).toBeInTheDocument()
    expect(within(aderentiCard as HTMLElement).getByText('1')).toBeInTheDocument()
  })

  it('filters dashboard results using the search input', async () => {
    const user = userEvent.setup()
    mockDashboardHook()

    renderPage()

    await user.type(screen.getByLabelText('Caută după nume sau email'), 'mara')

    await waitFor(() =>
      expect(screen.getByText(/Filtru activ: “mara”\./)).toBeInTheDocument())

    expect(screen.queryByText('Ana Pop')).toBeNull()
    expect(screen.getByText('Mara Ionescu')).toBeInTheDocument()
    expect(screen.queryByText('Dan Pavel')).toBeNull()

    const statsSection = screen.getByText('Total').closest('section')
    expect(statsSection).not.toBeNull()

    const totalCard = within(statsSection as HTMLElement).getByText('Total').closest('article')
    expect(totalCard).not.toBeNull()
    expect(within(totalCard as HTMLElement).getByText('1')).toBeInTheDocument()
  })

  it('shows errors and allows manual reload', async () => {
    const user = userEvent.setup()
    const reload = vi.fn()

    vi.mocked(useAdminMembersDashboard).mockReturnValue({
      dashboard: null,
      loading: false,
      error: 'Nu s-a putut încărca dashboard-ul.',
      reload,
    })

    renderPage()

    expect(screen.getByText('Nu s-a putut încărca dashboard-ul.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reîncarcă' }))

    expect(reload).toHaveBeenCalledTimes(1)
  })
})

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AdminMembersDashboardPage />
    </MemoryRouter>,
  )
}

function mockDashboardHook(overrides: Partial<ReturnType<typeof useAdminMembersDashboard>> = {}) {
  const rows = buildMembers()
  const reload = overrides.reload ?? vi.fn()

  vi.mocked(useAdminMembersDashboard).mockImplementation((query: AdminMembersDashboardQuery) => {
    const search = (query.search ?? '').trim().toLowerCase()
    const filtered = rows.filter((member) => (
      !search
      || member.fullName.toLowerCase().includes(search)
      || member.email.toLowerCase().includes(search)
    ))

    const dashboard = buildDashboard({
      summary: {
        total: filtered.length,
        aderenti: filtered.filter((member) => member.role === 'ADERENT').length,
        membri: filtered.filter((member) => member.role === 'MEMBRU').length,
        organizatori: filtered.filter((member) => member.role !== 'ADERENT' && member.role !== 'MEMBRU').length,
      },
      groups: {
        aderenti: buildGroup('Aderenți', filtered.filter((member) => member.role === 'ADERENT')),
        membri: buildGroup('Membri', filtered.filter((member) => member.role === 'MEMBRU')),
        organizatori: buildGroup(
          'Organizatori',
          filtered.filter((member) => member.role !== 'ADERENT' && member.role !== 'MEMBRU'),
        ),
      },
      filters: {
        search: query.search ?? '',
        limit: query.limit ?? 10,
      },
    })

    return {
      dashboard,
      loading: false,
      error: null,
      reload,
      ...overrides,
    }
  })

  return { reload }
}

function buildMembers(): AdminDashboardMember[] {
  return [
    buildMember({
      id: '1',
      fullName: 'Ana Pop',
      email: 'ana@example.test',
      role: 'ADERENT',
    }),
    buildMember({
      id: '2',
      fullName: 'Mara Ionescu',
      email: 'mara@example.test',
      role: 'MEMBRU',
    }),
    buildMember({
      id: '3',
      fullName: 'Dan Pavel',
      email: 'dan@example.test',
      role: 'CONSILIER',
    }),
  ]
}

function buildGroup(label: string, rows: AdminDashboardMember[]): AdminDashboardGroup {
  return {
    label,
    count: rows.length,
    rows,
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

function buildDashboard(
  overrides: Partial<AdminMembersDashboardResponse> = {},
): AdminMembersDashboardResponse {
  return {
    summary: {
      total: 3,
      aderenti: 1,
      membri: 1,
      organizatori: 1,
    },
    groups: {
      aderenti: buildGroup('Aderenți', [buildMember()]),
      membri: buildGroup('Membri', [buildMember({
        id: '2',
        fullName: 'Mara Ionescu',
        email: 'mara@example.test',
        role: 'MEMBRU',
      })]),
      organizatori: buildGroup('Organizatori', [buildMember({
        id: '3',
        fullName: 'Dan Pavel',
        email: 'dan@example.test',
        role: 'CONSILIER',
      })]),
    },
    filters: {
      search: '',
      limit: 10,
    },
    ...overrides,
  }
}
