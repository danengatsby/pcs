import { apiGet, apiPatch, apiPost, type ApiResponse } from '@lib/http'
import type { MemberConsentInput, MemberPortalData } from '../types'

export const getMemberPortal = (): Promise<ApiResponse<MemberPortalData>> =>
  apiGet<MemberPortalData>('/api/member-portal', { auth: true })

export const respondToMemberEvent = (actionId: string, response: 'confirmed' | 'declined') =>
  apiPost<{ id: string; status: string; respondedAt: string }>(
    `/api/member-portal/events/${encodeURIComponent(actionId)}/response`,
    { response },
    { auth: true },
  )

export const reportMemberTask = (participantId: string, input: { status: 'in_progress' | 'reported'; report: string; result: string; hours: number }) =>
  apiPatch<{ id: string; status: string; reportedAt: string | null }>(
    `/api/member-portal/tasks/${encodeURIComponent(participantId)}`,
    input,
    { auth: true },
  )

export const updateMemberConsent = (input: MemberConsentInput) =>
  apiPatch<{ updated: true }>('/api/member-portal/consents', input, { auth: true })
