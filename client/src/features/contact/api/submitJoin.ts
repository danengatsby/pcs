import { callOpenApiData, openApiClients } from '../../../lib/openapi'
import type { components } from '../../../generated/openapi/schema'

export type SubmitJoinRequest = {
  fullName: string
  email: string
  password: string
  phone?: string
  county: string
  locality: string
  skills?: string
  motivation: string
  captchaToken?: string
  website?: string
}

export type SubmitJoinResponse = {
  id: number
}

export async function submitJoin(payload: SubmitJoinRequest): Promise<SubmitJoinResponse> {
  const res = await callOpenApiData(() => openApiClients.volunteers.createVolunteer({
    volunteerSignupInput: toVolunteerSignupInput(payload),
  }))

  if (!res.ok) {
    // Mapare erori pe `errorCode` (din ApiEnvelope) -> mesaje user-friendly.
    switch (res.error.code) {
      case 'VOLUNTEER_EMAIL_EXISTS':
        throw new Error('Există deja o cerere/înscriere cu acest email.')
      case 'VOLUNTEER_ACCOUNT_EXISTS':
        throw new Error('Există deja un cont pentru acest email. Folosește parola contului existent.')
      case 'VOLUNTEER_INVALID_COUNTY':
        throw new Error('Județ invalid. Alege un județ din listă.')
      case 'VOLUNTEER_CAPTCHA_REQUIRED':
      case 'VOLUNTEER_CAPTCHA_INVALID':
      case 'VOLUNTEER_CAPTCHA_UNAVAILABLE':
        throw new Error(res.error.message)
      case 'VOLUNTEER_VALIDATION_FAILED':
        // Serverul include deja un mesaj bun; îl păstrăm.
        throw new Error(res.error.message)
      default:
        throw new Error(res.error.message)
    }
  }

  return readSubmitJoinResponse(res.data)
}

function readSubmitJoinResponse(value: unknown): SubmitJoinResponse {
  if (
    !value ||
    typeof value !== 'object' ||
    !('id' in value) ||
    typeof value.id !== 'number' ||
    !Number.isFinite(value.id)
  ) {
    throw new Error('Răspuns invalid de la server.')
  }

  return { id: value.id }
}

function toVolunteerSignupInput(payload: SubmitJoinRequest): components['schemas']['VolunteerSignupInput'] {
  return {
    fullName: payload.fullName,
    email: payload.email,
    password: payload.password,
    phone: payload.phone ?? '',
    county: payload.county,
    locality: payload.locality,
    skills: payload.skills ?? '',
    motivation: payload.motivation,
    captchaToken: payload.captchaToken ?? '',
    website: payload.website ?? '',
  }
}
