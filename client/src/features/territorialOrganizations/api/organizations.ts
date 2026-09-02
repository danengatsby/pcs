import { apiGet, apiPatch, apiPost, type ApiResponse } from '@lib/http'
import type {
  OrganizationDetail,
  OrganizationMandateInput,
  OrganizationObjectiveInput,
  OrganizationRegistry,
  OrganizationWriteInput,
} from '../types'

export function getOrganizationRegistry(): Promise<ApiResponse<OrganizationRegistry>> {
  return apiGet<OrganizationRegistry>('/api/admin/organizations?limit=200', { auth: true })
}

export function getOrganizationDetail(id: string): Promise<ApiResponse<OrganizationDetail>> {
  return apiGet<OrganizationDetail>(`/api/admin/organizations/${encodeURIComponent(id)}`, { auth: true })
}

export function createOrganization(input: OrganizationWriteInput): Promise<ApiResponse<OrganizationDetail>> {
  return apiPost<OrganizationDetail>('/api/admin/organizations', input, { auth: true })
}

export function updateOrganization(
  id: string,
  input: Partial<OrganizationWriteInput>,
): Promise<ApiResponse<OrganizationDetail>> {
  return apiPatch<OrganizationDetail>(`/api/admin/organizations/${encodeURIComponent(id)}`, input, { auth: true })
}

export function createOrganizationMandate(
  organizationId: string,
  input: OrganizationMandateInput,
): Promise<ApiResponse<OrganizationDetail>> {
  return apiPost<OrganizationDetail>(
    `/api/admin/organizations/${encodeURIComponent(organizationId)}/mandates`,
    input,
    { auth: true },
  )
}

export function updateOrganizationMandate(
  organizationId: string,
  mandateId: string,
  input: Partial<OrganizationMandateInput>,
): Promise<ApiResponse<OrganizationDetail>> {
  return apiPatch<OrganizationDetail>(
    `/api/admin/organizations/${encodeURIComponent(organizationId)}/mandates/${encodeURIComponent(mandateId)}`,
    input,
    { auth: true },
  )
}

export function createOrganizationObjective(
  organizationId: string,
  input: OrganizationObjectiveInput,
): Promise<ApiResponse<OrganizationDetail>> {
  return apiPost<OrganizationDetail>(
    `/api/admin/organizations/${encodeURIComponent(organizationId)}/objectives`,
    input,
    { auth: true },
  )
}

export function updateOrganizationObjective(
  organizationId: string,
  objectiveId: string,
  input: Partial<OrganizationObjectiveInput>,
): Promise<ApiResponse<OrganizationDetail>> {
  return apiPatch<OrganizationDetail>(
    `/api/admin/organizations/${encodeURIComponent(organizationId)}/objectives/${encodeURIComponent(objectiveId)}`,
    input,
    { auth: true },
  )
}
