import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { NewsPanels } from '@features/news/components/NewsPanels'
import { useNews } from '@features/news/hooks/useNews'

type TopicSection = {
  title: string
  description: string
}

type TopicPageProps = {
  kicker: string
  title: string
  introduction: string
  sectionsLabel: string
  sections: TopicSection[]
  commitmentTitle: string
  commitment: string
  primaryAction: {
    label: string
    to: string
  }
  secondaryAction?: {
    label: string
    to: string
  }
  children?: ReactNode
}

function HomeTopicPage({
  kicker,
  title,
  introduction,
  sectionsLabel,
  sections,
  commitmentTitle,
  commitment,
  primaryAction,
  secondaryAction,
  children,
}: TopicPageProps) {
  return (
    <div className="topic-page">
      <Link className="text-link topic-page__back" to="/">
        ← Înapoi la Acasă
      </Link>

      <section className="topic-page__hero">
        <div className="hero-kicker">{kicker}</div>
        <h1>{title}</h1>
        <p className="lead">{introduction}</p>
      </section>

      <section className="topic-page__section" aria-labelledby="topic-sections-title">
        <h2 id="topic-sections-title">{sectionsLabel}</h2>
        <div className="topic-page__grid">
          {sections.map((section) => (
            <article className="card topic-page__card" key={section.title}>
              <h3>{section.title}</h3>
              <p>{section.description}</p>
            </article>
          ))}
        </div>
      </section>

      {children}

      <section className="topic-page__commitment">
        <div>
          <div className="hero-kicker">Angajamentul nostru</div>
          <h2>{commitmentTitle}</h2>
          <p>{commitment}</p>
        </div>
        <div className="topic-page__actions">
          <Link className="btn primary" to={primaryAction.to}>
            {primaryAction.label}
          </Link>
          {secondaryAction ? (
            <Link className="btn" to={secondaryAction.to}>
              {secondaryAction.label}
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  )
}

export function NewsCommunicationPage() {
  const { items, loading, error } = useNews()
  const sourcedNews = items
    .filter((item) => item.sourceName && item.sourceUrl)
    .slice(0, 4)

  return (
    <HomeTopicPage
      kicker="Informare publică"
      title="Știri și comunicare"
      introduction="Seniorii au nevoie de informații clare, utile și ușor de verificat. Aici explicăm cum comunică PCS și cum aducem în atenția publică problemele care contează."
      sectionsLabel="Cum informăm comunitatea"
      sections={[
        {
          title: 'Informații verificate',
          description:
            'Selectăm teme de interes pentru seniori, indicăm sursa materialelor citate și separăm faptele de opinii.',
        },
        {
          title: 'Comunicate PCS',
          description:
            'Prezentăm public pozițiile, inițiativele și răspunsurile partidului într-un limbaj direct și accesibil.',
        },
        {
          title: 'Dialog cu seniorii',
          description:
            'Colectăm întrebări și semnale din comunitate pentru ca subiectele locale să ajungă în spațiul public.',
        },
      ]}
      commitmentTitle="Claritate, surse și corecturi transparente"
      commitment="Publicăm legătura către articolul-sursă atunci când cităm presa, actualizăm informațiile care se schimbă și corectăm vizibil eventualele erori."
      primaryAction={{ label: 'Vezi toate știrile', to: '/news' }}
      secondaryAction={{ label: 'Propune un subiect', to: '/contact' }}
    >
      <section className="topic-page__news" aria-labelledby="senior-news-title">
        <div className="topic-page__news-header">
          <div>
            <div className="hero-kicker">Actualitate</div>
            <h2 id="senior-news-title">Știri recente pentru seniori</h2>
            <p>Selecție de informații utile, cu acces direct la publicația sau instituția citată.</p>
          </div>
          <Link className="btn" to="/news">
            Vezi arhiva de știri
          </Link>
        </div>

        {loading ? <p>Se încarcă știrile…</p> : null}
        {error ? <p className="alert error">Știrile nu au putut fi încărcate: {error}</p> : null}
        {!loading && !error && sourcedNews.length === 0 ? (
          <p>Nu există momentan știri cu sursă publicată.</p>
        ) : null}
        {sourcedNews.length > 0 ? <NewsPanels items={sourcedNews} section="press" /> : null}
      </section>
    </HomeTopicPage>
  )
}

export function VolunteeringPage() {
  return (
    <HomeTopicPage
      kicker="Implicare civică"
      title="Voluntariat pentru comunitate"
      introduction="Experiența, timpul și priceperea fiecărui senior pot deveni sprijin concret pentru comunitate. PCS creează echipe locale în care fiecare voluntar își poate găsi un rol potrivit."
      sectionsLabel="Unde poți contribui"
      sections={[
        {
          title: 'Informare locală',
          description:
            'Ajută la distribuirea informațiilor utile și la identificarea problemelor cu care se confruntă seniorii din localitatea ta.',
        },
        {
          title: 'Sprijin comunitar',
          description:
            'Participă la inițiative de solidaritate, îndrumare și sprijin pentru persoanele care au nevoie de ajutor.',
        },
        {
          title: 'Organizare și evenimente',
          description:
            'Contribuie cu experiența ta la întâlniri locale, consultări publice, campanii și activități ale comunității.',
        },
      ]}
      commitmentTitle="Un rol potrivit pentru fiecare voluntar"
      commitment="După trimiterea cererii, datele și competențele declarate ne ajută să identificăm forma de implicare potrivită și echipa locală relevantă."
      primaryAction={{ label: 'Vezi acțiunile deschise', to: '/mobilizare' }}
      secondaryAction={{ label: 'Aderă la PCS', to: '/contact#aderare' }}
    />
  )
}

export function TransparencyPage() {
  return (
    <HomeTopicPage
      kicker="Încredere publică"
      title="Transparență și responsabilitate"
      introduction="Încrederea se construiește prin reguli cunoscute, documente accesibile și protejarea responsabilă a datelor. Punem la dispoziție reperele după care funcționează PCS."
      sectionsLabel="Ce înseamnă transparența pentru PCS"
      sections={[
        {
          title: 'Documente publice',
          description:
            'Statutul, programul politic și regulamentele relevante sunt disponibile integral pentru consultare online.',
        },
        {
          title: 'Reguli și responsabilități',
          description:
            'Organizarea și activitatea partidului urmează cadrul legal și proceduri clare, care pot fi verificate de membri și public.',
        },
        {
          title: 'Date și securitate',
          description:
            'Explicăm ce date folosim, de ce sunt necesare și ce măsuri aplicăm pentru protejarea conturilor și informațiilor personale.',
        },
      ]}
      commitmentTitle="Documente accesibile și reguli explicate"
      commitment="Publicăm documentele esențiale într-un format ușor de consultat și prezentăm separat politicile de autentificare, confidențialitate și securitate."
      primaryAction={{ label: 'Consultă documentele PCS', to: '/documente/statut' }}
      secondaryAction={{ label: 'Politici și securitate', to: '/auth/policy' }}
    />
  )
}
