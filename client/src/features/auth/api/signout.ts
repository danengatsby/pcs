import { callOpenApiData, openApiClients } from '@lib/openapi'
import type { ApiResponse } from '@lib/http'
import { authStorage } from '@react/shared/auth/authStorage'

type SignoutResponse = {
  message: string
}

export async function signoutSession(): Promise<ApiResponse<SignoutResponse>> {
  return callOpenApiData(() => openApiClients.authentication.signoutUser({
    xCsrfToken: authStorage.getCsrfToken() ?? undefined,
  }))
}
