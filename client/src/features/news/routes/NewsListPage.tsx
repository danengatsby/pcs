import { Link } from 'react-router-dom'
import { useNews } from '../hooks/useNews'
import { formatNewsDate } from '../formatNewsDate'

export function NewsListPage() {
  const { items, loading, error } = useNews()

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-kicker">Știri și comunicate</div>
        <h1>Știri</h1>
        <p className="lead">Informații recente și utile pentru seniori, verificate din surse publice.</p>
      </section>

      <section className="section">
        {loading ? <p>Se încarcă…</p> : null}
        {error ? <p className="alert error">Eroare: {error}</p> : null}

        {!loading && !error && items.length === 0 ? <p>Nu există știri.</p> : null}

        <div className="grid-2">
          {items.map((n) => (
            <article key={n.id} className="card news-card">
              <div className="news-card__meta">
                {n.category ? <span className="news-card__category">{n.category}</span> : null}
                {n.publishedAt ? (
                  <time dateTime={n.publishedAt}>{formatNewsDate(n.publishedAt)}</time>
                ) : null}
              </div>
              <h2>
                <Link className="text-link" to={`/news/${encodeURIComponent(n.id)}`}>
                  {n.title}
                </Link>
              </h2>
              {n.summary ? <p className="muted">{n.summary}</p> : null}
              {n.sourceName && n.sourceUrl ? (
                <a
                  className="text-link news-card__source"
                  href={n.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Citește articolul citat — {n.sourceName} ↗
                </a>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
