import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@features/auth/context'
import { usePoliticalOperations } from '../hooks/usePoliticalOperations'
import { PoliticalOperationsPage } from './PoliticalOperationsPage'

vi.mock('../hooks/usePoliticalOperations', () => ({ usePoliticalOperations: vi.fn() }))

const preview = vi.fn()
const actions = {
  reload: vi.fn(),
  createAction: vi.fn(),
  updateAction: vi.fn(),
  addParticipant: vi.fn(),
  updateParticipant: vi.fn(),
  preview,
  dispatch: vi.fn(),
}

const data = {
  generatedAt: '2026-09-02T12:00:00.000Z',
  summary: { events: 1, campaigns: 1, tasks: 1, open: 3, participants: 2, reportedHours: 4 },
  actions: [{
    id: '10', type: 'event' as const, title: 'Ședință județeană', summary: 'Coordonarea acțiunilor din filiala Cluj.', objective: 'Confirmarea organizatorilor.', status: 'open' as const, visibility: 'members' as const,
    organization: { id: 'cluj', name: 'Filiala Cluj' }, coordinator: { id: '1', fullName: 'Coordonator Cluj' }, counties: [{ id: 12, name: 'Cluj' }], startsAt: '2026-10-10T10:00:00.000Z', endsAt: null,
    targetMetric: 'participanți', targetValue: 20, resultValue: null, resultSummary: '', version: 1,
    participants: [], metrics: { invited: 0, confirmed: 0, present: 0, completed: 0, reportedHours: 0 },
  }],
  candidates: [{ membershipId: '3', userId: '7', fullName: 'Membru Cluj', email: 'membru@example.test', membershipStatus: 'active', role: 'MEMBRU', county: 'Cluj', locality: 'Cluj-Napoca' }],
  organizations: [{ id: 'cluj', code: 'CJ', name: 'Filiala Cluj' }],
  counties: [{ id: 12, name: 'Cluj' }],
  access: { scope: 'Cluj', national: true, capabilities: ['mobilization.manage', 'communication.dispatch'] },
}

function renderPage() {
  const auth: AuthContextValue = {
    user: { id: '1', fullName: 'Președinte Test', email: 'presedinte@example.test', role: 'PRESEDINTE' },
    loading: false,
    signin: vi.fn(),
    reload: vi.fn(),
    signout: vi.fn(),
  }
  return render(<AuthContext.Provider value={auth}><MemoryRouter><PoliticalOperationsPage /></MemoryRouter></AuthContext.Provider>)
}

describe('PoliticalOperationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    preview.mockResolvedValue({ eligible: 3, byCounty: { Cluj: 3 }, byRole: { MEMBRU: 3 }, channel: 'email' })
    vi.mocked(usePoliticalOperations).mockReturnValue({ data, loading: false, saving: false, error: null, ...actions })
  })

  it('shows operational instruments, results and consent audience preview', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(screen.getByRole('heading', { name: 'Operațiuni și mobilizare' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Acțiune nouă' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ședință județeană' })).toBeInTheDocument()
    expect(screen.getAllByText(/Ore raportate/).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Comunicare segmentată' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Calculează audiența' }))
    expect(await screen.findByText('3 destinatari eligibili')).toBeInTheDocument()
    expect(screen.queryByText('membru@example.test')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pune emailurile în coadă' })).toBeInTheDocument()
  })

  it('offers a capacity-checked confirmation for waiting participants', async () => {
    const user = userEvent.setup()
    actions.updateParticipant.mockResolvedValue({ id: '99', status: 'confirmed' })
    vi.mocked(usePoliticalOperations).mockReturnValue({
      data: { ...data, actions: [{ ...data.actions[0], participants: [{
        id: '99', fullName: 'Participant în așteptare', email: 'waiting@example.test',
        status: 'waitlisted', attendanceStatus: 'pending', report: '', result: '', hours: 0, dueAt: null,
      }] }] },
      loading: false, saving: false, error: null, ...actions,
    })
    renderPage()
    await user.click(screen.getByText('Participanți și raportare (1)'))
    expect(screen.getByText('Pe lista de așteptare · 0 ore')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirmă locul' }))
    expect(actions.updateParticipant).toHaveBeenCalledWith('99', { status: 'confirmed' })
  })
})
