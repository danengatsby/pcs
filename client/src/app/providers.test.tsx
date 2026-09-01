import { act, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '@features/auth/context'
import type { AuthSessionResponse, AuthUser, SigninInput } from '@features/auth/types'
import { getMe } from '@features/auth/api/me'
import { refreshSession } from '@features/auth/api/refresh'
import { signin as signinRequest } from '@features/auth/api/signin'
import { signoutSession } from '@features/auth/api/signout'
import { authStorage } from '@react/shared/auth/authStorage'
import { AppProviders } from './providers'

vi.mock('@features/auth/api/me', () => ({
  getMe: vi.fn(),
}))

vi.mock('@features/auth/api/refresh', () => ({
  refreshSession: vi.fn(),
}))

vi.mock('@features/auth/api/signin', () => ({
  signin: vi.fn(),
}))

vi.mock('@features/auth/api/signout', () => ({
  signoutSession: vi.fn(),
}))

let latestAuth: ReturnType<typeof useAuth> | null = null

describe('AppProviders', () => {
  beforeEach(() => {
    latestAuth = null
    authStorage.clear()
    sessionStorage.clear()
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('restores the user from refresh when a stored csrf token exists', async () => {
    authStorage.set({ csrfToken: 'stored-csrf' })
    vi.mocked(refreshSession).mockResolvedValue({
      ok: true,
      data: buildSessionResponse(),
    })

    renderWithProviders()

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))

    expect(screen.getByTestId('user')).toHaveTextContent('admin@example.test')
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(getMe).not.toHaveBeenCalled()
    expect(authStorage.getAccessToken()).toBe('access-token')
    expect(authStorage.getCsrfToken()).toBe('csrf-token')
  })

  it('falls back from refresh to /me when both csrf and access tokens exist', async () => {
    authStorage.set({ csrfToken: 'stored-csrf' })
    authStorage.setAccessToken('memory-token')
    vi.mocked(refreshSession).mockResolvedValue({
      ok: false,
      error: {
        message: 'Refresh failed.',
        status: 401,
      },
    })
    vi.mocked(getMe).mockResolvedValue({
      ok: true,
      data: {
        user: buildUser(),
      },
    })

    renderWithProviders()

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))

    expect(screen.getByTestId('user')).toHaveTextContent('admin@example.test')
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(getMe).toHaveBeenCalledTimes(1)
    expect(authStorage.getAccessToken()).toBe('memory-token')
    expect(authStorage.getCsrfToken()).toBe('stored-csrf')
  })

  it('falls back to /me when an in-memory access token exists', async () => {
    authStorage.setAccessToken('memory-token')
    vi.mocked(getMe).mockResolvedValue({
      ok: true,
      data: {
        user: buildUser(),
      },
    })

    renderWithProviders()

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))

    expect(screen.getByTestId('user')).toHaveTextContent('admin@example.test')
    expect(refreshSession).not.toHaveBeenCalled()
    expect(getMe).toHaveBeenCalledTimes(1)
  })

  it('clears the stored session when refresh and /me cannot restore the user', async () => {
    authStorage.set({ csrfToken: 'stored-csrf' })
    authStorage.setAccessToken('memory-token')
    vi.mocked(refreshSession).mockResolvedValue({
      ok: false,
      error: {
        message: 'Refresh failed.',
        status: 401,
      },
    })
    vi.mocked(getMe).mockResolvedValue({
      ok: false,
      error: {
        message: 'Unauthorized.',
        status: 401,
      },
    })

    renderWithProviders()

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))

    expect(screen.getByTestId('user')).toHaveTextContent('none')
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(getMe).toHaveBeenCalledTimes(1)
    expect(authStorage.getAccessToken()).toBeNull()
    expect(authStorage.getCsrfToken()).toBeNull()
  })

  it('updates state on signin and clears it on 401 signout', async () => {
    vi.mocked(signinRequest).mockResolvedValue({
      ok: true,
      data: buildSessionResponse(),
    })
    vi.mocked(signoutSession).mockResolvedValue({
      ok: false,
      error: {
        message: 'Session expired.',
        status: 401,
      },
    })

    renderWithProviders()

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'))
    expect(screen.getByTestId('user')).toHaveTextContent('none')
    expect(latestAuth).not.toBeNull()

    await act(async () => {
      await latestAuth!.signin({
        email: 'admin@example.test',
        password: 'StrongPass123!',
      } satisfies SigninInput)
    })

    expect(screen.getByTestId('user')).toHaveTextContent('admin@example.test')
    expect(authStorage.getAccessToken()).toBe('access-token')

    await act(async () => {
      await expect(latestAuth!.signout()).resolves.toBeUndefined()
    })

    expect(screen.getByTestId('user')).toHaveTextContent('none')
    expect(authStorage.getAccessToken()).toBeNull()
    expect(authStorage.getCsrfToken()).toBeNull()
  })
})

function renderWithProviders() {
  return render(
    <AppProviders>
      <AuthProbe />
    </AppProviders>,
  )
}

function AuthProbe() {
  const auth = useAuth()

  useEffect(() => {
    latestAuth = auth
  }, [auth])

  return (
    <div>
      <span data-testid="loading">{String(auth.loading)}</span>
      <span data-testid="user">{auth.user?.email ?? 'none'}</span>
    </div>
  )
}

function buildUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: '1',
    email: 'admin@example.test',
    fullName: 'Admin Test',
    role: 'PRESEDINTE',
    ...overrides,
  }
}

function buildSessionResponse(overrides: Partial<AuthSessionResponse> = {}): AuthSessionResponse {
  return {
    message: 'ok',
    user: buildUser(),
    token: 'access-token',
    tokenType: 'Bearer',
    expiresInSeconds: 900,
    accessTokenExpiresAt: '2026-04-02T12:00:00.000Z',
    csrfToken: 'csrf-token',
    ...overrides,
  }
}
