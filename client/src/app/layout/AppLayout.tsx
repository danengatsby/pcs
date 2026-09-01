import { Outlet } from 'react-router-dom'
import { useAuth } from '@features/auth/context'
import { SiteHeader } from './SiteHeader'

export function AppLayout() {
  const { user } = useAuth()

  return (
    <div className="app-shell">
      <SiteHeader />

      <main className="site-main" id="main-content" tabIndex={-1}>
        <div className="container">
          <Outlet />
        </div>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div className="footer-left">
            <strong>PCP</strong>
            <div className="muted">
              Platformă civică și informare publică
              {user ? ` · Conectat ca ${user.fullName}` : ''}
            </div>
          </div>
          <div className="footer-right muted">
            © {new Date().getFullYear()} PCP
          </div>
        </div>
      </footer>
    </div>
  )
}
