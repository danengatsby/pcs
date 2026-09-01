import { apiGet } from '@lib/http'
import type { VolunteerAdminRow } from '../types'
import { readVolunteerAdminRow } from './readVolunteerAdminRow'

export async function getAdminVolunteerById(id: number): Promise<VolunteerAdminRow> {
  const response = await apiGet<VolunteerAdminRow>(`/api/admin/volunteers/${id}`, {
    auth: true,
    parse: readVolunteerAdminRow,
  })

  if (!response.ok) {
    throw new Error(response.error.message)
  }

  return response.data
}
