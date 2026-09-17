import { authStorage } from '@react/shared/auth/authStorage'
import { refreshSession } from '@react/shared/auth/refreshSession'

// A rejected authenticated request can be replayed once after refreshing.
// Authentication rejects it before the route handler can change any data.
export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const source = input instanceof Request ? input.clone() : new URL(String(input), window.location.origin)
  const request = new Request(source, init)
  const url = new URL(request.url)
  const token = request.headers.get('Authorization')
  const eligible = url.origin === window.location.origin && url.pathname.startsWith('/api/')
    && !url.pathname.startsWith('/api/auth/') && Boolean(token?.startsWith('Bearer '))
  const generation = authStorage.getGeneration()
  const retry = eligible ? request.clone() : null
  const response = await globalThis.fetch(input, init)
  if (response.status !== 401 || !retry || generation !== authStorage.getGeneration() || request.signal.aborted) return response

  // A slower 401 may arrive after another request has already refreshed.
  if (`Bearer ${authStorage.getAccessToken()}` === token) {
    if (!authStorage.getCsrfToken()) {
      authStorage.clear()
      return response
    }
    const refreshed = await refreshSession()
    if (!refreshed.ok) return response
  }
  if (generation !== authStorage.getGeneration() || !authStorage.getAccessToken() || request.signal.aborted) return response
  retry.headers.set('Authorization', `Bearer ${authStorage.getAccessToken()}`)
  if (retry.headers.has('X-CSRF-Token')) retry.headers.set('X-CSRF-Token', authStorage.getCsrfToken() ?? '')
  const retried = await globalThis.fetch(retry)
  if (retried.status === 401 && generation === authStorage.getGeneration()) authStorage.clear()
  return retried
}
