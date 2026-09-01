import { QueryClientProvider } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext, type AuthContextValue } from '@features/auth/context'
import { getMe } from '@features/auth/api/me'
import { refreshSession } from '@features/auth/api/refresh'
import { signin as signinRequest } from '@features/auth/api/signin'
import { signoutSession } from '@features/auth/api/signout'
import type { AuthUser, SigninInput } from '@features/auth/types'
import { createAppQueryClient } from '@lib/queryClient'
import { authStorage } from '@react/shared/auth/authStorage'

type AppProvidersProps = {
  children: ReactNode
}

async function restoreStoredSession(): Promise<AuthUser | null> {
  const csrfToken = authStorage.getCsrfToken()
  if (csrfToken) {
    const refreshed = await refreshSession()
    if (refreshed.ok) {
      authStorage.setFromResponse(refreshed.data)
      return refreshed.data.user
    }
  }

  if (!authStorage.getAccessToken()) {
    authStorage.clear()
    return null
  }

  const me = await getMe()
  if (!me.ok) {
    authStorage.clear()
    return null
  }

  return me.data.user
}

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(createAppQueryClient)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const nextUser = await restoreStoredSession()
    setUser(nextUser)
    setLoading(false)
  }, [])

  const signin = useCallback<AuthContextValue['signin']>(async (input: SigninInput) => {
    const result = await signinRequest(input)
    if (result.ok) {
      authStorage.setFromResponse(result.data)
      setUser(result.data.user)
    }

    return result
  }, [])

  const signout = useCallback(async () => {
    const result = await signoutSession()

    authStorage.clear()
    queryClient.clear()
    setUser(null)

    if (!result.ok && result.error.status !== 401) {
      throw new Error(result.error.message)
    }
  }, [queryClient])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const restoredUser = await restoreStoredSession()
      if (cancelled) {
        return
      }

      setUser(restoredUser)
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const auth = useMemo<AuthContextValue>(
    () => ({ user, loading, signin, reload, signout }),
    [user, loading, signin, reload, signout],
  )

  return (
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </AuthContext.Provider>
  )
}
