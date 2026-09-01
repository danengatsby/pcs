import { callOpenApiData, openApiClients, type AuthPolicyData } from '@lib/openapi'

export type AuthPolicy = AuthPolicyData

export async function getAuthPolicy(): Promise<AuthPolicy> {
  const res = await callOpenApiData(() => openApiClients.authentication.getAuthPolicy())

  if (!res.ok) {
    throw new Error(res.error.message)
  }

  return res.data
}
