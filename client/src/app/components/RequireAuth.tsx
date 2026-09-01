import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@features/auth/context'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div>Se încarcă...</div>
  }

  if (!user) {
    return <Navigate to="/auth/signin" replace />
  }

  return <>{children}</>
}

export default RequireAuth
