import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authStorage } from './authStorage'

describe('authStorage', () => {
  beforeEach(() => {
    authStorage.clear()
    sessionStorage.clear()
    localStorage.clear()
  })

  it('stores only the CSRF companion across tabs and keeps the access token in memory', () => {
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
    expect(localStorage.getItem('pcs.auth.session')).toBe(JSON.stringify({ csrfToken: 'csrf-token' }))
    expect(sessionStorage.getItem('pcs.auth.session')).toBeNull()
  })

  it('migrates an existing tab session without copying access tokens', () => {
    sessionStorage.setItem('pcs.auth.session', JSON.stringify({ csrfToken: 'legacy-csrf', token: 'legacy-access-token' }))

    expect(authStorage.get()).toEqual({ csrfToken: 'legacy-csrf' })
    expect(localStorage.getItem('pcs.auth.session')).toBe(JSON.stringify({ csrfToken: 'legacy-csrf' }))
    expect(sessionStorage.getItem('pcs.auth.session')).toBeNull()
  })

  it('reads the latest browser CSRF instead of a stale tab value', () => {
    localStorage.setItem('pcs.auth.session', JSON.stringify({ csrfToken: 'rotated-csrf' }))
    sessionStorage.setItem('pcs.auth.session', JSON.stringify({ csrfToken: 'old-csrf' }))
    expect(authStorage.getCsrfToken()).toBe('rotated-csrf')
    expect(sessionStorage.getItem('pcs.auth.session')).toBeNull()
  })

  it('invalidates the in-memory session after signing out in another tab', () => {
    authStorage.setAccessToken('access-token')
    authStorage.set({ csrfToken: 'csrf-token' })
    const listener = vi.fn()
    const unsubscribe = authStorage.subscribe(listener)
    try {
      localStorage.removeItem('pcs.auth.session')
      window.dispatchEvent(new StorageEvent('storage', { key: 'pcs.auth.session', newValue: null, storageArea: localStorage }))
      expect(authStorage.getAccessToken()).toBeNull()
      expect(authStorage.getCsrfToken()).toBeNull()
      expect(listener).toHaveBeenCalledWith(null)
    } finally { unsubscribe() }
  })
})
