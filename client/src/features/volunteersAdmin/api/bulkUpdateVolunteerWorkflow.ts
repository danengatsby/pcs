import { apiPatch } from '@lib/http'
import type { VolunteerWorkflowBulkUpdateInput, VolunteerWorkflowBulkUpdateResponse } from '../types'

export async function bulkUpdateVolunteerWorkflow(
  input: VolunteerWorkflowBulkUpdateInput,
) {
  return apiPatch<VolunteerWorkflowBulkUpdateResponse>('/api/admin/volunteers/workflow/bulk', input, { auth: true })
}
