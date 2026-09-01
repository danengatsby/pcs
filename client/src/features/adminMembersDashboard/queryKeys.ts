import type { AdminMembersDashboardQuery } from './api/getAdminMembersDashboard'

export const adminMembersDashboardQueryKeys = {
  all: ['admin-members-dashboard'] as const,
  detail: (query: AdminMembersDashboardQuery) => [...adminMembersDashboardQueryKeys.all, query] as const,
}
