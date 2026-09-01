import { useNews } from '../hooks/useNews'
import { NewsPanels } from '../components/NewsPanels'

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

        <NewsPanels items={items} />
      </section>
    </div>
  )
}
