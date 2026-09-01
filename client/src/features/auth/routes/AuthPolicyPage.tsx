import { useAuthPolicy } from '../hooks/useAuthPolicy'

export function AuthPolicyPage() {
  const { data, loading, error } = useAuthPolicy()
  const policy = data?.tokenPolicy
  const accessMinutes = policy ? Math.round(policy.accessTokenTtlSeconds / 60) : 0

  return (
    <section className="home">
      <div className="hero">
        <div className="hero-kicker">Securitatea contului</div>
        <h1>Politica de autentificare</h1>
        <p className="lead">Informații despre durata sesiunii și protecția autentificării.</p>
      </div>

      {loading ? <p>Se încarcă…</p> : null}
      {error ? <p className="alert error">Eroare: {error}</p> : null}

      {policy ? (
        <div className="grid mt-18">
          <article className="card">
            <h2>Token de acces</h2>
            <p>Valabil aproximativ {accessMinutes} minute.</p>
          </article>
          <article className="card">
            <h2>Sesiune persistentă</h2>
            <p>{policy.refreshToken.enabled ? 'Activată, cu rotație la reîmprospătare.' : 'Dezactivată.'}</p>
          </article>
          <article className="card">
            <h2>Protecție CSRF</h2>
            <p>
              {policy.refreshToken.csrfProtection === 'double-submit-cookie'
                ? 'Activă pentru reîmprospătarea sesiunii.'
                : 'Nu este necesară cât timp sesiunea persistentă este dezactivată.'}
            </p>
          </article>
        </div>
      ) : null}
    </section>
  )
}
