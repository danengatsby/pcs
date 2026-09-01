import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@features/auth/context'
import { UserProfilePage } from './UserProfilePage'

function renderUserProfile(auth: Partial<AuthContextValue>) {
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
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <UserProfilePage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('UserProfilePage', () => {
  it('renders personalized user data', () => {
    renderUserProfile({
      user: {
        id: '42',
        email: 'user@example.test',
        fullName: 'User Test',
        role: 'ADERENT',
      },
    })

    expect(screen.getByRole('heading', { name: 'Bun venit, User Test' })).toBeInTheDocument()
    expect(screen.getByText('user@example.test')).toBeInTheDocument()
    expect(screen.getByText('Aderent')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('shows admin shortcuts for users with administrative access', () => {
    renderUserProfile({
      user: {
        id: '1',
        email: 'admin@example.test',
        fullName: 'Admin Test',
        role: 'PRESEDINTE',
      },
    })

    expect(screen.getByRole('link', { name: 'Zona administrativă' })).toHaveAttribute('href', '/admin/volunteers')
    expect(screen.getByRole('link', { name: 'Deschide dashboard membri →' })).toHaveAttribute(
      'href',
      '/admin/members',
    )
  })
})
