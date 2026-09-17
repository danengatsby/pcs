import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { apiPost } from '@lib/http'
import { captureAdminDirectLoginToken, clearAdminDirectLoginToken } from '@lib/adminDirectLogin'
import { authStorage } from '@react/shared/auth/authStorage'
import { AdminDirectLoginPage } from './AdminDirectLoginPage'

const { reload } = vi.hoisted(() => ({ reload: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@lib/http', () => ({ apiPost: vi.fn() }))
vi.mock('../context', () => ({ useAuth: () => ({ reload }) }))
const token = 'd'.repeat(43)
function mount() { render(<StrictMode><MemoryRouter initialEntries={['/auth/direct']}><Routes><Route path="/auth/direct" element={<AdminDirectLoginPage />} /><Route path="/admin" element={<h1>Spațiu administrativ</h1>} /></Routes></MemoryRouter></StrictMode>) }
beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState(null, '', `/auth/direct#${token}`)
  captureAdminDirectLoginToken()
})
afterEach(() => { cleanup(); clearAdminDirectLoginToken(); authStorage.clear(); window.history.replaceState(null, '', '/') })

describe('direct personal login', () => {
  it('opens administration automatically and consumes once under StrictMode without a password or code', async () => {
    vi.mocked(apiPost).mockResolvedValue({ ok: true, data: { token: 'access-token', csrfToken: 'csrf', user: { id: '1', fullName: 'Titular nominal', email: 'titular@example.test', role: 'PRESEDINTE' } } })
    mount()
    expect(await screen.findByText('Spațiu administrativ')).toBeInTheDocument()
    expect(apiPost).toHaveBeenCalledExactlyOnceWith('/api/auth/admin-direct-login', { token })
    expect(reload).toHaveBeenCalledOnce()
    expect(window.location.hash).toBe('')
    expect(JSON.stringify({ local: localStorage, session: sessionStorage })).not.toContain(token)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
  it('shows an expired-link error without retrying a consumed capability', async () => {
    vi.mocked(apiPost).mockResolvedValue({ ok: false, error: { code: 'AUTH_DIRECT_LOGIN_INVALID', message: 'Linkul a expirat.' } })
    mount()
    expect(await screen.findByRole('alert')).toHaveTextContent('Linkul a expirat.')
    expect(apiPost).toHaveBeenCalledOnce()
    expect(reload).not.toHaveBeenCalled()
  })
  it('never initiates login from a missing or malformed link', () => {
    window.history.replaceState(null, '', '/auth/direct?token=bad#invalid')
    captureAdminDirectLoginToken()
    mount()
    expect(screen.getByRole('alert')).toHaveTextContent('Deschide linkul personal')
    expect(apiPost).not.toHaveBeenCalled()
    expect(window.location.search).toBe('')
    expect(window.location.hash).toBe('')
  })
})
