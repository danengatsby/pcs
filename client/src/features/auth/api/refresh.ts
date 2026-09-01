import { callOpenApiData, openApiClients } from '@lib/openapi'
import type { ApiResponse } from '@lib/http'
import { authStorage } from '@react/shared/auth/authStorage'
import type { AuthSessionResponse } from '../types'

export async function refreshSession(): Promise<ApiResponse<AuthSessionResponse>> {
  const csrfToken = authStorage.getCsrfToken()

  return callOpenApiData(() => openApiClients.authentication.refreshToken({ xCsrfToken: csrfToken ?? '' }))
}
