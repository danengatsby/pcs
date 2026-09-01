import { apiDelete } from '@lib/http'
import type { VolunteerBulkDeleteInput, VolunteerBulkDeleteResponse } from '../types'

export async function bulkDeleteVolunteer(
  input: VolunteerBulkDeleteInput,
) {
  return apiDelete<VolunteerBulkDeleteResponse>('/api/admin/volunteers/bulk', input, { auth: true })
}
