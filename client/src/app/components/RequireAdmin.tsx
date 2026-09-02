import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@features/auth/context'
import { hasAdminAccess } from '@features/auth/types'
import type { Role } from '@features/auth/types'

export function RequireAdmin({ children, roles }: { children: ReactNode; roles?: readonly Role[] }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div>Se încarcă...</div>
  }

  if (!user) return <Navigate to="/auth/signin" replace />

  if (!hasAdminAccess(user.role)) return <Navigate to="/" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/admin/volunteers" replace />

  return <>{children}</>
}

export default RequireAdmin
