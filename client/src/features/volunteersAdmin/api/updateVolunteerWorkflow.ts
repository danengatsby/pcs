import { apiPatch, type ApiResponse } from '@lib/http'
import type { VolunteerWorkflowUpdateInput, VolunteerWorkflowUpdateResponse } from '../types'

export async function updateVolunteerWorkflow(
  volunteerId: number,
  input: VolunteerWorkflowUpdateInput,
): Promise<ApiResponse<VolunteerWorkflowUpdateResponse>> {
  return apiPatch<VolunteerWorkflowUpdateResponse>(`/api/admin/volunteers/${volunteerId}/workflow`, input, { auth: true })
}
