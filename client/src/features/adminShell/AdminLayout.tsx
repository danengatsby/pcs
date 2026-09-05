import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@features/auth/context'
import { apiGet } from '@lib/http'
import { AdminContext } from './AdminContext'
import { adminNavigation, adminNavigationGroups, formatTaskCount, type AdminAccess, type AdminTasks } from './adminNavigation'
import './adminShell.css'

export function AdminLayout() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()
  const identity = [user?.id, user?.role]
  const access = useQuery({
    queryKey: ['admin', 'access', ...identity],
    queryFn: async () => {
      const result = await apiGet<AdminAccess>('/api/admin/access', { auth: true })
      if (!result.ok) throw new Error(result.error.message)
      if (!Array.isArray(result.data?.capabilities) || typeof result.data.scope?.label !== 'string') throw new Error('Răspuns de autorizare invalid.')
      return result.data
    },
    staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true, refetchInterval: 30_000,
  })
  const tasks = useQuery({
    queryKey: ['admin', 'tasks', ...identity, access.data?.scope, access.data?.capabilities],
    enabled: !!access.data && !access.isError,
    queryFn: async () => {
      const result = await apiGet<AdminTasks>('/api/admin/tasks', { auth: true })
      if (!result.ok) throw new Error(result.error.message)
      if (!result.data?.counts || !Number.isSafeInteger(result.data.total) || result.data.total < 0) throw new Error('Răspuns invalid pentru contoare.')
      return result.data
    },
    staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 30_000,
  })

  // Existing modules have independent mutation hooks. Refresh the shared queues after every successful write.
  useEffect(() => queryClient.getMutationCache().subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'success') {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'access'] })
    }
  }), [queryClient])

  if (access.isPending) return <p role="status">Se verifică accesul administrativ…</p>
  if (access.isError) return <section className="card admin-workspace__panel" role="alert">
    <h1>Acces administrativ indisponibil</h1><p>{access.error.message}</p>
    <button className="btn" onClick={() => void access.refetch()}>Reîncearcă verificarea</button>
  </section>

  const availableTasks = tasks.isError ? undefined : tasks.data
  const navigation = adminNavigation.filter((item) => access.data.capabilities.includes(item.capability))
  const currentPage = navigation.find((item) => pathname === `/admin/${item.path}`)
  return <AdminContext.Provider value={{ access: access.data, tasks: availableTasks }}>
    <div className="admin-workspace">
      <aside className="admin-workspace__sidebar">
        <NavLink className="admin-workspace__brand" to="/admin" end>Administrare PCS</NavLink>
        <div className="admin-workspace__identity"><strong>{user?.fullName}</strong><p className="muted">Arie autorizată: {access.data.scope.label}</p></div>
        <button className="btn admin-workspace__toggle" aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={() => setMenuOpen(!menuOpen)}>Meniu administrativ</button>
        <nav id="admin-navigation" className={menuOpen ? 'is-open' : ''} aria-label="Meniu administrativ">
          <NavLink to="/admin" end onClick={() => setMenuOpen(false)}>Prezentare generală</NavLink>
          {adminNavigationGroups.map((group) => {
            const items = navigation.filter((item) => item.group === group.key)
            if (!items.length) return null
            return <div className="admin-workspace__nav-group" key={group.key} role="group" aria-labelledby={`admin-nav-${group.key}`}>
              <span className="admin-workspace__eyebrow" id={`admin-nav-${group.key}`}>{group.label}</span>
              {items.map((item) => {
                const count = availableTasks?.counts[item.key]
                return <NavLink key={item.key} to={`/admin/${item.path}`} title={item.tasks ?? undefined} onClick={() => setMenuOpen(false)}>
                  <span>{item.label}</span>
                  {item.tasks && <span className={`admin-workspace__badge${count ? ' is-pending' : ''}`} aria-label={count === undefined ? 'Număr indisponibil' : formatTaskCount(count)}>{count ?? '—'}</span>}
                </NavLink>
              })}
            </div>
          })}
        </nav>
        <div className="admin-workspace__sync">
          <p aria-live="polite">{availableTasks ? formatTaskCount(availableTasks.total) : tasks.isPending ? 'Se încarcă sarcinile…' : 'Sarcini: indisponibile'}</p>
          <button className="btn" disabled={tasks.isFetching} onClick={() => void tasks.refetch()}>Actualizează sarcinile</button>
          {tasks.isError && <p role="alert">Contoarele nu au putut fi încărcate. Paginile rămân accesibile.</p>}
          {availableTasks && <small className="muted">Actualizat: {new Date(availableTasks.generatedAt).toLocaleTimeString('ro-RO')}</small>}
        </div>
      </aside>
      <div className="admin-workspace__content">
        {pathname !== '/admin' && <nav className="admin-workspace__breadcrumb" aria-label="Localizare în administrare"><Link to="/admin">Administrare</Link><span aria-hidden="true">/</span><span aria-current="page">{currentPage?.label ?? 'Pagină indisponibilă'}</span></nav>}
        <Outlet />
      </div>
    </div>
  </AdminContext.Provider>
}
