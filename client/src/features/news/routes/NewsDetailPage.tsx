import { Link, useParams } from 'react-router-dom'
import { useNewsById } from '../hooks/useNewsById'
import { formatNewsDate } from '../formatNewsDate'
import { getNewsEditorialSection } from '../editorialSections'

export function NewsDetailPage() {
  const params = useParams()
  const id = params.id ?? ''

  const { item, loading, error } = useNewsById(id)
  const editorialSection = item ? getNewsEditorialSection(item) : null

  return (
    <div className="home news-detail">
      <section className="hero">
        <div className="hero-kicker">{editorialSection?.label ?? 'Centrul editorial PCS'}</div>
        <h1>{item?.title ?? 'Știre'}</h1>
        <p className="lead">
          {item?.publishedAt ? `Publicat: ${formatNewsDate(item.publishedAt)}` : 'Detaliu știre'}
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
            <div className="news-detail__identity">
              <span>{editorialSection?.key === 'press' ? 'Conținut din sursă externă' : 'Conținut publicat de PCS'}</span>
              {item.category ? <strong>{item.category}</strong> : null}
            </div>
            {item.summary ? <p className="muted">{item.summary}</p> : null}

            {item.content ? (
              <div className="mt-18 prose">{item.content}</div>
            ) : (
              <p className="muted mt-18">Conținut indisponibil.</p>
            )}

            {item.sourceName && item.sourceUrl ? (
              <div className="news-source-box mt-18">
                <span>
                  <strong>Sursă externă: {item.sourceName}</strong>
                  <small>Material selectat pentru informare; opiniile aparțin publicației citate.</small>
                </span>
                <a
                  className="text-link"
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Citește articolul original ↗
                </a>
              </div>
            ) : null}
          </article>
        ) : null}
      </section>
    </div>
  )
}
