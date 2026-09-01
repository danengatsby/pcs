import { Link, useParams } from 'react-router-dom'
import { documentBySlug, documents } from '../config'

export function DocumentPage() {
  const { documentSlug } = useParams()
  const document = documentSlug ? documentBySlug[documentSlug] : undefined

  if (!document) {
    return (
      <section className="document-page">
        <div className="document-page__hero">
          <div>
            <div className="hero-kicker">Documente PCP</div>
            <h1>Document indisponibil</h1>
            <p className="lead">Documentul cerut nu există sau nu este publicat în această secțiune.</p>
          </div>
          <Link className="btn" to="/">
            Înapoi la început
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="document-page">
      <div className="document-page__hero">
        <div>
          <div className="hero-kicker">Documente PCP</div>
          <h1>{document.pageTitle}</h1>
          <p className="lead">{document.description}</p>
        </div>
        <a className="btn" href={document.assetPath} target="_blank" rel="noreferrer">
          Deschide separat
        </a>
      </div>

      <nav className="document-page__tabs" aria-label="Navigare documente">
        {documents.map((item) => (
          <Link
            key={item.slug}
            className={`document-page__tab${item.slug === document.slug ? ' is-active' : ''}`}
            to={`/documente/${item.slug}`}
          >
            {item.menuLabel}
          </Link>
        ))}
      </nav>

      <div className="document-page__viewer">
        <iframe className="document-page__frame" src={document.assetPath} title={document.pageTitle} loading="lazy" />
      </div>
    </section>
  )
}
