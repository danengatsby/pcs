export const executiveDashboardQueryKeys = {
  all: ['admin', 'executive-dashboard'] as const,
  detail: () => ['admin', 'executive-dashboard', 'detail'] as const,
}
