import type { ApiResponse } from '@lib/http'
import type { AuthSessionResponse } from '@features/auth/types'
import { authStorage } from './authStorage'

let pending: { generation: number; promise: Promise<ApiResponse<AuthSessionResponse>> } | null = null
const changedSession = (): ApiResponse<AuthSessionResponse> => ({ ok: false, error: { code: 'AUTH_SESSION_CHANGED', message: 'Sesiunea s-a schimbat. Reia operația din contul curent.' } })

// Startup restoration and all API clients share one refresh rotation.
export function refreshSession(): Promise<ApiResponse<AuthSessionResponse>> {
  const generation = authStorage.getGeneration()
  if (pending?.generation === generation) return pending.promise
  // Refresh rotates cookies shared by every tab. Serialize rotations so a new
  // tab cannot submit a CSRF value invalidated by a concurrent renewal.
  const request = async (): Promise<ApiResponse<AuthSessionResponse>> => {
    if (navigator.locks) return await navigator.locks.request('pcs.auth.refresh', () => performRefresh(generation))
    return performRefresh(generation)
  }
  const promise = request().finally(() => {
    if (pending?.promise === promise) pending = null
  })
  pending = { generation, promise }
  return promise
}

async function performRefresh(generation: number): Promise<ApiResponse<AuthSessionResponse>> {
  if (authStorage.getGeneration() !== generation) return changedSession()
  const csrfToken = authStorage.getCsrfToken()
  if (!csrfToken) return { ok: false, error: { status: 401, code: 'AUTH_UNAUTHORIZED', message: 'Autentifică-te din nou pentru a continua.' } }
  try {
    // Use the underlying fetch: the refresh endpoint must never retry itself.
    const response = await globalThis.fetch('/api/auth/refresh', {
      method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'X-CSRF-Token': csrfToken },
    })
    const body = await response.json()
    if (authStorage.getGeneration() !== generation || authStorage.getCsrfToken() !== csrfToken) return changedSession()
    if (!response.ok) {
      if ([400, 401, 403].includes(response.status)) authStorage.clear()
      return { ok: false, error: { status: response.status, code: body?.error?.code, message: body?.error?.message ?? 'Sesiunea nu a putut fi reînnoită. Reîncearcă.' } }
    }
    const session: AuthSessionResponse | undefined = body?.data
    if (!session || typeof session.token !== 'string' || !session.token || !session.user || typeof session.user.id !== 'string') {
      return { ok: false, error: { message: 'Răspuns de autentificare invalid. Reîncearcă.' } }
    }
    if (!authStorage.updateFromRefresh(session, generation)) return changedSession()
    return { ok: true, data: session }
  } catch {
    return { ok: false, error: { message: 'Conexiunea nu a permis reînnoirea sesiunii. Reîncearcă.' } }
  }
}
