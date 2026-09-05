import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@features/auth/context'
import { apiGet } from '@lib/http'
import RequireAdmin from '@app/components/RequireAdmin'
import { AdminLayout } from './AdminLayout'
import { AdminHomePage, RequireCapability } from './AdminPages'
import { adminNavigation, type AdminAccess } from './adminNavigation'

vi.mock('@lib/http', () => ({ apiGet: vi.fn() }))
const access: AdminAccess = { role: 'CONSILIER', capabilities: ['recruitment.read', 'congress.read', 'arbitration.read', 'mobilization.read'], scope: { national: false, label: 'Cluj', organizationIds: ['cluj'] } }

function renderShell(path = '/admin', authChanges: Partial<AuthContextValue> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const auth: AuthContextValue = { user: { id: '1', fullName: 'Consilier Cluj', email: 'a@example.test', role: 'CONSILIER' }, loading: false, signin: vi.fn(), signout: vi.fn(), reload: vi.fn(), ...authChanges }
  const result = render(<QueryClientProvider client={client}><AuthContext.Provider value={auth}>
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes>
      <Route path="/auth/signin" element={<p>Autentificare necesară</p>} />
      <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
        <Route index element={<AdminHomePage />} />
        {adminNavigation.map((item) => <Route key={item.path} path={item.path} element={<RequireCapability capability={item.capability}><h1>Pagina {item.label}</h1></RequireCapability>} />)}
      </Route>
    </Routes></MemoryRouter>
  </AuthContext.Provider></QueryClientProvider>)
  return { ...result, client }
}

describe('shared administrative shell', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(apiGet).mockImplementation(async (path) => ({ ok: true, data: path.endsWith('/access') ? access : { generatedAt: '2026-09-05T12:00:00Z', counts: { volunteers: 2, congresses: 3, arbitration: 0, mobilization: 1 }, total: 6 } }))
  })

  it('uses effective capabilities, scoped counts and an active link on every route', async () => {
    const user = userEvent.setup()
    renderShell('/admin/congresses')
    const nav = await screen.findByRole('navigation', { name: 'Meniu administrativ' })
    expect(within(nav).queryByRole('link', { name: /Tablou de comandă/ })).not.toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: /Congres/ })).toHaveAttribute('aria-current', 'page')
    expect(await screen.findByText('6 sarcini restante')).toBeInTheDocument()
    expect(screen.getByText(/Arie autorizată: Cluj/)).toBeInTheDocument()
    await user.click(within(nav).getByRole('link', { name: /Arbitraj/ }))
    expect(screen.getByRole('heading', { name: 'Pagina Arbitraj' })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: /Arbitraj/ })).toHaveAttribute('aria-current', 'page')
  })

  it('denies a direct URL without the matching capability', async () => {
    renderShell('/admin/dashboard')
    expect(await screen.findByRole('heading', { name: 'Acces restricționat' })).toBeInTheDocument()
    expect(screen.queryByText('Pagina Tablou de comandă')).not.toBeInTheDocument()
  })

  it('fails closed on an access error without requesting private counts', async () => {
    vi.mocked(apiGet).mockResolvedValue({ ok: false, error: { message: 'Mandat expirat', status: 403 } })
    renderShell('/admin/congresses')
    expect(await screen.findByRole('alert')).toHaveTextContent('Mandat expirat')
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(apiGet).toHaveBeenCalledTimes(1)
  })

  it('does not request administrative data without a session', async () => {
    renderShell('/admin/congresses', { user: null })
    expect(await screen.findByText('Autentificare necesară')).toBeInTheDocument()
    expect(apiGet).not.toHaveBeenCalled()
  })

  it('shows unavailable rather than zero on count failure, then supports retry', async () => {
    const user = userEvent.setup()
    vi.mocked(apiGet).mockImplementation(async (path) => path.endsWith('/access') ? { ok: true, data: access } : { ok: false, error: { message: 'Indisponibil' } })
    renderShell('/admin/congresses')
    expect(await screen.findByRole('alert')).toHaveTextContent('Contoarele nu au putut fi încărcate')
    expect(screen.getByRole('heading', { name: 'Pagina Congres' })).toBeInTheDocument()
    expect(screen.getAllByLabelText('Număr indisponibil')).toHaveLength(4)
    vi.mocked(apiGet).mockResolvedValue({ ok: true, data: { counts: { congresses: 4 }, total: 4, generatedAt: '2026-09-05T12:00:00Z' } })
    await user.click(screen.getByRole('button', { name: 'Actualizează sarcinile' }))
    expect(await screen.findByText('4 sarcini restante')).toBeInTheDocument()
  })

  it('refreshes the counters immediately after a successful module mutation', async () => {
    const { client } = renderShell('/admin/congresses')
    await screen.findByText('6 sarcini restante')
    const before = vi.mocked(apiGet).mock.calls.filter(([path]) => path.endsWith('/tasks')).length
    await client.getMutationCache().build(client, { mutationFn: async () => ({ saved: true }) }).execute(undefined)
    await waitFor(() => expect(vi.mocked(apiGet).mock.calls.filter(([path]) => path.endsWith('/tasks')).length).toBeGreaterThan(before))
  })

  it('renders all seven zones when all read capabilities are granted', async () => {
    vi.mocked(apiGet).mockResolvedValue({ ok: true, data: { ...access, capabilities: adminNavigation.map((item) => item.capability) } })
    renderShell('/admin/congresses')
    const nav = await screen.findByRole('navigation', { name: 'Meniu administrativ' })
    expect(within(nav).getAllByRole('link')).toHaveLength(7)
  })
})
