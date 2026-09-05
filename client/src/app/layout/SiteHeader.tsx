import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@features/auth/context'
import { hasAdminAccess } from '@features/auth/types'
import type { DocumentItem } from '@features/documents/config'

export function SiteHeader() {
  const navigate = useNavigate()
  const { user, signout } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [documentsOpen, setDocumentsOpen] = useState(false)
  const [documents, setDocuments] = useState<DocumentItem[] | null>(null)
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const documentsMenuRef = useRef<HTMLDivElement | null>(null)
  const documentsLoadRef = useRef<Promise<DocumentItem[]> | null>(null)
  const headerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!documentsOpen) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      if (!documentsMenuRef.current?.contains(event.target as Node)) {
        setDocumentsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [documentsOpen])

  useEffect(() => {
    if (!mobileMenuOpen) return

    function handlePointerDown(event: MouseEvent) {
      if (!headerRef.current?.contains(event.target as Node)) {
        setMobileMenuOpen(false)
        setDocumentsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
        setDocumentsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileMenuOpen])

  async function handleSignout() {
    setSigningOut(true)

    try {
      await signout()
      navigate('/auth/signin')
    } finally {
      setSigningOut(false)
    }
  }

  async function ensureDocumentsLoaded(): Promise<void> {
    if (documents) {
      return
    }

    if (!documentsLoadRef.current) {
      setDocumentsLoading(true)
      documentsLoadRef.current = import('@features/documents/config')
        .then((module) => {
          setDocuments(module.documents)
          return module.documents
        })
        .finally(() => {
          setDocumentsLoading(false)
          documentsLoadRef.current = null
        })
    }

    await documentsLoadRef.current
  }

  function handleDocumentsIntent() {
    void ensureDocumentsLoaded()
  }

  function handleDocumentsToggle() {
    if (documentsOpen) {
      setDocumentsOpen(false)
      return
    }

    handleDocumentsIntent()
    setDocumentsOpen(true)
  }

  function handleNavigation() {
    setDocumentsOpen(false)
    setMobileMenuOpen(false)
  }

  function handleMobileMenuToggle() {
    setMobileMenuOpen((current) => {
      if (current) setDocumentsOpen(false)
      return !current
    })
  }

  const userLabel = user?.fullName.trim() || user?.email || ''
  const adminLanding = '/admin'

  return (
    <header className="site-header" ref={headerRef}>
      <a className="skip-link" href="#main-content">
        Sari la conținut
      </a>
      <div className="container header-inner">
        <Link className="brand" to="/" onClick={handleNavigation}>
          <span className="brand-mark">PCS</span>
          <span className="brand-name">Partidul Conservator al Seniorilor</span>
        </Link>

        <button
          className="mobile-menu-toggle"
          type="button"
          aria-expanded={mobileMenuOpen}
          aria-controls="primary-navigation"
          onClick={handleMobileMenuToggle}
        >
          <span className="mobile-menu-toggle__icon" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>{mobileMenuOpen ? 'Închide' : 'Meniu'}</span>
        </button>

        <nav
          className={`nav${mobileMenuOpen ? ' is-mobile-open' : ''}`}
          id="primary-navigation"
          aria-label="Meniu principal"
        >
          <Link className="nav-link" to="/documente/program-politic" onClick={handleNavigation}>
            Program politic
          </Link>
          <Link className="nav-link" to="/manifest" onClick={handleNavigation}>
            Manifest
          </Link>
          <Link className="nav-link" to="/news" onClick={handleNavigation}>
            Știri
          </Link>
          <Link className="nav-link nav-link--mobilize" to="/mobilizare" onClick={handleNavigation}>
            Implică-te
          </Link>
          <div className={`nav-dropdown${documentsOpen ? ' is-open' : ''}`} ref={documentsMenuRef}>
            <button
              className="nav-link nav-toggle"
              type="button"
              aria-haspopup="menu"
              aria-expanded={documentsOpen}
              onMouseEnter={handleDocumentsIntent}
              onFocus={handleDocumentsIntent}
              onClick={handleDocumentsToggle}
            >
              Documente
            </button>
            <div className="nav-submenu" role="menu" aria-label="Documente">
              {documents?.map((document) => (
                <Link
                  key={document.slug}
                  className="nav-submenu-link"
                  to={`/documente/${document.slug}`}
                  role="menuitem"
                  onClick={handleNavigation}
                >
                  {document.menuLabel}
                </Link>
              ))}
              {!documents && documentsLoading ? (
                <span className="nav-submenu-link" role="none">
                  Se încarcă...
                </span>
              ) : null}
            </div>
          </div>
          {!user ? (
            <Link className="btn primary nav-join" to="/contact#aderare" onClick={handleNavigation}>
              Aderă la PCS
            </Link>
          ) : null}
          {hasAdminAccess(user?.role) ? (
            <Link
              className="nav-link"
              to={adminLanding}
              onClick={handleNavigation}
            >
              Admin
            </Link>
          ) : null}
          {user ? (
            <Link className="nav-link nav-user" to="/profil" title={user.email} onClick={handleNavigation}>
              {userLabel}
            </Link>
          ) : null}
          {user ? (
            <button className="btn" type="button" onClick={() => void handleSignout()} disabled={signingOut}>
              {signingOut ? 'Se deconectează...' : 'Deconectare'}
            </button>
          ) : (
            <Link className="btn" to="/auth/signin" onClick={handleNavigation}>
              Autentificare
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
