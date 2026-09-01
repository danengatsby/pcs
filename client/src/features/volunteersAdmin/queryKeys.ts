import type { ListAdminVolunteersQuery } from './api/listVolunteers'

const volunteersAdminQueryKeyPrefix = ['admin', 'volunteers'] as const

export const volunteersAdminQueryKeys = {
  all: volunteersAdminQueryKeyPrefix,
  list: (query: ListAdminVolunteersQuery) => [...volunteersAdminQueryKeyPrefix, query] as const,
  detail: (id: number) => [...volunteersAdminQueryKeyPrefix, 'detail', id] as const,
  audit: (id: number) => [...volunteersAdminQueryKeyPrefix, 'audit', id] as const,
  owners: () => [...volunteersAdminQueryKeyPrefix, 'owners'] as const,
}
