import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@features/auth/context'
import { RequireAuth } from './RequireAuth'

function renderWithAuth(auth: Partial<AuthContextValue>, initialEntry = '/profil') {
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
        initialEntries={[initialEntry]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route
            path="/profil"
            element={(
              <RequireAuth>
                <div>Profil utilizator</div>
              </RequireAuth>
            )}
          />
          <Route path="/auth/signin" element={<div>Autentificare</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('RequireAuth', () => {
  it('shows a loading state while auth is being restored', () => {
    renderWithAuth({ loading: true })

    expect(screen.getByText('Se încarcă...')).toBeInTheDocument()
  })

  it('redirects anonymous users to the signin page', () => {
    renderWithAuth({ user: null })

    expect(screen.getByText('Autentificare')).toBeInTheDocument()
  })

  it('renders the protected content for authenticated users', () => {
    renderWithAuth({
      user: {
        id: '1',
        email: 'user@example.test',
        fullName: 'User Test',
        role: 'ADERENT',
      },
    })

    expect(screen.getByText('Profil utilizator')).toBeInTheDocument()
  })
})
