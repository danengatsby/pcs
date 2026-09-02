import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthContextValue } from '@features/auth/context'
import { SiteHeader } from './SiteHeader'

function renderHeader() {
  const auth: AuthContextValue = {
    user: null,
    loading: false,
    signin: vi.fn(),
    reload: vi.fn(),
    signout: vi.fn(),
  }

  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SiteHeader />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('SiteHeader mobile menu', () => {
  it('opens from one accessible control and closes after navigation', async () => {
    const user = userEvent.setup()
    renderHeader()

    const menuButton = screen.getByRole('button', { name: 'Meniu' })
    const navigation = screen.getByRole('navigation', { name: 'Meniu principal' })

    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    expect(menuButton).toHaveAttribute('aria-controls', 'primary-navigation')
    expect(navigation).not.toHaveClass('is-mobile-open')

    await user.click(menuButton)

    expect(menuButton).toHaveAccessibleName('Închide')
    expect(menuButton).toHaveAttribute('aria-expanded', 'true')
    expect(navigation).toHaveClass('is-mobile-open')

    await user.click(screen.getByRole('link', { name: 'Program politic' }))

    expect(menuButton).toHaveAccessibleName('Meniu')
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    expect(navigation).not.toHaveClass('is-mobile-open')
  })

  it('closes the open menu with Escape', async () => {
    const user = userEvent.setup()
    renderHeader()

    const menuButton = screen.getByRole('button', { name: 'Meniu' })
    await user.click(menuButton)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(menuButton).toHaveAccessibleName('Meniu')
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
  })
})
