import type { MobilizationInterest } from '@features/mobilization/types'

export type PoliticalParticipant = {
  id: string
  fullName: string
  email: string
  status: string
  attendanceStatus: string
  report: string
  result: string
  hours: number
  dueAt: string | null
}

export type PoliticalAction = {
  id: string
  type: 'event' | 'campaign' | 'volunteer_task'
  title: string
  summary: string
  objective: string
  status: 'draft' | 'open' | 'closed' | 'archived'
  visibility: 'public' | 'members' | 'internal'
  organization: { id: string; name: string } | null
  coordinator: { id: string; fullName: string } | null
  counties: Array<{ id: number; name: string }>
  startsAt: string | null
  endsAt: string | null
  targetMetric: string
  targetValue: number | null
  resultValue: number | null
  resultSummary: string
  version: number
  participants: PoliticalParticipant[]
  metrics: { invited: number; confirmed: number; present: number; completed: number; reportedHours: number }
}

export type PoliticalOperationsData = {
  generatedAt: string
  summary: { events: number; campaigns: number; tasks: number; open: number; participants: number; reportedHours: number }
  actions: PoliticalAction[]
  candidates: Array<{ membershipId: string; userId: string | null; fullName: string; email: string; membershipStatus: string; role: string | null; county: string; locality: string }>
  organizations: Array<{ id: string; code: string; name: string }>
  counties: Array<{ id: number; name: string }>
  access: { scope: string; national: boolean; capabilities: string[] }
}

export type CreatePoliticalActionInput = {
  type: PoliticalAction['type']
  title: string
  summary: string
  description: string
  objective: string
  status: PoliticalAction['status']
  visibility: PoliticalAction['visibility']
  organizationId: string | null
  coordinatorUserId: string | null
  countyIds: number[]
  startsAt: string | null
  endsAt: string | null
  participationMode: string
  commitment: string
  capacity: number | null
  targetMetric: string
  targetValue: number | null
}

export type UpdatePoliticalActionInput = { status?: string; resultValue?: number | null; resultSummary?: string; coordinatorUserId?: string | null; expectedVersion: number }

export type CommunicationAudience = {
  channel: 'email' | 'sms' | 'whatsapp'
  organizationId: string | null
  countyIds: number[]
  roles: Array<'SUSTINATOR' | 'ADERENT' | 'MEMBRU' | 'CONSILIER' | 'SECRETAR' | 'VICEPRESEDINTE' | 'PRESEDINTE'>
  interests: MobilizationInterest[]
}
