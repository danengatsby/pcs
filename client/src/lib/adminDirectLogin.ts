import { apiPost, type ApiResponse } from './http'
import type { AuthSessionResponse } from '@features/auth/types'

let token = ''
let pending: Promise<ApiResponse<AuthSessionResponse>> | null = null

export function captureAdminDirectLoginToken(): void {
  if (!['/auth/direct', '/auth/signin'].includes(window.location.pathname)) return
  if (window.location.pathname === '/auth/signin' && !window.location.hash) return
  const fragment = window.location.hash.slice(1)
  token = /^[A-Za-z0-9_-]{43}$/.test(fragment) ? fragment : ''
  pending = null
  if (window.location.hash || window.location.search) {
    window.history.replaceState(window.history.state, '', window.location.pathname)
  }
}

export function hasAdminDirectLoginToken(): boolean { return Boolean(token) }
export function clearAdminDirectLoginToken(): void { token = ''; pending = null }

export function acceptAdminDirectLoginLink(value: string): boolean {
  try {
    const url = new URL(value.trim())
    const fragment = url.hash.slice(1)
    if (url.origin !== window.location.origin || !['/auth/direct', '/auth/signin'].includes(url.pathname)
      || !/^[A-Za-z0-9_-]{43}$/.test(fragment)) return false
    token = fragment
    pending = null
    return true
  } catch { return false }
}

// React StrictMode mounts effects twice; both subscribers must share the one
// request that consumes the operator-issued capability.
export function redeemAdminDirectLogin(): Promise<ApiResponse<AuthSessionResponse>> {
  if (!token) return Promise.resolve({ ok: false, error: { message: 'Deschide linkul personal de acces direct.' } })
  pending ??= apiPost<AuthSessionResponse>('/api/auth/admin-direct-login', { token })
  return pending
}
