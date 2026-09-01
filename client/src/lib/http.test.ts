import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authStorage } from '../react/shared/auth/authStorage'
import { apiGet, apiGetEnvelope, apiPatch, apiPost } from './http'

describe('http', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    authStorage.clear()
    sessionStorage.clear()
    localStorage.clear()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('unwraps envelope data and applies the parser for apiGet', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: ['Cluj', 'Alba'] }))

    const res = await apiGet<string[]>('/api/meta/counties', {
      parse: readStringArray,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/meta/counties',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      }),
    )

    expect(res).toEqual({
      ok: true,
      data: ['Cluj', 'Alba'],
    })
  })

  it('includes auth and csrf headers for apiPost requests', async () => {
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

    fetchMock.mockResolvedValue(jsonResponse({ data: { message: 'signed out' } }))

    await apiPost('/api/auth/signout', {}, { auth: true, csrf: true })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/signout',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: '{}',
        headers: expect.objectContaining({
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: 'Bearer access-token',
          'X-CSRF-Token': 'csrf-token',
        }),
      }),
    )
  })

  it('returns both data and meta for apiGetEnvelope', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        data: [{ id: 1 }],
        meta: {
          mode: 'offset',
          count: 1,
          total: 1,
          limit: 50,
          offset: 0,
        },
      }),
    )

    const res = await apiGetEnvelope<{ id: number }[], { total: number }>('/api/admin/volunteers')

    expect(res).toEqual({
      ok: true,
      data: [{ id: 1 }],
      meta: {
        mode: 'offset',
        count: 1,
        total: 1,
        limit: 50,
        offset: 0,
      },
    })
  })

  it('surfaces server error message and code for failed requests', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            message: 'Nu ai acces.',
            code: 'AUTH_FORBIDDEN',
          },
        },
        { status: 403 },
      ),
    )

    const res = await apiPatch('/api/admin/volunteers/1/workflow', { status: 'activ' })

    expect(res).toEqual({
      ok: false,
      error: {
        message: 'Nu ai acces.',
        status: 403,
        code: 'AUTH_FORBIDDEN',
      },
    })
  })

  it('allows empty JSON bodies for no-content responses', async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 204,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    )

    const res = await apiGet<undefined>('/api/auth/signout')

    expect(res).toEqual({
      ok: true,
      data: undefined,
    })
  })

  it('returns a clear error for unexpected empty JSON bodies', async () => {
    fetchMock.mockResolvedValue(
      new Response('', {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    )

    const res = await apiGet('/api/news')

    expect(res).toEqual({
      ok: false,
      error: {
        message: 'Empty JSON response from /api/news',
      },
    })
  })

  it('returns a clear error for invalid JSON bodies', async () => {
    fetchMock.mockResolvedValue(
      new Response('{', {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    )

    const res = await apiGet('/api/news')

    expect(res).toEqual({
      ok: false,
      error: {
        message: 'Invalid JSON response from /api/news',
      },
    })
  })
})

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error('Invalid string array')
  }

  return value
}
