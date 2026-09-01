import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSignin } from './useSignin'
import { useAuth, type AuthContextValue, type AuthSessionResult } from '../context'
import { createWrapper, buildUser } from '@test/testUtils'

vi.mock('../context', () => ({
  useAuth: vi.fn(),
}))

function buildSigninSuccessResult(): AuthSessionResult {
  return {
    ok: true,
    data: {
      message: 'Autentificare reusita.',
      user: buildUser(),
      token: 'at-123',
      tokenType: 'Bearer',
      expiresInSeconds: 3600,
      accessTokenExpiresAt: '2026-01-01T00:00:00.000Z',
      csrfToken: 'csrf-123',
    },
  }
}

function createAuthContextValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    loading: false,
    signin: async () => buildSigninSuccessResult(),
    reload: async () => {},
    signout: async () => {},
    ...overrides,
  }
}

describe('useSignin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('has idle state initially', () => {
    vi.mocked(useAuth).mockReturnValue(createAuthContextValue())

    const { result } = renderHook(() => useSignin(), {
      wrapper: createWrapper(),
    })

    expect(result.current.state).toEqual({ status: 'idle' })
    expect(result.current.submit).toBeDefined()
    expect(result.current.reset).toBeDefined()
  })

  it('provides reset function', () => {
    vi.mocked(useAuth).mockReturnValue(createAuthContextValue())

    const { result } = renderHook(() => useSignin(), {
      wrapper: createWrapper(),
    })

    result.current.reset()
    expect(result.current.state.status).toBe('idle')
  })

  it('provides submit function', () => {
    const signinMock = vi.fn(async () => buildSigninSuccessResult())

    vi.mocked(useAuth).mockReturnValue(createAuthContextValue({ signin: signinMock }))

    const { result } = renderHook(() => useSignin(), {
      wrapper: createWrapper(),
    })

    expect(result.current.submit).toBeDefined()
    expect(typeof result.current.submit).toBe('function')
  })

  it('calls signin from useAuth context', () => {
    const signinMock = vi.fn(async () => buildSigninSuccessResult())

    vi.mocked(useAuth).mockReturnValue(createAuthContextValue({ signin: signinMock }))

    const { result } = renderHook(() => useSignin(), {
      wrapper: createWrapper(),
    })

    expect(result.current.state.status).toBe('idle')
  })
})
