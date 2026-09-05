import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { submitJoin, type SubmitJoinRequest } from './submitJoin'

describe('submitJoin', () => {
  const fetchMock = vi.fn()
  const payload: SubmitJoinRequest = {
    fullName: 'Volunteer Test',
    email: 'volunteer@example.test',
    password: 'StrongPass123!',
    county: 'Cluj',
    locality: 'Cluj-Napoca',
    motivation: 'Vreau sa ajut.',
    website: '',
  }

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the created volunteer id for a valid response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { id: 101 } }))

    await expect(submitJoin(payload)).resolves.toEqual({ id: 101 })
  })

  it('maps duplicate email errors to a user-friendly message', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            message: 'Email already exists.',
            code: 'VOLUNTEER_EMAIL_EXISTS',
          },
        },
        { status: 409 },
      ),
    )

    await expect(submitJoin(payload)).rejects.toThrow('Există deja o cerere/înscriere cu acest email.')
  })

  it('keeps the server message when signup is rate limited', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            message: 'Prea multe solicitări. Încearcă din nou peste câteva minute.',
            code: 'RATE_LIMITED',
          },
        },
        { status: 429 },
      ),
    )

    await expect(submitJoin(payload)).rejects.toThrow('Prea multe solicitări. Încearcă din nou peste câteva minute.')
  })

  it('rejects invalid success payloads', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { ok: true } }))

    await expect(submitJoin(payload)).rejects.toThrow('Răspuns invalid de la server.')
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
