import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '../context'
import { SigninPage } from './SigninPage'

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

  it('redirects admins to the user profile page', () => {
    renderSigninPage({
      user: {
        id: '1',
        email: 'admin@example.test',
        fullName: 'Admin Test',
        role: 'PRESEDINTE',
      },
    })

    expect(screen.getByText('Profil utilizator')).toBeInTheDocument()
  })

  it('redirects non-admin users to the user profile page', () => {
    renderSigninPage({
      user: {
        id: '1',
        email: 'user@example.test',
        fullName: 'User Test',
        role: 'ADERENT',
      },
    })

    expect(screen.getByText('Profil utilizator')).toBeInTheDocument()
  })

  it('renders the login form when no user is authenticated', () => {
    renderSigninPage({ user: null })

    expect(screen.getByRole('heading', { name: 'Autentificare' })).toBeInTheDocument()
    expect(screen.getByLabelText('User / Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Parolă')).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Autentificare' })).toBeInTheDocument()
  })
})
