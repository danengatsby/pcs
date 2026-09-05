export const adminNavigationGroups = [
  { key: 'overview', label: 'Sinteză', description: 'Indicatori, evoluție și obiective de urmărit.' },
  { key: 'people', label: 'Oameni', description: 'De la primul contact la calitatea de membru.' },
  { key: 'operations', label: 'Organizare', description: 'Structuri teritoriale și activități în teren.' },
  { key: 'governance', label: 'Guvernanță', description: 'Proceduri statutare, congrese și sesizări.' },
] as const

export const adminNavigation = [
  { key: 'dashboard', group: 'overview', path: 'dashboard', label: 'Tablou de comandă', description: 'Indicatori, intervenții și ținte operaționale.', capability: 'executive.read', tasks: null },
  { key: 'volunteers', group: 'people', path: 'volunteers', label: 'CRM voluntari', description: 'Înscrieri, contactare și urmărirea voluntarilor.', capability: 'recruitment.read', tasks: 'Dosare noi sau cu revenire / memento depășit, fără dosarele active.' },
  { key: 'members', group: 'people', path: 'members', label: 'Membri', description: 'Cereri de aderare, validări și evidența membrilor.', capability: 'membership.read', tasks: 'Cereri de aderare în așteptarea validării.' },
  { key: 'organizations', group: 'operations', path: 'organizations', label: 'Organizații', description: 'Filiale, teritorii, mandate și obiective.', capability: 'organization.read', tasks: 'Obiective nefinalizate cu termen depășit sau marcate în risc.' },
  { key: 'mobilization', group: 'operations', path: 'mobilization', label: 'Mobilizare', description: 'Evenimente, campanii, participanți și rapoarte.', capability: 'mobilization.read', tasks: 'Participanți în așteptare, rapoarte de verificat sau sarcini cu termen depășit, la acțiuni deschise.' },
  { key: 'congresses', group: 'governance', path: 'congresses', label: 'Congres', description: 'Calendar, delegați, cvorum și validare.', capability: 'congress.read', tasks: 'Congrese în pregătire, deschise sau închise care așteaptă validarea.' },
  { key: 'arbitration', group: 'governance', path: 'arbitration', label: 'Arbitraj', description: 'Sesizări confidențiale și termene de răspuns.', capability: 'arbitration.read', tasks: 'Dosare depuse, în procedură sau contestate, fără o soluție finală.' },
] as const

export type AdminAccess = {
  role: string
  capabilities: string[]
  scope: { national: boolean; label: string; organizationIds: string[] }
}
export type AdminTasks = { generatedAt: string; counts: Partial<Record<(typeof adminNavigation)[number]['key'], number>>; total: number }

export function formatTaskCount(count: number) {
  return count === 1 ? '1 sarcină restantă' : `${count} sarcini restante`
}
