import type { MobilizationActionType, MobilizationAvailability, MobilizationInterest } from './types'

export const mobilizationActionTypeConfig: Record<MobilizationActionType, {
  label: string
  shortLabel: string
  cta: string
}> = {
  event: { label: 'Evenimente', shortLabel: 'Eveniment', cta: 'Confirmă prezența' },
  campaign: { label: 'Campanii', shortLabel: 'Campanie', cta: 'Implică-mă în campanie' },
  volunteer_task: { label: 'Sarcini pentru voluntari', shortLabel: 'Sarcină de voluntariat', cta: 'Preiau sarcina' },
  petition: { label: 'Petiții', shortLabel: 'Petiție', cta: 'Semnez petiția' },
  consultation: { label: 'Consultări', shortLabel: 'Consultare', cta: 'Trimit contribuția' },
}

export const mobilizationInterests: Array<{ value: MobilizationInterest; label: string }> = [
  { value: 'pensii', label: 'Pensii și venituri' },
  { value: 'sanatate', label: 'Sănătate și îngrijire' },
  { value: 'servicii_locale', label: 'Servicii și administrație locală' },
  { value: 'combaterea_izolarii', label: 'Combaterea izolării' },
  { value: 'comunicare', label: 'Comunicare publică' },
  { value: 'organizare', label: 'Organizare și evenimente' },
]

export const mobilizationAvailabilityOptions: Array<{ value: MobilizationAvailability; label: string }> = [
  { value: 'dimineata', label: 'Dimineața' },
  { value: 'dupa_amiaza', label: 'După-amiaza' },
  { value: 'seara', label: 'Seara' },
  { value: 'weekend', label: 'În weekend' },
  { value: 'flexibil', label: 'Program flexibil' },
]
