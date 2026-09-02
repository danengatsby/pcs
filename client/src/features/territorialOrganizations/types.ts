export type OrganizationLevel = 'national' | 'county' | 'local'
export type OrganizationStatus = 'forming' | 'active' | 'inactive' | 'dissolved'
export type TerritoryType = 'national' | 'county' | 'locality'
export type MandateStatus = 'planned' | 'active' | 'completed' | 'suspended'
export type ObjectiveStatus = 'planned' | 'in_progress' | 'achieved' | 'at_risk' | 'cancelled'

export type OrganizationTerritory = {
  id: string
  type: TerritoryType
  countyId: number | null
  county: string | null
  locality: string
  label: string
}

export type OrganizationListRow = {
  id: string
  code: string
  level: OrganizationLevel
  name: string
  county: string
  membersCount: number
  status: OrganizationStatus
  foundedAt: string | null
  createdAt: string
  parent: { id: string; code: string; name: string } | null
  territories: OrganizationTerritory[]
  counts: { children: number; mandates: number; objectives: number }
}

export type OrganizationMandate = {
  id: string
  userId: string | null
  fullName: string
  positionTitle: string
  startedAt: string
  endedAt: string | null
  status: MandateStatus
  accountEmail: string | null
  accountRole: string | null
  createdAt: string
  updatedAt: string
}

export type OrganizationObjective = {
  id: string
  title: string
  description: string
  metricName: string
  targetValue: number
  currentValue: number
  unit: string
  dueDate: string
  status: ObjectiveStatus
  createdAt: string
  updatedAt: string
}

export type OrganizationDetail = OrganizationListRow & {
  officialEmail: string
  phone: string
  headquarters: string
  updatedAt: string
  children: Array<{
    id: string
    code: string
    level: OrganizationLevel
    name: string
    status: OrganizationStatus
  }>
  mandates: OrganizationMandate[]
  objectives: OrganizationObjective[]
}

export type OrganizationRegistry = {
  rows: OrganizationListRow[]
  total: number
  summary: {
    organizations: number
    active: number
    forming: number
    countiesCovered: number
    activeMandates: number
    objectivesAtRisk: number
  }
  counties: Array<{ id: number; name: string }>
  access?: {
    capabilities: string[]
    scope: string
    national: boolean
  }
}

export type OrganizationTerritoryInput = {
  type: TerritoryType
  countyId?: number | null
  locality?: string
}

export type OrganizationWriteInput = {
  code: string
  name: string
  level: OrganizationLevel
  status: OrganizationStatus
  parentId?: string | null
  membersCount?: number
  officialEmail?: string
  phone?: string
  headquarters?: string
  foundedAt?: string | null
  territories: OrganizationTerritoryInput[]
}

export type OrganizationMandateInput = {
  userId?: number | null
  fullName: string
  positionTitle: string
  startedAt: string
  endedAt?: string | null
  status?: MandateStatus
}

export type OrganizationObjectiveInput = {
  title: string
  description?: string
  metricName?: string
  targetValue: number
  currentValue?: number
  unit?: string
  dueDate: string
  status?: ObjectiveStatus
}
