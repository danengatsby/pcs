import { Link } from 'react-router-dom'
import { useAuth } from '@features/auth/context'
import { hasAdminAccess, type Role } from '@features/auth/types'

function formatRoleLabel(role: Role): string {
  if (role === 'VICEPRESEDINTE') {
    return 'Vicepreședinte'
  }

  return role.charAt(0) + role.slice(1).toLowerCase()
}

export function UserProfilePage() {
  const { user } = useAuth()

  if (!user) {
    return null
  }

  const displayName = user.fullName.trim() || user.email
  const adminAccess = hasAdminAccess(user.role)

  return (
    <div className="profile-page">
      <section className="hero profile-page__hero">
        <div className="hero-kicker">Pagina utilizatorului</div>

        <div className="profile-page__hero-top">
          <div className="stack-12">
            <h1 className="profile-page__title">Bun venit, {displayName}</h1>
            <p className="lead">
              Aceasta este pagina ta personală din platforma PCP. Datele afișate mai jos sunt preluate direct din
              contul cu care ești autentificat.
            </p>
          </div>

          <div className="profile-page__actions">
            <Link className="btn primary" to="/news">
              Vezi știrile
            </Link>
            {adminAccess ? (
              <Link className="btn" to="/admin/volunteers">
                Zona administrativă
              </Link>
            ) : (
              <Link className="btn" to="/">
                Înapoi la început
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="profile-page__grid">
        <article className="card profile-page__card">
          <div className="hero-kicker profile-page__card-kicker">Datele tale</div>
          <dl className="profile-page__details">
            <div className="profile-page__detail">
              <dt>Nume complet</dt>
              <dd>{displayName}</dd>
            </div>
            <div className="profile-page__detail">
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div className="profile-page__detail">
              <dt>Rol în platformă</dt>
              <dd>{formatRoleLabel(user.role)}</dd>
            </div>
            <div className="profile-page__detail">
              <dt>ID utilizator</dt>
              <dd>{user.id}</dd>
            </div>
          </dl>
        </article>

        <article className="card profile-page__card">
          <div className="hero-kicker profile-page__card-kicker">Acces rapid</div>
          <div className="stack-12">
            <p className="profile-page__card-copy">
              Poți reveni oricând aici din numele tău din header. Pagina este personalizată în funcție de datele
              contului tău curent.
            </p>
            <Link className="text-link" to="/news">
              Deschide pagina de știri →
            </Link>
            <Link className="text-link" to="/auth/policy">
              Vezi politica de autentificare →
            </Link>
            {adminAccess ? (
              <Link className="text-link" to="/admin/members">
                Deschide dashboard membri →
              </Link>
            ) : (
              <Link className="text-link" to="/">
                Înapoi la pagina principală →
              </Link>
            )}
          </div>
        </article>
      </section>
    </div>
  )
}
