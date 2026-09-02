export type MobilizationActionType = 'event' | 'campaign' | 'volunteer_task' | 'petition' | 'consultation'

export type MobilizationInterest =
  | 'pensii'
  | 'sanatate'
  | 'servicii_locale'
  | 'combaterea_izolarii'
  | 'comunicare'
  | 'organizare'

export type MobilizationAvailability = '' | 'dimineata' | 'dupa_amiaza' | 'seara' | 'weekend' | 'flexibil'

export type MobilizationAction = {
  id: string
  slug: string
  type: MobilizationActionType
  title: string
  summary: string
  description: string
  scope: 'national' | 'local' | 'online'
  county: string
  locality: string
  startsAt: string | null
  endsAt: string | null
  participationMode: string
  commitment: string
  capacity: number | null
  responseCount: number
}

export type MobilizationResponseRequest = {
  fullName: string
  email: string
  phone?: string
  county: string
  locality?: string
  interests: MobilizationInterest[]
  availability?: MobilizationAvailability
  message?: string
  updatesConsent: boolean
  emailConsent: boolean
  smsConsent: boolean
  whatsappConsent: boolean
  consentVersion: 'mobilizare-v2'
  privacyConsent: true
  website?: string
}

export type MobilizationResponse = {
  accepted: boolean
  id: string | null
}
