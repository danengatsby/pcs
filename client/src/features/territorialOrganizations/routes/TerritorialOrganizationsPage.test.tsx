import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@features/auth/context'
import {
  useOrganizationDetail,
  useOrganizationMutations,
  useOrganizationRegistry,
} from '../hooks/useTerritorialOrganizations'
import type { OrganizationDetail, OrganizationRegistry } from '../types'
import { TerritorialOrganizationsPage } from './TerritorialOrganizationsPage'

vi.mock('../hooks/useTerritorialOrganizations', () => ({
  useOrganizationRegistry: vi.fn(),
  useOrganizationDetail: vi.fn(),
  useOrganizationMutations: vi.fn(),
}))

const organization = buildOrganization()
const registry = buildRegistry(organization)

describe('TerritorialOrganizationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useOrganizationRegistry).mockReturnValue({
      registry,
      loading: false,
      error: null,
      reload: vi.fn(),
    })
    vi.mocked(useOrganizationDetail).mockReturnValue({
      organization,
      loading: false,
      error: null,
    })
    vi.mocked(useOrganizationMutations).mockReturnValue({
      execute: vi.fn().mockResolvedValue(organization),
      saving: false,
      error: null,
      reset: vi.fn(),
    })
  })

  it('renders real territorial facts, leadership mandates and measurable objectives', () => {
    renderPage('PRESEDINTE')

    expect(screen.getByRole('heading', { name: 'Organizații teritoriale' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: organization.name })).toBeInTheDocument()
    expect(screen.getAllByText('Cluj').length).toBeGreaterThan(0)
    expect(screen.getAllByText('15 ian. 2026').length).toBeGreaterThan(0)
    expect(screen.queryByText(/1970/)).not.toBeInTheDocument()
    expect(screen.getByText('Președinte filială')).toBeInTheDocument()
    expect(screen.getByText('Creșterea bazei de membri')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Organizație nouă' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editează organizația' })).toBeInTheDocument()
  })

  it('keeps the registry read-only for advisers', () => {
    renderPage('CONSILIER')

    expect(screen.queryByRole('button', { name: 'Organizație nouă' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editează organizația' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Încheie mandatul' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Adaugă obiectiv' })).not.toBeInTheDocument()
  })

  it('shows an explicit empty state instead of a demonstrative organization', () => {
    vi.mocked(useOrganizationRegistry).mockReturnValue({
      registry: buildRegistry(null),
      loading: false,
      error: null,
      reload: vi.fn(),
    })
    vi.mocked(useOrganizationDetail).mockReturnValue({
      organization: null,
      loading: false,
      error: null,
    })

    renderPage('PRESEDINTE')

    expect(screen.getByText('Nu există organizații reale înregistrate. Începe cu structura națională.')).toBeInTheDocument()
    expect(screen.getByText(/înregistrează organizația națională pe baza documentelor reale/i)).toBeInTheDocument()
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
        <TerritorialOrganizationsPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

function buildRegistry(detail: OrganizationDetail | null): OrganizationRegistry {
  return {
    rows: detail ? [detail] : [],
    total: detail ? 1 : 0,
    summary: {
      organizations: detail ? 1 : 0,
      active: detail ? 1 : 0,
      forming: 0,
      countiesCovered: detail ? 1 : 0,
      activeMandates: detail ? 1 : 0,
      objectivesAtRisk: 0,
    },
    counties: [{ id: 13, name: 'Cluj' }],
  }
}

function buildOrganization(): OrganizationDetail {
  return {
    id: 'org-cluj',
    code: 'PCS-CJ',
    level: 'county',
    name: 'Filiala Județeană Cluj',
    county: 'Cluj',
    membersCount: 42,
    status: 'active',
    foundedAt: '2026-01-15',
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    parent: { id: 'national', code: 'PCS-NAT', name: 'Organizația Națională' },
    officialEmail: 'cluj@example.test',
    phone: '0700000000',
    headquarters: 'Cluj-Napoca, Strada Test 1',
    territories: [{ id: '1', type: 'county', countyId: 13, county: 'Cluj', locality: '', label: 'Cluj' }],
    counts: { children: 1, mandates: 1, objectives: 1 },
    children: [{ id: 'local', code: 'PCS-CL-N', level: 'local', name: 'Cluj-Napoca', status: 'active' }],
    mandates: [{
      id: '1',
      userId: '7',
      fullName: 'Maria Pop',
      positionTitle: 'Președinte filială',
      startedAt: '2026-01-15',
      endedAt: null,
      status: 'active',
      accountEmail: 'maria@example.test',
      accountRole: 'MEMBRU',
      createdAt: '2026-01-15T10:00:00.000Z',
      updatedAt: '2026-01-15T10:00:00.000Z',
    }],
    objectives: [{
      id: '1',
      title: 'Creșterea bazei de membri',
      description: 'Obiectiv trimestrial.',
      metricName: 'membri activi',
      targetValue: 50,
      currentValue: 42,
      unit: 'membri',
      dueDate: '2026-12-31',
      status: 'in_progress',
      createdAt: '2026-01-15T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
    }],
  }
}
