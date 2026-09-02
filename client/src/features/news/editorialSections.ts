import type { NewsItem } from './types'

export type NewsEditorialSectionKey = 'positions' | 'local' | 'releases' | 'press'

export type NewsEditorialSection = {
  key: NewsEditorialSectionKey
  label: string
  kicker: string
  description: string
  emptyMessage: string
}

export const newsEditorialSections: NewsEditorialSection[] = [
  {
    key: 'positions',
    label: 'Poziții PCS',
    kicker: 'Vocea politică a partidului',
    description: 'Declarații, reacții și poziții asumate oficial de PCS pe temele aflate în dezbatere publică.',
    emptyMessage: 'Nu există momentan poziții PCS publicate.',
  },
  {
    key: 'local',
    label: 'Activitate locală',
    kicker: 'Din organizațiile teritoriale',
    description: 'Consultări, acțiuni și rezultate raportate de organizațiile județene și locale ale PCS.',
    emptyMessage: 'Nu există momentan activități locale publicate.',
  },
  {
    key: 'releases',
    label: 'Comunicate',
    kicker: 'Anunțuri oficiale',
    description: 'Decizii, evenimente și informații instituționale publicate direct de Partidul Conservator al Seniorilor.',
    emptyMessage: 'Nu există momentan comunicate publicate.',
  },
  {
    key: 'press',
    label: 'Informații din presă',
    kicker: 'Surse externe',
    description: 'Selecție de informații utile pentru seniori, preluate transparent din presă și de la instituții publice.',
    emptyMessage: 'Nu există momentan informații preluate din presă.',
  },
]

function normalize(value: string | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('ro-RO')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function includesAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term))
}

export function getNewsEditorialSectionKey(item: NewsItem): NewsEditorialSectionKey {
  const category = normalize(item.category)
  const tags = (item.tags ?? []).map(normalize).join(' ')
  const sourceName = normalize(item.sourceName)

  const isPcsSource = sourceName === 'pcs'
    || sourceName.includes('partidul conservator al seniorilor')

  if (item.sourceName && item.sourceUrl && !isPcsSource) {
    return 'press'
  }

  if (category === 'pozitie pcs' || category === 'pozitii pcs') {
    return 'positions'
  }
  if (category === 'activitate locala') {
    return 'local'
  }
  if (category === 'comunicat' || category === 'comunicate') {
    return 'releases'
  }
  if (category === 'informatii din presa') {
    return 'press'
  }

  if (
    includesAny(category, ['pozitie', 'declaratie', 'reactie', 'program politic', 'opinie'])
    || includesAny(tags, ['pozitie pcs', 'declaratie pcs', 'program pcs'])
  ) {
    return 'positions'
  }

  if (
    includesAny(category, ['activitate', 'local', 'eveniment', 'initiativa', 'organizatie'])
    || includesAny(tags, ['activitate locala', 'filiala', 'organizatie locala', 'organizatie judeteana'])
  ) {
    return 'local'
  }

  return 'releases'
}

export function getNewsEditorialSection(item: NewsItem): NewsEditorialSection {
  const key = getNewsEditorialSectionKey(item)
  return newsEditorialSections.find((section) => section.key === key) as NewsEditorialSection
}

export function groupNewsByEditorialSection(items: NewsItem[]): Record<NewsEditorialSectionKey, NewsItem[]> {
  const grouped: Record<NewsEditorialSectionKey, NewsItem[]> = {
    positions: [],
    local: [],
    releases: [],
    press: [],
  }

  for (const item of items) {
    grouped[getNewsEditorialSectionKey(item)].push(item)
  }

  return grouped
}
