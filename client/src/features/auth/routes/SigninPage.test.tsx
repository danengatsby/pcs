import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue, type AuthSessionResult } from '../context'
import type { Role } from '../types'
import { SigninPage } from './SigninPage'

function signinSuccess(role: Role): AuthSessionResult {
  return {
    ok: true,
    data: {
      message: 'Autentificare reușită.',
      user: { id: '1', email: 'user@example.test', fullName: 'Utilizator Test', role },
      token: 'access-token',
      tokenType: 'Bearer',
      expiresInSeconds: 3600,
      accessTokenExpiresAt: '2026-09-02T20:00:00.000Z',
    },
  }
}

function renderSigninPage(auth: Partial<AuthContextValue>) {
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
      <MemoryRouter
        initialEntries={['/auth/signin']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/auth/signin" element={<SigninPage />} />
          <Route path="/profil" element={<div>Profil utilizator</div>} />
          <Route path="/admin" element={<div>Administrare PCS</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('SigninPage', () => {
  it('shows a loading state while auth is loading', () => {
    renderSigninPage({ loading: true })

    expect(screen.getByText('Se încarcă...')).toBeInTheDocument()
  })

  it('opens the administrative workspace directly for an existing admin session', () => {
    renderSigninPage({
      user: {
        id: '1',
        email: 'admin@example.test',
        fullName: 'Admin Test',
        role: 'PRESEDINTE',
      },
    })

    expect(screen.getByText('Administrare PCS')).toBeInTheDocument()
  })

  it('keeps direct public entry available for a signed-in non-admin user', () => {
    renderSigninPage({
      user: {
        id: '1',
        email: 'user@example.test',
        fullName: 'User Test',
        role: 'ADERENT',
      },
    })

    expect(screen.getByRole('button', { name: 'Intră direct ca administrator' })).toBeInTheDocument()
  })

  it('renders the login form when no user is authenticated', () => {
    renderSigninPage({ user: null })

    expect(screen.getByRole('heading', { name: 'Autentificare' })).toBeInTheDocument()
    expect(screen.getByLabelText('Utilizator')).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('Utilizator')).toHaveAttribute('autocomplete', 'username')
    expect(screen.getByLabelText('Parolă')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Autentificare' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Autentificare ca admin' })).toBeInTheDocument()
  })

  it('authenticates an administrator only with the entered personal credentials', async () => {
    const user = userEvent.setup()
    const signin = vi.fn(async () => signinSuccess('PRESEDINTE'))
    renderSigninPage({ signin })

    await user.type(screen.getByLabelText('Utilizator'), 'alt-utilizator')
    await user.type(screen.getByLabelText('Parolă'), 'ParolaSigura#2026')
    await user.click(screen.getByRole('button', { name: 'Autentificare ca admin' }))

    expect(signin).toHaveBeenCalledWith({
      email: 'alt-utilizator',
      password: 'ParolaSigura#2026',
    })
    expect(signin).toHaveBeenCalledOnce()
    expect(await screen.findByText('Administrare PCS')).toBeInTheDocument()
  })

  it('keeps ordinary signin tied to the entered credentials without a fallback', async () => {
    const user = userEvent.setup()
    const signin = vi.fn(async () => ({
      ok: false as const,
      status: 401,
      error: { code: 'INVALID_CREDENTIALS', message: 'Date de autentificare invalide.' },
    }))
    renderSigninPage({ signin })

    await user.type(screen.getByLabelText('Utilizator'), 'cont-personal')
    await user.type(screen.getByLabelText('Parolă'), 'ParolaGresita')
    await user.click(screen.getByRole('button', { name: 'Autentificare', exact: true }))

    expect(signin).toHaveBeenCalledExactlyOnceWith({ email: 'cont-personal', password: 'ParolaGresita' })
    expect(await screen.findByRole('alert')).toHaveTextContent('Date de autentificare invalide.')
    expect(screen.getByRole('button', { name: 'Autentificare ca admin' })).toBeEnabled()
  })

  it('requires a second factor before opening the administrative workspace', async () => {
    const user = userEvent.setup()
    const signin = vi.fn()
      .mockResolvedValueOnce({ ok: false, error: { code: 'AUTH_MFA_REQUIRED', message: 'Introdu codul din aplicație.' } })
      .mockResolvedValueOnce({ ok: false, error: { code: 'AUTH_MFA_INVALID', message: 'Cod invalid sau deja folosit.' } })
      .mockResolvedValueOnce(signinSuccess('PRESEDINTE'))
    renderSigninPage({ signin })
    await user.type(screen.getByLabelText('Utilizator'), 'personal@example.test')
    await user.type(screen.getByLabelText('Parolă'), 'ParolaSigura#2026')
    await user.click(screen.getByRole('button', { name: 'Autentificare ca admin' }))
    expect(screen.queryByText('Administrare PCS')).not.toBeInTheDocument()
    const code = await screen.findByLabelText('Cod din aplicația de autentificare')
    expect(code).toHaveAttribute('autocomplete', 'one-time-code')
    await user.type(code, '123456')
    await user.click(screen.getByRole('button', { name: 'Autentificare ca admin' }))
    expect(signin).toHaveBeenLastCalledWith({ email: 'personal@example.test', password: 'ParolaSigura#2026', mfaCode: '123456' })
    expect(code).toHaveValue('')
    await user.type(code, '654321')
    await user.keyboard('{Enter}')
    expect(await screen.findByText('Administrare PCS')).toBeInTheDocument()
    expect(signin).toHaveBeenCalledTimes(3)
  })

  it('rejects admin mode for a non-administrative account and clears the session', async () => {
    const user = userEvent.setup()
    const signout = vi.fn(async () => {})
    renderSigninPage({ signin: vi.fn(async () => signinSuccess('SUSTINATOR')), signout })

    await user.type(screen.getByLabelText('Utilizator'), 'sustinator')
    await user.type(screen.getByLabelText('Parolă'), 'ParolaSigura#2026')
    await user.click(screen.getByRole('button', { name: 'Autentificare ca admin' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Acest cont nu are drepturi administrative PCS.')
    expect(signout).toHaveBeenCalledOnce()
  })

  it('does not submit a shared account when admin is clicked without credentials', async () => {
    const user = userEvent.setup()
    const signin = vi.fn()
    renderSigninPage({ signin })
    await user.click(screen.getByRole('button', { name: 'Autentificare ca admin' }))
    expect(signin).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent('Completează utilizatorul și parola contului personal.')
  })
})
