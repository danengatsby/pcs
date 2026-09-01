import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@features/auth/context'
import { hasAdminAccess } from '@features/auth/types'

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div>Se încarcă...</div>
  }

  if (!user) return <Navigate to="/auth/signin" replace />

  if (!hasAdminAccess(user.role)) return <Navigate to="/" replace />

  return <>{children}</>
}

export default RequireAdmin
