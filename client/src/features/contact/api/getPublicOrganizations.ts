import { apiGetEnvelope, type ApiEnvelopeResponse } from '@lib/http'

export type PublicOrganization = {
  id: string
  code: string
  level: 'national' | 'county' | 'local'
  name: string
  county: string
  membersCount: number
  foundedAt: string | null
  territories: string[]
  officialEmail: string
  phone: string
  headquarters: string
  leaders: Array<{
    fullName: string
    positionTitle: string
  }>
}

type PublicOrganizationsMeta = {
  total?: number
  count?: number
}

export function getPublicOrganizations(): Promise<
  ApiEnvelopeResponse<PublicOrganization[], PublicOrganizationsMeta>
> {
  return apiGetEnvelope<PublicOrganization[], PublicOrganizationsMeta>('/api/organizations?limit=200')
}
