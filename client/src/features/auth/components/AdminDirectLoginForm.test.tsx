import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { apiPost } from '@lib/http'
import { authStorage } from '@react/shared/auth/authStorage'
import { AdminDirectLoginForm } from './AdminDirectLoginForm'

const { reload } = vi.hoisted(() => ({ reload: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@lib/http', () => ({ apiPost: vi.fn() }))
vi.mock('../context', () => ({ useAuth: () => ({ reload }) }))
const change = vi.fn()
function mount() { return render(<StrictMode><MemoryRouter initialEntries={['/auth/signin']}><Routes>
  <Route path="/auth/signin" element={<AdminDirectLoginForm onAuthenticatingChange={change} />} />
  <Route path="/admin" element={<h1>Administrare PCS</h1>} />
</Routes></MemoryRouter></StrictMode>) }
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(apiPost).mockResolvedValue({ ok: true, data: { token: 'public-access-token', csrfToken: 'csrf', user: { id: '1', fullName: 'Administrator public PCS', email: 'administrator-public@pcs.invalid', role: 'PRESEDINTE' } } })
})
afterEach(() => { cleanup(); authStorage.clear() })

describe('public administrative entry', () => {
  it('enters on the first click without asking for any credentials or link', async () => {
    mount()
    expect(apiPost).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Intră direct ca administrator' }))
    expect(await screen.findByText('Administrare PCS')).toBeInTheDocument()
    expect(apiPost).toHaveBeenCalledExactlyOnceWith('/api/auth/admin-public-login', {})
    expect(change).toHaveBeenCalledWith(true)
    expect(change).toHaveBeenLastCalledWith(false)
    expect(authStorage.getAccessToken()).toBe('public-access-token')
    expect(JSON.stringify({ local: localStorage, session: sessionStorage })).not.toContain('public-access-token')
  })

  it('shows a server error and lets the visitor retry without introducing a link field', async () => {
    vi.mocked(apiPost).mockResolvedValueOnce({ ok: false, error: { message: 'Serviciul nu este disponibil momentan.' } })
    mount()
    await userEvent.click(screen.getByRole('button', { name: 'Intră direct ca administrator' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Serviciul nu este disponibil momentan.')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(reload).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Intră direct ca administrator' }))
    expect(await screen.findByText('Administrare PCS')).toBeInTheDocument()
  })

  it('does not navigate if the returned account lacks administrative rights', async () => {
    vi.mocked(apiPost).mockResolvedValueOnce({ ok: true, data: { token: 'ordinary-token', user: { id: '2', role: 'MEMBRU' } } })
    mount()
    await userEvent.click(screen.getByRole('button', { name: 'Intră direct ca administrator' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Accesul administrativ nu este disponibil.')
    expect(reload).not.toHaveBeenCalled()
    expect(authStorage.getAccessToken()).toBeNull()
  })
})
