import { useNews } from '../hooks/useNews'
import { NewsPanels } from '../components/NewsPanels'
import { groupNewsByEditorialSection, newsEditorialSections } from '../editorialSections'

export function NewsListPage() {
  const { items, loading, error } = useNews()
  const groupedItems = groupNewsByEditorialSection(items)
  const pcsItemsCount = groupedItems.positions.length + groupedItems.local.length + groupedItems.releases.length

  return (
    <div className="news-hub">
      <section className="news-hub__hero">
        <div>
          <div className="hero-kicker">Centrul editorial PCS</div>
          <h1>Vocea PCS, distinctă de informația din presă.</h1>
          <p className="lead">
            Aici separăm conținutul asumat de partid de articolele pe care le selectăm din surse externe. Știi
            întotdeauna cine vorbește și de unde vine informația.
          </p>
        </div>
        <aside className="news-hub__summary" aria-label="Rezumat editorial">
          <div>
            <strong>{pcsItemsCount}</strong>
            <span>{pcsItemsCount === 1 ? 'material publicat de PCS' : 'materiale publicate de PCS'}</span>
          </div>
          <div>
            <strong>{groupedItems.press.length}</strong>
            <span>{groupedItems.press.length === 1 ? 'informație din sursă externă' : 'informații din surse externe'}</span>
          </div>
        </aside>
      </section>

      <nav className="news-hub__directory" aria-label="Secțiuni editoriale">
        {newsEditorialSections.map((section) => (
          <a key={section.key} href={`#${section.key}`} className={`news-directory-card is-${section.key}`}>
            <span>{section.kicker}</span>
            <strong>{section.label}</strong>
            <small>
              {groupedItems[section.key].length} {groupedItems[section.key].length === 1 ? 'articol' : 'articole'}
            </small>
          </a>
        ))}
      </nav>

      {loading ? <p className="news-hub__state">Se încarcă publicațiile…</p> : null}
      {error ? <p className="alert error">Publicațiile nu au putut fi încărcate: {error}</p> : null}
      {!loading && !error && items.length === 0 ? (
        <p className="news-hub__state">Nu există publicații disponibile momentan.</p>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="news-streams">
          {newsEditorialSections.map((section) => {
            const sectionItems = groupedItems[section.key]
            return (
              <section
                className={`news-stream news-stream--${section.key}`}
                id={section.key}
                aria-labelledby={`news-stream-${section.key}`}
                key={section.key}
              >
                <header className="news-stream__header">
                  <div>
                    <div className="hero-kicker">{section.kicker}</div>
                    <h2 id={`news-stream-${section.key}`}>{section.label}</h2>
                  </div>
                  <div className="news-stream__description">
                    <p>{section.description}</p>
                    <span>{sectionItems.length} {sectionItems.length === 1 ? 'material' : 'materiale'}</span>
                  </div>
                </header>

                {section.key === 'press' ? (
                  <div className="news-stream__disclaimer">
                    <strong>Conținut extern</strong>
                    <span>Publicarea în această secțiune nu înseamnă automat susținerea editorială a PCS.</span>
                  </div>
                ) : null}

                {sectionItems.length > 0 ? (
                  <NewsPanels items={sectionItems} section={section.key} />
                ) : (
                  <p className="news-stream__empty">{section.emptyMessage}</p>
                )}
              </section>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
