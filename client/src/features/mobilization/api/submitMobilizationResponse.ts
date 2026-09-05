import { apiPost } from '@lib/http'
import type { MobilizationResponse, MobilizationResponseRequest } from '../types'

export class MobilizationActionFullError extends Error {}

function parseResponse(value: unknown): MobilizationResponse {
  if (!value || typeof value !== 'object' || !('accepted' in value) || typeof value.accepted !== 'boolean') {
    throw new Error('Răspuns invalid de la server.')
  }
  const id = 'id' in value ? value.id : null
  if (id !== null && typeof id !== 'string') {
    throw new Error('Identificator de răspuns invalid.')
  }
  const registrationStatus = 'registrationStatus' in value ? value.registrationStatus : null
  if (registrationStatus !== 'confirmed' && registrationStatus !== 'waitlisted' && !(id === null && registrationStatus === null)) {
    throw new Error('Starea înscrierii este invalidă.')
  }
  return { accepted: value.accepted, id, registrationStatus }
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
    if (response.error.code === 'MOBILIZATION_ACTION_FULL') {
      throw new MobilizationActionFullError(response.error.message)
    }
    if (response.error.code === 'MOBILIZATION_RESPONSE_EXISTS') {
      throw new Error('Ai răspuns deja la această acțiune cu adresa de email introdusă.')
    }
    throw new Error(response.error.message)
  }
  return response.data
}
