import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthSessionResponse } from '@features/auth/types'
import { authStorage } from '@react/shared/auth/authStorage'
import { authenticatedFetch } from './authenticatedFetch'
import { apiGet } from './http'
import { openApiClients } from './openapi'

const session = (token = 'renewed-token'): AuthSessionResponse => ({ message: 'ok', token, tokenType: 'Bearer', expiresInSeconds: 900, accessTokenExpiresAt: '2026-09-06T12:00:00Z', csrfToken: `${token}-csrf`, user: { id: '1', fullName: 'Titular test', email: 'titular@example.test', role: 'PRESEDINTE' } })
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
const unauthorized = () => response({ data: null, error: { code: 'AUTH_UNAUTHORIZED', message: 'Token lipsa sau invalid.' } }, 401)
const requestFrom = (input: RequestInfo | URL, init?: RequestInit) => input instanceof Request ? input : new Request(new URL(String(input), window.location.origin), init)
const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => { authStorage.clear(); authStorage.setFromResponse(session('expired-token')); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
afterEach(() => { vi.unstubAllGlobals(); authStorage.clear() })

describe('automatic session renewal', () => {
  it('renews once and preserves a rejected write body and headers', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const req = requestFrom(input, init)
      if (req.url.endsWith('/api/auth/refresh')) return response({ data: session() })
      expect(await req.clone().json()).toEqual({ status: 'validat' })
      expect(req.headers.get('x-request-id')).toBe('operation-1')
      return req.headers.get('Authorization') === 'Bearer expired-token' ? unauthorized() : response({ data: { saved: true } })
    })
    const result = await authenticatedFetch(new Request(`${window.location.origin}/api/admin/volunteers/1/workflow`, { method: 'PATCH', headers: { Authorization: 'Bearer expired-token', 'Content-Type': 'application/json', 'X-Request-Id': 'operation-1' }, body: JSON.stringify({ status: 'validat' }) }))
    expect(result.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(authStorage.getAccessToken()).toBe('renewed-token')
    expect(localStorage.getItem('pcs.auth.session')).toBe(JSON.stringify({ csrfToken: 'renewed-token-csrf' }))
    expect(sessionStorage.getItem('pcs.auth.session')).toBeNull()
  })

  it('shares a single refresh across concurrent HTTP and OpenAPI requests', async () => {
    let releaseRefresh!: () => void
    const wait = new Promise<void>(resolve => { releaseRefresh = resolve })
    fetchMock.mockImplementation(async (input, init) => {
      const req = requestFrom(input, init)
      if (req.url.endsWith('/api/auth/refresh')) { await wait; return response({ data: session() }) }
      return req.headers.get('Authorization') === 'Bearer expired-token' ? unauthorized() : response({ data: [] })
    })
    const requests = [apiGet('/api/admin/access', { auth: true }), openApiClients.adminMembers.listAdminMembersDashboard()]
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    releaseRefresh()
    const [http, openApi] = await Promise.all(requests)
    expect('ok' in http && http.ok).toBe(true)
    expect('response' in openApi && openApi.response.status).toBe(200)
    expect(fetchMock.mock.calls.filter(([input, init]) => requestFrom(input, init).url.endsWith('/api/auth/refresh'))).toHaveLength(1)
  })

  it('reuses an already renewed token when a slower expired request completes', async () => {
    let releaseSlow!: () => void
    const wait = new Promise<void>(resolve => { releaseSlow = resolve })
    fetchMock.mockImplementation(async (input, init) => {
      const req = requestFrom(input, init)
      if (req.url.endsWith('/api/auth/refresh')) return response({ data: session() })
      if (req.headers.get('Authorization') !== 'Bearer expired-token') return response({ data: [] })
      if (req.url.endsWith('/slow')) await wait
      return unauthorized()
    })
    const slow = apiGet('/api/admin/slow', { auth: true })
    expect((await apiGet('/api/admin/fast', { auth: true })).ok).toBe(true)
    releaseSlow()
    expect((await slow).ok).toBe(true)
    expect(fetchMock.mock.calls.filter(([input, init]) => requestFrom(input, init).url.endsWith('/api/auth/refresh'))).toHaveLength(1)
  })

  it('clears an expired MFA session and does not enter a refresh loop', async () => {
    fetchMock.mockResolvedValue(unauthorized())
    const onChange = vi.fn()
    const unsubscribe = authStorage.subscribe(onChange)
    try {
      expect((await apiGet('/api/admin/access', { auth: true })).ok).toBe(false)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(authStorage.getAccessToken()).toBeNull()
      expect(authStorage.getCsrfToken()).toBeNull()
      expect(onChange).toHaveBeenCalledWith(null)
    } finally { unsubscribe() }
  })

  it('never retries permission denials or public/authentication requests', async () => {
    fetchMock.mockImplementation(async () => response({ error: { message: 'Denied' } }, 403))
    await apiGet('/api/admin/access', { auth: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    fetchMock.mockImplementation(async () => unauthorized())
    await authenticatedFetch('/api/auth/signin', { method: 'POST', body: JSON.stringify({ email: 'titular@example.test', password: 'ExampleOnly#2026' }) })
    await authenticatedFetch('https://outside.example/api/private', { headers: { Authorization: 'Bearer expired-token' } })
    await apiGet('/api/news')
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(authStorage.getAccessToken()).toBe('expired-token')
  })

  it('does not restore a signed out account or repeat its write after a late refresh', async () => {
    let releaseRefresh!: () => void
    const wait = new Promise<void>(resolve => { releaseRefresh = resolve })
    fetchMock.mockImplementation(async (input, init) => {
      if (requestFrom(input, init).url.endsWith('/api/auth/refresh')) { await wait; return response({ data: session() }) }
      return unauthorized()
    })
    const pending = apiGet('/api/admin/access', { auth: true })
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    authStorage.clear()
    releaseRefresh()
    await pending
    expect(authStorage.getAccessToken()).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps the session available after a temporary refresh failure', async () => {
    fetchMock.mockImplementation(async (input, init) => requestFrom(input, init).url.endsWith('/api/auth/refresh') ? response({ error: { message: 'Unavailable' } }, 503) : unauthorized())
    await apiGet('/api/admin/access', { auth: true })
    expect(authStorage.getAccessToken()).toBe('expired-token')
    expect(authStorage.getCsrfToken()).toBe('expired-token-csrf')
  })
})
