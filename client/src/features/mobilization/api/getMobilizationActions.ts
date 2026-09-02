import { apiGet } from '@lib/http'
import type { MobilizationAction, MobilizationActionType } from '../types'

const actionTypes = new Set<MobilizationActionType>([
  'event',
  'campaign',
  'volunteer_task',
  'petition',
  'consultation',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function parseAction(value: unknown): MobilizationAction {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.slug !== 'string' || typeof value.type !== 'string') {
    throw new Error('Răspuns invalid pentru acțiunile PCS.')
  }
  if (!actionTypes.has(value.type as MobilizationActionType)) {
    throw new Error('Tip de acțiune necunoscut.')
  }

  const requiredStrings = ['title', 'summary', 'description', 'scope', 'county', 'locality', 'participationMode', 'commitment']
  if (requiredStrings.some((key) => typeof value[key] !== 'string')) {
    throw new Error('Acțiunea primită este incompletă.')
  }
  if (typeof value.responseCount !== 'number' || (value.capacity !== null && typeof value.capacity !== 'number')) {
    throw new Error('Indicatorii acțiunii sunt invalizi.')
  }

  return {
    id: value.id,
    slug: value.slug,
    type: value.type as MobilizationActionType,
    title: value.title as string,
    summary: value.summary as string,
    description: value.description as string,
    scope: value.scope as MobilizationAction['scope'],
    county: value.county as string,
    locality: value.locality as string,
    startsAt: readNullableString(value.startsAt),
    endsAt: readNullableString(value.endsAt),
    participationMode: value.participationMode as string,
    commitment: value.commitment as string,
    capacity: value.capacity as number | null,
    responseCount: value.responseCount,
  }
}

export async function getMobilizationActions(): Promise<MobilizationAction[]> {
  const response = await apiGet<MobilizationAction[]>('/api/mobilization/actions', {
    parse: (value) => {
      if (!Array.isArray(value)) {
        throw new Error('Lista acțiunilor este invalidă.')
      }
      return value.map(parseAction)
    },
  })

  if (!response.ok) {
    throw new Error(response.error.message)
  }
  return response.data
}
