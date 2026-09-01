import createClient from 'openapi-fetch'
import { authStorage } from '@react/shared/auth/authStorage'
import type { components, paths } from '../generated/openapi/schema'
import type { ApiEnvelopeResponse, ApiResponse } from './http'

type OpenApiMeta = components['schemas']['ApiMeta']
type OpenApiEnvelope<T, M = OpenApiMeta> = {
  data: T
  error?: unknown
  meta?: M
}

type OpenApiResult<T, M = OpenApiMeta> =
  | {
      data: OpenApiEnvelope<T, M>
      error?: never
      response: Response
    }
  | {
      data?: never
      error: unknown
      response: Response
    }

const apiBaseUrl = typeof window === 'undefined'
  ? 'http://localhost/api'
  : new URL('/api', window.location.origin).toString()

const client = createClient<paths>({
  baseUrl: apiBaseUrl,
  credentials: 'include',
  fetch: (request) => globalThis.fetch(request),
  headers: {
    Accept: 'application/json',
  },
})

client.use({
  onRequest({ request }) {
    const accessToken = authStorage.getAccessToken()

    if (accessToken) {
      request.headers.set('Authorization', `Bearer ${accessToken}`)
    }

    return request
  },
})

export const openApiClients = {
  adminMembers: {
    listAdminMembersDashboard(query: { search?: string; limit?: number } = {}) {
      const compactQuery = compactObject(query)

      if (Object.keys(compactQuery).length === 0) {
        return client.GET('/admin/members/dashboard')
      }

      return client.GET('/admin/members/dashboard', {
        params: {
          query: compactQuery,
        },
      })
    },
  },
  adminVolunteers: {
    listAdminVolunteerOwners() {
      return client.GET('/admin/volunteers/owners')
    },
  },
  authentication: {
    getAuthPolicy() {
      return client.GET('/auth/policy')
    },
    getCurrentUser() {
      return client.GET('/auth/me')
    },
    refreshToken({ xCsrfToken }: { xCsrfToken: string }) {
      return client.POST('/auth/refresh', {
        params: {
          header: {
            'x-csrf-token': xCsrfToken,
          },
        },
      })
    },
    signinUser({ authSigninInput }: { authSigninInput: components['schemas']['AuthSigninInput'] }) {
      return client.POST('/auth/signin', {
        body: authSigninInput,
      })
    },
    signoutUser({ xCsrfToken }: { xCsrfToken?: string } = {}) {
      if (!xCsrfToken) {
        return client.POST('/auth/signout')
      }

      return client.POST('/auth/signout', {
        params: {
          header: {
            'x-csrf-token': xCsrfToken,
          },
        },
      })
    },
  },
  meta: {
    getCountiesMetadata() {
      return client.GET('/meta/counties')
    },
  },
  volunteers: {
    createVolunteer({ volunteerSignupInput }: { volunteerSignupInput: components['schemas']['VolunteerSignupInput'] }) {
      return client.POST('/volunteers', {
        body: volunteerSignupInput,
      })
    },
  },
} as const

export async function callOpenApiData<T, M = OpenApiMeta>(
  request: () => Promise<OpenApiResult<T, M>>,
): Promise<ApiResponse<T>> {
  const response = await callOpenApiEnvelope<T, M>(request)

  if (!response.ok) {
    return response
  }

  return {
    ok: true,
    data: response.data,
  }
}

export async function callOpenApiEnvelope<T, M = OpenApiMeta>(
  request: () => Promise<OpenApiResult<T, M>>,
): Promise<ApiEnvelopeResponse<T, M>> {
  try {
    const response = await request()

    if (!hasOpenApiSuccessData(response)) {
      return {
        ok: false,
        error: {
          message: readErrorMessage(response.error, response.response.status),
          status: response.response.status,
          code: readErrorCode(response.error),
        },
      }
    }

    return {
      ok: true,
      data: response.data.data,
      meta: response.data.meta,
    }
  } catch (error) {
    return {
      ok: false,
      error: {
        message: error instanceof Error ? error.message : 'Network error',
      },
    }
  }
}

function compactObject<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ''),
  ) as Partial<T>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readErrorMessage(raw: unknown, status: number): string {
  if (isRecord(raw) && isRecord(raw.error) && typeof raw.error.message === 'string') {
    return raw.error.message
  }

  return `HTTP ${status}`
}

function readErrorCode(raw: unknown): string | undefined {
  if (isRecord(raw) && isRecord(raw.error) && typeof raw.error.code === 'string') {
    return raw.error.code
  }

  return undefined
}

export type AuthPolicyData = components['schemas']['AuthPolicyData']
export type AuthTokenPolicy = components['schemas']['AuthTokenPolicy']
export type UserRole = components['schemas']['UserRole']

function hasOpenApiSuccessData<T, M>(
  response: OpenApiResult<T, M>,
): response is Extract<OpenApiResult<T, M>, { data: OpenApiEnvelope<T, M> }> {
  return response.data !== undefined
}
