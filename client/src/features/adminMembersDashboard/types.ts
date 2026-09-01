import type { Role } from '@features/auth/types'

export type AdminDashboardMemberRole = Role

export type AdminDashboardMember = {
  id: string
  fullName: string
  email: string
  role: AdminDashboardMemberRole
  createdAt: string
}

export type AdminDashboardGroup = {
  label: string
  count: number
  rows: AdminDashboardMember[]
}

export type AdminMembersDashboardResponse = {
  summary: {
    total: number
    aderenti: number
    membri: number
    organizatori: number
  }
  groups: {
    aderenti: AdminDashboardGroup
    membri: AdminDashboardGroup
    organizatori: AdminDashboardGroup
  }
  filters: {
    search: string
    limit: number
  }
}
