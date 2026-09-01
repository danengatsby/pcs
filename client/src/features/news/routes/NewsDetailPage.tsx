import { Link, useParams } from 'react-router-dom'
import { useNewsById } from '../hooks/useNewsById'

export function NewsDetailPage() {
  const params = useParams()
  const id = params.id ?? ''

  const { item, loading, error } = useNewsById(id)

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-kicker">Știri și comunicate</div>
        <h1>{item?.title ?? 'Știre'}</h1>
        <p className="lead">
          {item?.publishedAt ? `Publicat: ${item.publishedAt}` : 'Detaliu știre'}
        </p>
      </section>

      <section className="section">
        <div className="row row-between">
          <Link className="text-link" to="/news">
            ← Înapoi la listă
          </Link>
        </div>

        {loading ? <p className="mt-12">Se încarcă…</p> : null}
        {error ? <p className="alert error mt-12">Eroare: {error}</p> : null}

        {!loading && !error && item ? (
          <article className="card mt-18">
            {item.summary ? <p className="muted">{item.summary}</p> : null}

            {item.content ? (
              <div className="mt-18 prose">{item.content}</div>
            ) : (
              <p className="muted mt-18">Conținut indisponibil.</p>
            )}
          </article>
        ) : null}
      </section>
    </div>
  )
}
