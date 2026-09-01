import { createContext, useContext } from 'react'
import type { ApiErrorResult, ApiResult } from '@lib/http'
import type { AuthSessionResponse, AuthUser, SigninInput } from './types'

export type AuthSessionResult = ApiResult<AuthSessionResponse> | ApiErrorResult

export type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  signin: (input: SigninInput) => Promise<AuthSessionResult>
  reload: () => Promise<void>
  signout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used within AppProviders.')
  }

  return value
}
