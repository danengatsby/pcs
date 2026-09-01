import { callOpenApiData, openApiClients } from '@lib/openapi'
import type { ApiResponse } from '@lib/http'
import type { SigninInput, AuthSessionResponse } from '../types'

export async function signin(input: SigninInput): Promise<ApiResponse<AuthSessionResponse>> {
  return callOpenApiData(() => openApiClients.authentication.signinUser({ authSigninInput: input }))
}
