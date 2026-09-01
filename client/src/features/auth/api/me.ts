import { callOpenApiData, openApiClients } from '@lib/openapi'
import type { ApiResponse } from '@lib/http'
import type { AuthUser } from '../types'

export type MeResponse = {
  user: AuthUser
}

export async function getMe(): Promise<ApiResponse<MeResponse>> {
  return callOpenApiData(() => openApiClients.authentication.getCurrentUser())
}
