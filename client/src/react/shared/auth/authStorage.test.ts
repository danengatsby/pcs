import { beforeEach, describe, expect, it } from 'vitest'
import { authStorage } from './authStorage'

describe('authStorage', () => {
  beforeEach(() => {
    authStorage.clear()
    sessionStorage.clear()
    localStorage.clear()
  })

  it('stores the access token only in memory and the csrf token in session storage', () => {
    authStorage.setFromResponse({
      message: 'ok',
      token: 'access-token',
      tokenType: 'Bearer',
      expiresInSeconds: 900,
      accessTokenExpiresAt: '2026-04-02T12:00:00.000Z',
      csrfToken: 'csrf-token',
      user: {
        id: '1',
        email: 'admin@example.test',
        fullName: 'Admin Test',
        role: 'PRESEDINTE',
      },
    })

    expect(authStorage.getAccessToken()).toBe('access-token')
    expect(authStorage.getCsrfToken()).toBe('csrf-token')
    expect(sessionStorage.getItem('pcp.auth.session')).toBe(JSON.stringify({ csrfToken: 'csrf-token' }))
    expect(localStorage.getItem('pcp.auth.session')).toBeNull()
  })

  it('migrates a legacy localStorage session into sessionStorage', () => {
    localStorage.setItem('pcp.auth.session', JSON.stringify({ csrfToken: 'legacy-csrf' }))

    expect(authStorage.get()).toEqual({ csrfToken: 'legacy-csrf' })
    expect(sessionStorage.getItem('pcp.auth.session')).toBe(JSON.stringify({ csrfToken: 'legacy-csrf' }))
    expect(localStorage.getItem('pcp.auth.session')).toBeNull()
  })
})
