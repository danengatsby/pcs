import type { MobilizationInterest } from '@features/mobilization/types'

export type MemberPortalAction = {
  participantId: string
  actionId: string
  type: 'event' | 'campaign' | 'volunteer_task'
  title: string
  summary: string
  description: string
  objective: string
  startsAt: string | null
  endsAt: string | null
  dueAt: string | null
  participationMode: string
  commitment: string
  status: string
  attendanceStatus: string
  report: string
  result: string
  hours: number
  organizationName: string | null
  coordinatorName: string | null
}

export type MemberPortalData = {
  generatedAt: string
  membership: null | {
    id: string
    status: string
    memberNumber: string | null
    applicationAt: string
    approvedAt: string | null
    joinedAt: string | null
    county: string
    locality: string
  }
  organization: null | {
    id: string
    name: string
    code: string
    officialEmail: string
    phone: string
    headquarters: string
    leaders: Array<{ id: string; fullName: string; position: string }>
  }
  events: MemberPortalAction[]
  campaigns: MemberPortalAction[]
  tasks: MemberPortalAction[]
  documents: Array<{ id: string; title: string; description: string; category: string; path: string; visibility: string }>
  dues: {
    rows: Array<{ id: string; periodStart: string; periodEnd: string; amount: number; currency: string; status: string; dueAt: string | null; paidAt: string | null; reference: string }>
    dueAmount: number
    currency: string
  }
  communication: {
    emailConsent: boolean
    smsConsent: boolean
    whatsappConsent: boolean
    phone: string
    interests: MobilizationInterest[]
    consentVersion: string
  }
  regulatedModules: Array<{ key: 'financial_transparency' | 'electoral'; legalStatus: string; dpoStatus: string; enabled: boolean }>
}

export type MemberConsentInput = {
  emailConsent: boolean
  smsConsent: boolean
  whatsappConsent: boolean
  phone: string
  interests: MobilizationInterest[]
  consentVersion: 'portal-membru-v1'
}
