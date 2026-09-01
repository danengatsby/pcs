export type Role =
  | 'SUSTINATOR'
  | 'ADERENT'
  | 'MEMBRU'
  | 'CONSILIER'
  | 'SECRETAR'
  | 'VICEPRESEDINTE'
  | 'PRESEDINTE'

export const ADMIN_ROLES = ['CONSILIER', 'SECRETAR', 'VICEPRESEDINTE', 'PRESEDINTE'] as const

export type AuthUser = {
  id: string
  email: string
  fullName: string
  role: Role
}

export type SigninInput = {
  email: string
  password: string
}

export type AuthSessionResponse = {
  message: string
  user: AuthUser
  token: string
  tokenType: 'Bearer'
  expiresInSeconds: number
  accessTokenExpiresAt: string
  csrfToken?: string
  refreshExpiresInSeconds?: number
  refreshTokenExpiresAt?: string
  tokenPolicy?: unknown
}

export type SigninResponse = AuthSessionResponse

export function hasAdminAccess(role: Role | null | undefined): boolean {
  return typeof role === 'string' && ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number])
}
