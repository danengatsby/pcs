export type ExecutiveTargetKey =
  | 'contact_rate'
  | 'member_conversion_rate'
  | 'overdue_cases'
  | 'active_organizations'

export type ExecutiveDashboardSummary = {
  applicationsTotal: number
  applicationsLast30Days: number
  contactedTotal: number
  uncontactedCases: number
  membersTotal: number
  contactRate: number
  memberConversionRate: number
  overdueCases: number
  activeOrganizations: number
  countiesWithoutResponsible: number
}

export type ExecutiveTrend = {
  month: string
  applications: number
  contacted: number
  members: number
}

export type ExecutiveCounty = {
  county: string
  applications: number
  contacted: number
  members: number
  organizers: number
  overdue: number
  hasResponsible: boolean
}

export type ExecutiveWorkflow = {
  status: 'nou' | 'validat' | 'contactat' | 'activ'
  count: number
}

export type ExecutiveObjective = {
  key: ExecutiveTargetKey
  label: string
  targetValue: number
  currentValue: number
  unit: 'percent' | 'count'
  direction: 'at_least' | 'at_most'
  status: 'achieved' | 'on_track' | 'at_risk'
  progressPercent: number
  updatedAt: string
}

export type ExecutiveDashboardData = {
  generatedAt: string
  summary: ExecutiveDashboardSummary
  trends: ExecutiveTrend[]
  counties: ExecutiveCounty[]
  workflow: ExecutiveWorkflow[]
  countiesWithoutResponsible: string[]
  objectives: ExecutiveObjective[]
  definitions: {
    contactRate: string
    memberConversionRate: string
    overdueCases: string
    activeOrganizations: string
    uncontactedCases: string
    countiesWithoutResponsible: string
    trends: string
  }
  access?: {
    scope: string
    national: boolean
  }
}

export type ExecutiveTargetUpdateResponse = {
  message: string
  target: {
    key: ExecutiveTargetKey
    label: string
    targetValue: number
    unit: ExecutiveObjective['unit']
    direction: ExecutiveObjective['direction']
    updatedAt: string
  }
}
