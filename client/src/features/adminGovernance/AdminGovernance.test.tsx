import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@features/auth/context'
import { AdminContext } from '@features/adminShell/AdminContext'
import { apiGet, apiPost } from '@lib/http'
import { CongressPage } from './CongressPage'
import { ArbitrationPage } from './ArbitrationPage'

vi.mock('@lib/http', () => ({ apiGet: vi.fn(), apiPost: vi.fn() }))
const congress = { id: '7', title: 'Congres teritorial', status: 'closed', purpose: 'ordinary', organizationId: 'cluj', startsAt: '2026-09-01T08:00:00Z', endsAt: '2026-09-02T08:00:00Z', quorum: 10, delegateCount: 12, votedDelegateCount: 10 }
const caseRow = { id: '8', caseNumber: 'ARB-8', subject: 'Sesizare teritorială', organizationId: 'cluj', caseType: 'election', status: 'submitted', filedAt: '2026-01-01T00:00:00Z', responseDueAt: '2026-01-10T00:00:00Z', decidedAt: null }

function renderPage(page: 'congress' | 'arbitration', manage = true) {
  const auth: AuthContextValue = { user: { id: '1', email: 'a@example.test', fullName: 'Secretar', role: 'SECRETAR' }, loading: false, signin: vi.fn(), signout: vi.fn(), reload: vi.fn() }
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AuthContext.Provider value={auth}>
    <AdminContext.Provider value={{ access: { role: 'SECRETAR', capabilities: ['organization.read', ...(manage ? ['congress.manage', 'arbitration.manage'] : [])], scope: { national: false, label: 'Cluj', organizationIds: ['cluj'] } } }}>
      {page === 'congress' ? <CongressPage /> : <ArbitrationPage />}
    </AdminContext.Provider>
  </AuthContext.Provider></QueryClientProvider>)
}

describe('administrative governance routes', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(apiGet).mockImplementation(async (path) => ({ ok: true, data: path.includes('/organizations') ? { rows: [{ id: 'cluj', name: 'Filiala Cluj' }], total: 1 } : path.includes('/congresses') ? [congress] : [caseRow] }))
    vi.mocked(apiPost).mockResolvedValue({ ok: true, data: { id: '9' } })
  })

  it('shows the congress register without management controls for read-only users', async () => {
    renderPage('congress', false)
    expect(await screen.findByRole('heading', { name: 'Congres teritorial' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Congres nou' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Validează congresul' })).not.toBeInTheDocument()
  })

  it('requires explicit confirmation before publishing congress validation and preserves a server error', async () => {
    const user = userEvent.setup()
    renderPage('congress')
    await user.click(await screen.findByRole('button', { name: 'Validează congresul' }))
    expect(apiPost).not.toHaveBeenCalled()
    expect(screen.getByText(/face rezultatele disponibile public/)).toBeInTheDocument()
    vi.mocked(apiPost).mockResolvedValueOnce({ ok: false, error: { message: 'Cvorum insuficient' } })
    await user.click(screen.getByRole('button', { name: 'Confirmă schimbarea' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Cvorum insuficient')
    expect(apiPost).toHaveBeenCalledWith('/api/admin/congresses/7/status', { status: 'validated' }, { auth: true })
  })

  it('creates a congress from a territorial organization and rejects reversed dates locally', async () => {
    const user = userEvent.setup()
    renderPage('congress')
    await user.click(screen.getByRole('button', { name: 'Congres nou' }))
    await screen.findByRole('option', { name: 'Filiala Cluj' })
    await user.selectOptions(screen.getByLabelText('Organizație'), 'cluj')
    await user.type(screen.getByLabelText('Titlu'), 'Congres județean')
    fireEvent.change(screen.getByLabelText('Deschidere'), { target: { value: '2026-10-02T10:00' } })
    fireEvent.change(screen.getByLabelText('Închidere'), { target: { value: '2026-10-01T10:00' } })
    await user.type(screen.getByLabelText('Cvorum (delegați prezenți)'), '20')
    await user.click(screen.getByRole('button', { name: 'Creează în pregătire' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Închiderea trebuie să fie după deschidere')
    expect(apiPost).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Închidere'), { target: { value: '2026-10-03T10:00' } })
    await user.click(screen.getByRole('button', { name: 'Creează în pregătire' }))
    expect(await screen.findByText('Congresul a fost creat în pregătire.')).toBeInTheDocument()
    expect(apiPost).toHaveBeenCalledWith('/api/admin/congresses', expect.objectContaining({ organizationId: 'cluj', title: 'Congres județean', quorum: 20 }), { auth: true })
  })

  it('shows arbitration deadlines and read-only access without leaking a national creation option', async () => {
    renderPage('arbitration', false)
    expect(await screen.findByText(/Termen depășit/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dosar nou' })).not.toBeInTheDocument()
  })

  it('registers an arbitration case through the existing authenticated endpoint', async () => {
    const user = userEvent.setup()
    renderPage('arbitration')
    await user.click(screen.getByRole('button', { name: 'Dosar nou' }))
    await screen.findByRole('option', { name: 'Filiala Cluj' })
    expect(within(screen.getByLabelText('Organizație')).queryByText(/Jurisdicție națională/)).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Organizație'), 'cluj')
    await user.type(screen.getByLabelText('Subiect'), 'Contestație electorală')
    await user.type(screen.getByLabelText('Situația de fapt'), 'Descrierea completă a situației pentru examinare.')
    await user.click(screen.getByRole('button', { name: 'Înregistrează dosarul' }))
    expect(await screen.findByText('Dosarul a fost înregistrat.')).toBeInTheDocument()
    expect(apiPost).toHaveBeenCalledWith('/api/admin/arbitration/cases', expect.objectContaining({ organizationId: 'cluj', subject: 'Contestație electorală', responseDueAt: null }), { auth: true })
  })

  it('renders a load error rather than a false empty register', async () => {
    vi.mocked(apiGet).mockResolvedValue({ ok: false, error: { message: 'Registru indisponibil' } })
    renderPage('arbitration')
    expect(await screen.findByRole('alert')).toHaveTextContent('Registru indisponibil')
    expect(screen.queryByText(/Nu există dosare/)).not.toBeInTheDocument()
  })
})
