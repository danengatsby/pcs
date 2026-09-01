import type { AuthSessionResponse } from '@features/auth/types'

export type StoredAuthSession = {
  csrfToken: string | null
}

const STORAGE_KEY = 'pcp.auth.session'
let inMemoryAccessToken: string | null = null

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
  const sessionValue = sessionStorage.getItem(STORAGE_KEY)
  if (sessionValue) {
    return sessionValue
  }

  const legacyLocalValue = localStorage.getItem(STORAGE_KEY)
  if (legacyLocalValue) {
    sessionStorage.setItem(STORAGE_KEY, legacyLocalValue)
    localStorage.removeItem(STORAGE_KEY)
    return legacyLocalValue
  }

  return null
}

function writeStoredAuthSession(session: StoredAuthSession): void {
  if (!session.csrfToken) {
    sessionStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_KEY)
    return
  }

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  localStorage.removeItem(STORAGE_KEY)
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
    writeStoredAuthSession(session)
  },

  setFromResponse(session: AuthSessionResponse): StoredAuthSession {
    inMemoryAccessToken = session.token
    const storedSession = toStoredAuthSession(session)
    writeStoredAuthSession(storedSession)
    return storedSession
  },

  setAccessToken(accessToken: string | null) {
    inMemoryAccessToken = accessToken
  },

  getAccessToken(): string | null {
    return inMemoryAccessToken
  },

  getCsrfToken(): string | null {
    return this.get()?.csrfToken ?? null
  },

  clear() {
    inMemoryAccessToken = null
    sessionStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_KEY)
  },
}
