import { apiPatch, type ApiResponse } from '@lib/http'
import type {
  ExecutiveTargetKey,
  ExecutiveTargetUpdateResponse,
} from '../types'

export function updateExecutiveTarget(
  key: ExecutiveTargetKey,
  targetValue: number,
): Promise<ApiResponse<ExecutiveTargetUpdateResponse>> {
  return apiPatch<ExecutiveTargetUpdateResponse>(
    `/api/admin/executive-dashboard/targets/${encodeURIComponent(key)}`,
    { targetValue },
    { auth: true },
  )
}
