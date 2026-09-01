import { Link } from 'react-router-dom'
import { formatNewsDate } from '../formatNewsDate'
import type { NewsItem } from '../types'

type NewsPanelsProps = {
  items: NewsItem[]
}

export function NewsPanels({ items }: NewsPanelsProps) {
  return (
    <div className="grid-2">
      {items.map((item) => (
        <article key={item.id} className="card news-card">
          <div className="news-card__meta">
            {item.category ? <span className="news-card__category">{item.category}</span> : null}
            {item.publishedAt ? (
              <time dateTime={item.publishedAt}>{formatNewsDate(item.publishedAt)}</time>
            ) : null}
          </div>
          <h2>
            <Link className="text-link" to={`/news/${encodeURIComponent(item.id)}`}>
              {item.title}
            </Link>
          </h2>
          {item.summary ? <p className="muted">{item.summary}</p> : null}
          {item.sourceName && item.sourceUrl ? (
            <a
              className="text-link news-card__source"
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Citește articolul citat — {item.sourceName} ↗
            </a>
          ) : null}
        </article>
      ))}
    </div>
  )
}
