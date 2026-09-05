import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@features/auth/context'
import { apiGet, apiPatch } from '@lib/http'
import { interventionLabels, type InterventionData, type InterventionKind } from '../interventions'
import { InterventionsPanel } from './InterventionsPanel'

vi.mock('@lib/http', () => ({ apiGet: vi.fn(), apiPatch: vi.fn() }))
const data: InterventionData = {
  generatedAt: '2026-10-10T12:00:00Z', total: 26, limit: 20, offset: 0,
  rows: Object.keys(interventionLabels).map((kind, index) => ({
    key: String(index), kind: kind as InterventionKind, title: `Caz concret ${index}`, context: 'Filiala Cluj',
    priority: index === 0 ? 'critical' : 'high', dueAt: '2026-10-09T12:00:00Z',
    href: index === 0 ? '/admin/volunteers?selected=5' : '/admin/organizations?selected=cluj',
  })),
  counts: Object.fromEntries(Object.keys(interventionLabels).map((kind) => [kind, 4])),
  expiryCoverage: { tracked: 3, missing: 4, windowDays: 30 },
}
function renderPanel(entry = '/admin/dashboard') {
  const auth: AuthContextValue = { user: { id: '1', role: 'PRESEDINTE', fullName: 'Președinte', email: 'p@example.test' }, loading: false, signin: vi.fn(), signout: vi.fn(), reload: vi.fn() }
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AuthContext.Provider value={auth}>
    <MemoryRouter initialEntries={[entry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><InterventionsPanel /></MemoryRouter>
  </AuthContext.Provider></QueryClientProvider>)
}

describe('presidential intervention list', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(apiGet).mockImplementation(async (path) => ({ ok: true, data: path.includes('/expirations') ? { rows: [{ source: 'document', id: '7', title: 'Document operațional', expiresOn: null }], total: 1, canManage: true } : data }))
    vi.mocked(apiPatch).mockResolvedValue({ ok: true, data: {} })
  })
  it('shows six types, concrete cases, priority, deadlines and deep links', async () => {
    renderPanel()
    expect(await screen.findByText('Caz concret 0')).toBeInTheDocument()
    expect(screen.getByText('Urgent')).toBeInTheDocument()
    for (const label of Object.values(interventionLabels)) expect(screen.getByRole('option', { name: `${label} (4)` })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Deschide înregistrarea' })[0]).toHaveAttribute('href', '/admin/volunteers?selected=5')
    expect(screen.getByText(/Fără termen înregistrat: 4/)).toBeInTheDocument()
  })
  it('paginates and resets to the first page when changing category', async () => {
    const user = userEvent.setup(); renderPanel()
    await user.click(await screen.findByRole('button', { name: 'Următoarele intervenții' }))
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith(expect.stringContaining('offset=20'), { auth: true }))
    await user.selectOptions(screen.getByLabelText('Tip de intervenție'), 'unreviewed_reports')
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/api/admin/executive-dashboard/interventions?limit=20&offset=0&kind=unreviewed_reports', { auth: true }))
  })
  it('does not claim there are no interventions after a failed request', async () => {
    vi.mocked(apiGet).mockResolvedValue({ ok: false, error: { message: 'Serviciu indisponibil' } }); renderPanel()
    expect(await screen.findByRole('alert')).toHaveTextContent('Lista nu poate fi considerată fără restanțe')
    expect(screen.queryByText(/Nu există intervenții/)).not.toBeInTheDocument()
  })
  it('shows a genuine empty queue while still disclosing untracked expiration dates', async () => {
    vi.mocked(apiGet).mockResolvedValue({ ok: true, data: { ...data, rows: [], total: 0 } }); renderPanel()
    expect(await screen.findByText(/Nu există intervenții pentru criteriile urmărite/)).toBeInTheDocument()
    expect(screen.getByText(/Cele fără termen nu sunt evaluate/)).toBeInTheDocument()
  })
  it('opens an expiration deep link and writes explicit dates with optimistic concurrency', async () => {
    const user = userEvent.setup(); renderPanel('/admin/dashboard?expiry=document%3A7')
    const field = await screen.findByLabelText('Data expirării pentru Document operațional')
    fireEvent.change(field, { target: { value: '2026-11-01' } })
    await user.click(screen.getByRole('button', { name: 'Salvează termenul' }))
    expect(apiPatch).toHaveBeenCalledWith('/api/admin/executive-dashboard/expirations/document/7', { expiresOn: '2026-11-01', expectedExpiresOn: null }, { auth: true })
    await waitFor(() => expect(vi.mocked(apiGet).mock.calls.filter(([path]) => path.includes('/interventions')).length).toBeGreaterThan(1))
  })
  it('keeps the date draft visible after a conflicting edit', async () => {
    vi.mocked(apiPatch).mockResolvedValue({ ok: false, error: { message: 'Termen modificat între timp' } })
    const user = userEvent.setup(); renderPanel('/admin/dashboard?expiry=document%3A7')
    const field = await screen.findByLabelText('Data expirării pentru Document operațional')
    fireEvent.change(field, { target: { value: '2026-11-01' } })
    await user.click(screen.getByRole('button', { name: 'Salvează termenul' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Termen modificat între timp')
    expect(field).toHaveValue('2026-11-01')
  })
})
