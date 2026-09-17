import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { apiPost } from '@lib/http'
import { captureAdminActivationToken, clearAdminActivationToken, readAdminActivationToken } from '@lib/adminActivationToken'
import { authStorage } from '@react/shared/auth/authStorage'
import { AdminActivationPage } from './AdminActivationPage'

const { reload } = vi.hoisted(() => ({ reload: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@lib/http', () => ({ apiPost: vi.fn() }))
vi.mock('../context', () => ({ useAuth: () => ({ reload }) }))
const token = 'a'.repeat(43)
const enrollment = { fullName: 'Titular nominal', email: 'titular@example.test', secret: 'JBSWY3DPEHPK3PXP', qrDataUrl: 'data:image/png;base64,iVBORw0KGgo=', expiresAt: '2026-09-07T12:00:00Z' }
function mount() { render(<MemoryRouter initialEntries={['/auth/activate']}><Routes><Route path="/auth/activate" element={<AdminActivationPage />} /><Route path="/admin" element={<h1>Spațiu administrativ</h1>} /></Routes></MemoryRouter>) }
beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState(null, '', `/auth/activate#${token}`)
  captureAdminActivationToken()
  vi.mocked(apiPost).mockResolvedValue({ ok: true, data: enrollment })
})
afterEach(() => { cleanup(); clearAdminActivationToken(); authStorage.clear(); window.history.replaceState(null, '', '/') })

describe('initial administrator activation', () => {
  it('shows setup, chooses the password and enters the workspace with the first code', async () => {
    mount()
    expect(await screen.findByAltText('Cod QR pentru configurarea autentificării PCS')).toHaveAttribute('src', enrollment.qrDataUrl)
    expect(screen.getByLabelText('Email')).toHaveValue(enrollment.email)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('1. Alege parola'), 'ParolaPersonala#2026')
    await user.type(screen.getByLabelText('3. Introdu codul de 6 cifre'), '123456')
    vi.mocked(apiPost).mockResolvedValueOnce({ ok: true, data: { token: 'test-access-token', csrfToken: 'test-csrf', user: { id: '1', fullName: enrollment.fullName, email: enrollment.email, role: 'PRESEDINTE' } } })
    await user.click(screen.getByRole('button', { name: 'Activează și intră în cont' }))
    expect(await screen.findByText('Spațiu administrativ')).toBeInTheDocument()
    expect(apiPost).toHaveBeenLastCalledWith('/api/auth/admin-activation/complete', { token, password: 'ParolaPersonala#2026', mfaCode: '123456' })
    expect(reload).toHaveBeenCalledOnce()
    expect(readAdminActivationToken()).toBe('')
    expect(JSON.stringify(sessionStorage)).not.toContain(token)
    expect(JSON.stringify(localStorage)).not.toContain(enrollment.secret)
  })
  it('keeps the chosen password and asks for a new code after an invalid TOTP', async () => {
    mount()
    const password = await screen.findByLabelText('1. Alege parola')
    const user = userEvent.setup()
    await user.type(password, 'ParolaPersonala#2026')
    await user.type(screen.getByLabelText('3. Introdu codul de 6 cifre'), '123456')
    vi.mocked(apiPost).mockResolvedValueOnce({ ok: false, error: { code: 'AUTH_MFA_INVALID', message: 'Introdu codul curent.' } })
    await user.click(screen.getByRole('button', { name: 'Activează și intră în cont' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Introdu codul curent.')
    expect(password).toHaveValue('ParolaPersonala#2026')
    expect(screen.getByLabelText('3. Introdu codul de 6 cifre')).toHaveValue('')
    expect(reload).not.toHaveBeenCalled()
  })
  it('does not expose setup for an expired invitation', async () => {
    vi.mocked(apiPost).mockResolvedValueOnce({ ok: false, error: { code: 'AUTH_ACTIVATION_INVALID', message: 'Linkul a expirat.' } })
    mount()
    expect(await screen.findByRole('alert')).toHaveTextContent('Linkul a expirat.')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('1. Alege parola')).not.toBeInTheDocument()
  })
  it('makes no activation request without a personal link', async () => {
    clearAdminActivationToken()
    mount()
    expect(screen.getByRole('alert')).toHaveTextContent('Deschide linkul personal')
    await waitFor(() => expect(apiPost).not.toHaveBeenCalled())
  })
})
