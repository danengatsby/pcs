export const interventionLabels = {
  uncontacted: 'Cereri necontactate de peste 48 de ore',
  unled_branches: 'Filiale fără responsabil',
  overdue_objectives: 'Obiective întârziate',
  uncoordinated_events: 'Evenimente fără coordonator',
  unreviewed_reports: 'Rapoarte de activitate nevalidate',
  expiring_records: 'Decizii și documente care expiră',
} as const
export type InterventionKind = keyof typeof interventionLabels
export type InterventionData = {
  generatedAt: string
  rows: Array<{ key: string; kind: InterventionKind; title: string; context: string; priority: 'critical' | 'high' | 'normal'; dueAt: string | null; href: string }>
  total: number; limit: number; offset: number
  counts: Partial<Record<InterventionKind, number>>
  expiryCoverage: { tracked: number; missing: number; windowDays: number }
}
export type ExpiryRecord = { source: string; id: string; title: string; expiresOn: string | null }
export type ExpiryData = { rows: ExpiryRecord[]; total: number; canManage: boolean }
