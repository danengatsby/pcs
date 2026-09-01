import { Link } from 'react-router-dom'
import { useNews } from '../hooks/useNews'

export function NewsListPage() {
  const { items, loading, error } = useNews()

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-kicker">Știri și comunicate</div>
        <h1>Știri</h1>
        <p className="lead">Actualizări, comunicate și materiale informative.</p>
      </section>

      <section className="section">
        {loading ? <p>Se încarcă…</p> : null}
        {error ? <p className="alert error">Eroare: {error}</p> : null}

        {!loading && !error && items.length === 0 ? <p>Nu există știri.</p> : null}

        <div className="grid-2">
          {items.map((n) => (
            <article key={n.id} className="card">
              <h2>
                <Link className="text-link" to={`/news/${encodeURIComponent(n.id)}`}>
                  {n.title}
                </Link>
              </h2>
              {n.summary ? <p className="muted">{n.summary}</p> : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
