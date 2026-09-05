import { Outlet, useMatch } from 'react-router-dom'
import { useAuth } from '@features/auth/context'
import { SiteHeader } from './SiteHeader'

export function AppLayout() {
  const { user } = useAuth()
  const isAdmin = useMatch('/admin/*')

  return (
    <div className="app-shell">
      <SiteHeader administrative={!!isAdmin} />

      <main className="site-main" id="main-content" tabIndex={-1}>
        <div className={`container${isAdmin ? ' container--admin' : ''}`}>
          <Outlet />
        </div>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="footer-left">
            <strong>PCS</strong>
            <div className="muted">
              Partidul Conservator al Seniorilor · Respect, demnitate și solidaritate
              {user ? ` · Conectat ca ${user.fullName}` : ''}
            </div>
          </div>
          <div className="footer-right muted">
            © {new Date().getFullYear()} PCS
          </div>
        </div>
      </footer>
    </div>
  )
}
