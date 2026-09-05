import { createContext, useContext } from 'react'
import type { AdminAccess, AdminTasks } from './adminNavigation'

export const AdminContext = createContext<{ access: AdminAccess; tasks?: AdminTasks } | null>(null)

export function useAdminWorkspace() {
  const value = useContext(AdminContext)
  if (!value) throw new Error('Pagina administrativă necesită shell-ul autorizat.')
  return value
}
