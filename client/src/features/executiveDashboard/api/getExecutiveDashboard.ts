import { apiGet, type ApiResponse } from '@lib/http'
import type { ExecutiveDashboardData } from '../types'

export function getExecutiveDashboard(): Promise<ApiResponse<ExecutiveDashboardData>> {
  return apiGet<ExecutiveDashboardData>('/api/admin/executive-dashboard', { auth: true })
}
