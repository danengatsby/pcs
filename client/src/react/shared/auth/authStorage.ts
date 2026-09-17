import type { AuthSessionResponse, AuthUser } from '@features/auth/types'

export type StoredAuthSession = {
  csrfToken: string | null
}

const STORAGE_KEY = 'pcs.auth.session'
let inMemoryAccessToken: string | null = null
let generation = 0
const listeners = new Set<(user: AuthUser | null) => void>()

function notifySession(user: AuthUser | null): void {
  for (const listener of listeners) listener(user)
}

function storeResponse(session: AuthSessionResponse): StoredAuthSession {
  inMemoryAccessToken = session.token
  const storedSession = toStoredAuthSession(session)
  writeStoredAuthSession(storedSession)
  notifySession(session.user)
  return storedSession
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function normalizeStoredAuthSession(value: unknown): StoredAuthSession | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<StoredAuthSession>
  if (
    !('csrfToken' in candidate)
    || (candidate.csrfToken !== null && typeof candidate.csrfToken !== 'string')
  ) {
    return null
  }

  return {
    csrfToken: candidate.csrfToken ?? null,
  }
}

function readRawStoredAuthSession(): string | null {
  // The refresh cookie belongs to the browser, so its CSRF companion must be
  // shared by tabs as well. Never persist the access token or a personal link.
  const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY)
  const session = normalizeStoredAuthSession(safeParse<unknown>(raw))
  if (!session?.csrfToken) return null
  const sanitized = JSON.stringify(session)
  if (localStorage.getItem(STORAGE_KEY) !== sanitized) localStorage.setItem(STORAGE_KEY, sanitized)
  sessionStorage.removeItem(STORAGE_KEY)
  return sanitized
}

function writeStoredAuthSession(session: StoredAuthSession): void {
  if (!session.csrfToken) {
    sessionStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_KEY)
    return
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  sessionStorage.removeItem(STORAGE_KEY)
}

function toStoredAuthSession(session: AuthSessionResponse): StoredAuthSession {
  return {
    csrfToken: session.csrfToken ?? null,
  }
}

export const authStorage = {
  get(): StoredAuthSession | null {
    return normalizeStoredAuthSession(safeParse<unknown>(readRawStoredAuthSession()))
  },

  set(session: StoredAuthSession) {
    generation++
    writeStoredAuthSession(session)
  },

  setFromResponse(session: AuthSessionResponse): StoredAuthSession {
    generation++
    return storeResponse(session)
  },

  updateFromRefresh(session: AuthSessionResponse, expectedGeneration: number): boolean {
    if (generation !== expectedGeneration) return false
    storeResponse(session)
    return true
  },

  getGeneration(): number { return generation },

  subscribe(listener: (user: AuthUser | null) => void): () => void {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },

  setAccessToken(accessToken: string | null) {
    generation++
    inMemoryAccessToken = accessToken
  },

  getAccessToken(): string | null {
    return inMemoryAccessToken
  },

  getCsrfToken(): string | null {
    return this.get()?.csrfToken ?? null
  },

  clear() {
    generation++
    inMemoryAccessToken = null
    sessionStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_KEY)
    notifySession(null)
  },
}

// Signing out in any tab also clears credentials held in other tabs' memory.
window.addEventListener('storage', event => {
  if (event.storageArea === localStorage && (event.key === STORAGE_KEY || event.key === null) && event.newValue === null) {
    authStorage.clear()
  }
})
