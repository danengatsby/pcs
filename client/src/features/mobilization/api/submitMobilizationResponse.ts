import { apiPost } from '@lib/http'
import type { MobilizationResponse, MobilizationResponseRequest } from '../types'

function parseResponse(value: unknown): MobilizationResponse {
  if (!value || typeof value !== 'object' || !('accepted' in value) || typeof value.accepted !== 'boolean') {
    throw new Error('Răspuns invalid de la server.')
  }
  const id = 'id' in value ? value.id : null
  if (id !== null && typeof id !== 'string') {
    throw new Error('Identificator de răspuns invalid.')
  }
  return { accepted: value.accepted, id }
}

export async function submitMobilizationResponse(
  slug: string,
  payload: MobilizationResponseRequest,
): Promise<MobilizationResponse> {
  const response = await apiPost<MobilizationResponse>(
    `/api/mobilization/actions/${encodeURIComponent(slug)}/responses`,
    payload,
    { parse: parseResponse },
  )

  if (!response.ok) {
    if (response.error.code === 'MOBILIZATION_RESPONSE_EXISTS') {
      throw new Error('Ai răspuns deja la această acțiune cu adresa de email introdusă.')
    }
    throw new Error(response.error.message)
  }
  return response.data
}
