import { apiGet, apiPatch, apiPost } from '@lib/http'
import type { CommunicationAudience, CreatePoliticalActionInput, PoliticalOperationsData, UpdatePoliticalActionInput } from '../types'

export const getPoliticalOperations = (actionId?: string | null) => apiGet<PoliticalOperationsData>(`/api/admin/mobilization${actionId ? `?actionId=${encodeURIComponent(actionId)}` : ''}`, { auth: true })
export const createPoliticalAction = (input: CreatePoliticalActionInput) => apiPost<{ id: string; slug: string }>('/api/admin/mobilization/actions', input, { auth: true })
export const updatePoliticalAction = (id: string, input: UpdatePoliticalActionInput) => apiPatch<{ id: string; version: number }>(`/api/admin/mobilization/actions/${encodeURIComponent(id)}`, input, { auth: true })
export const addPoliticalParticipant = (id: string, email: string, dueAt: string | null, notes: string) => apiPost(`/api/admin/mobilization/actions/${encodeURIComponent(id)}/participants`, { email, dueAt, notes }, { auth: true })
export const updatePoliticalParticipant = (id: string, input: { status?: string; attendanceStatus?: string }) => apiPatch(`/api/admin/mobilization/participants/${encodeURIComponent(id)}`, input, { auth: true })
export const previewCommunication = (input: CommunicationAudience) => apiPost<{ eligible: number; byCounty: Record<string, number>; byRole: Record<string, number>; channel: string }>('/api/admin/communications/preview', input, { auth: true })
export const createCommunicationDispatch = (input: CommunicationAudience & { title: string; message: string; mode: 'draft' | 'send'; confirmConsentSelection: boolean }) => apiPost<{ id: string; status: string; recipientCount: number; delivery: string }>('/api/admin/communications/dispatches', input, { auth: true })
