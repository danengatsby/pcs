import { callOpenApiData, openApiClients } from '@lib/openapi'
import type { VolunteerOwnerOption } from '../types'

export async function getVolunteerOwners(): Promise<VolunteerOwnerOption[]> {
  const response = await callOpenApiData(() => openApiClients.adminVolunteers.listAdminVolunteerOwners())

  if (!response.ok) {
    throw new Error(response.error.message)
  }

  return response.data
}
