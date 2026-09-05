export const adminNavigation = [
  { key: 'dashboard', path: 'dashboard', label: 'Tablou de comandă', capability: 'executive.read', tasks: null },
  { key: 'volunteers', path: 'volunteers', label: 'CRM voluntari', capability: 'recruitment.read', tasks: 'Dosare noi sau cu revenire / memento depășit, fără dosarele active.' },
  { key: 'members', path: 'members', label: 'Membri', capability: 'membership.read', tasks: 'Cereri de aderare în așteptarea validării.' },
  { key: 'organizations', path: 'organizations', label: 'Organizații', capability: 'organization.read', tasks: 'Obiective nefinalizate cu termen depășit sau marcate în risc.' },
  { key: 'mobilization', path: 'mobilization', label: 'Mobilizare', capability: 'mobilization.read', tasks: 'Participanți în așteptare, rapoarte de verificat sau sarcini cu termen depășit, la acțiuni deschise.' },
  { key: 'congresses', path: 'congresses', label: 'Congres', capability: 'congress.read', tasks: 'Congrese în pregătire, deschise sau închise care așteaptă validarea.' },
  { key: 'arbitration', path: 'arbitration', label: 'Arbitraj', capability: 'arbitration.read', tasks: 'Dosare depuse, în procedură sau contestate, fără o soluție finală.' },
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
