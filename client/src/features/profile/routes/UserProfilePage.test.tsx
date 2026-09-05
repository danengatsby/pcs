import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@features/auth/context'
import { useMemberPortal } from '@features/memberPortal/hooks/useMemberPortal'
import { UserProfilePage } from './UserProfilePage'

vi.mock('@features/memberPortal/hooks/useMemberPortal', () => ({ useMemberPortal: vi.fn() }))

const portalActions = {
  reload: vi.fn(),
  respondEvent: vi.fn(),
  reportTask: vi.fn(),
  saveConsent: vi.fn(),
}

function renderUserProfile(auth: Partial<AuthContextValue>) {
  const value: AuthContextValue = {
    user: null,
    loading: false,
    signin: vi.fn(),
    reload: vi.fn(),
    signout: vi.fn(),
    ...auth,
  }

  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <UserProfilePage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('UserProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useMemberPortal).mockReturnValue({
      portal: null,
      loading: false,
      saving: false,
      error: null,
      ...portalActions,
    })
  })

  it('renders personalized user data', () => {
    renderUserProfile({
      user: {
        id: '42',
        email: 'user@example.test',
        fullName: 'User Test',
        role: 'ADERENT',
      },
    })

    expect(screen.getByRole('heading', { name: 'Bun venit, User Test' })).toBeInTheDocument()
    expect(screen.getByText('user@example.test')).toBeInTheDocument()
    expect(screen.getByText('Aderent')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('shows admin shortcuts for users with administrative access', () => {
    renderUserProfile({
      user: {
        id: '1',
        email: 'admin@example.test',
        fullName: 'Admin Test',
        role: 'PRESEDINTE',
      },
    })

    expect(screen.getByRole('link', { name: 'Zona administrativă' })).toHaveAttribute('href', '/admin')
    expect(screen.getByRole('link', { name: 'Deschide administrarea →' })).toHaveAttribute(
      'href',
      '/admin',
    )
  })

  it('shows the branch, assigned work, documents, dues and consent controls', () => {
    vi.mocked(useMemberPortal).mockReturnValue({
      loading: false,
      saving: false,
      error: null,
      ...portalActions,
      portal: {
        generatedAt: '2026-09-02T12:00:00.000Z',
        membership: { id: '7', status: 'active', memberNumber: 'PCS-CJ-7', applicationAt: '2026-01-10T00:00:00.000Z', approvedAt: '2026-02-01T00:00:00.000Z', joinedAt: '2026-02-02T00:00:00.000Z', county: 'Cluj', locality: 'Cluj-Napoca' },
        organization: { id: 'cluj', name: 'Filiala Cluj', code: 'CJ', officialEmail: 'cluj@example.test', phone: '0264000000', headquarters: 'Cluj-Napoca', leaders: [{ id: '3', fullName: 'Coordonator Cluj', position: 'Președinte filială' }] },
        events: [{ participantId: '11', actionId: '21', type: 'event', title: 'Ședință Cluj', summary: 'Pregătirea acțiunii locale.', description: '', objective: 'Organizare', startsAt: '2026-10-10T10:00:00.000Z', endsAt: null, dueAt: null, participationMode: 'La sediu', commitment: '', status: 'invited', attendanceStatus: 'pending', report: '', result: '', hours: 0, organizationName: 'Filiala Cluj', coordinatorName: 'Coordonator Cluj' }],
        campaigns: [],
        tasks: [{ participantId: '12', actionId: '22', type: 'volunteer_task', title: 'Apeluri membri', summary: 'Confirmarea participanților.', description: '', objective: '12 confirmări', startsAt: null, endsAt: null, dueAt: '2026-10-12T18:00:00.000Z', participationMode: '', commitment: '', status: 'active', attendanceStatus: 'not_applicable', report: '', result: '', hours: 0, organizationName: 'Filiala Cluj', coordinatorName: 'Coordonator Cluj' }],
        documents: [{ id: '1', title: 'Statutul PCS', description: 'Regulile de organizare.', category: 'Organizare', path: '/documente/statut', visibility: 'members' }],
        dues: { rows: [], dueAmount: 25, currency: 'RON' },
        communication: { emailConsent: true, smsConsent: false, whatsappConsent: false, phone: '0712345678', interests: ['organizare'], consentVersion: 'portal-membru-v1' },
        regulatedModules: [{ key: 'electoral', legalStatus: 'pending', dpoStatus: 'pending', enabled: false }],
      },
    })

    renderUserProfile({ user: { id: '42', email: 'user@example.test', fullName: 'User Test', role: 'MEMBRU' } })

    expect(screen.getByText('PCS-CJ-7')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Filiala Cluj' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ședință Cluj' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Apeluri membri' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Statutul PCS/ })).toHaveAttribute('href', '/documente/statut')
    expect(screen.getByText(/în așteptare \(juridic: pending, DPO: pending\)/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvează preferințele' })).toBeInTheDocument()
  })
})
