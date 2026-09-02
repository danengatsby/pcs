import { Link } from 'react-router-dom'
import pcsLogo from '../../../assets/pcs-logo.svg'

const priorities = [
  {
    number: '01',
    title: 'Pensia demnă',
    description:
      'Indexare automată la inflația reală, recalculare echitabilă și protejarea puterii de cumpărare după o viață de muncă.',
    commitment: 'Țintă: pensie minimă garantată de 2.500 lei',
  },
  {
    number: '02',
    title: 'Sănătate integrală',
    description:
      'Medicamente esențiale compensate, servicii de geriatrie și îngrijire la domiciliu accesibile în fiecare comunitate.',
    commitment: 'Pachet medical minim garantat pentru seniori',
  },
  {
    number: '03',
    title: 'Incluziune socială activă',
    description:
      'Centre de zi, transport accesibil și programe care păstrează seniorii activi, conectați și respectați.',
    commitment: 'Țintă: 200 de centre de zi până în 2030',
  },
]

const positions = [
  'Nu susținem tăieri de pensii, înghețarea indexării sau eliminarea beneficiilor sociale.',
  'Susținem orice inițiativă în favoarea seniorilor, indiferent de autorul ei politic.',
  'Fiecare promisiune trebuie să indice sursa de finanțare și termenul de realizare.',
  'Cerem un capitol dedicat seniorilor în orice program de guvernare al României.',
]

const leadership = [
  {
    abbreviation: 'P',
    title: 'Președintele PCS',
    description: 'Reprezintă partidul, asumă direcția politică și răspunde public pentru mandatul primit.',
  },
  {
    abbreviation: 'CN',
    title: 'Consiliul Național',
    description: 'Stabilește prioritățile între congrese și urmărește transformarea programului în acțiune politică.',
  },
  {
    abbreviation: 'BPN',
    title: 'Biroul Politic Național',
    description: 'Coordonează activitatea executivă, organizațiile teritoriale și pregătirea echipelor pentru alegeri.',
  },
]

const heroAnswers = [
  {
    question: 'Ce apără PCS?',
    answer: 'Demnitatea câștigată printr-o viață de muncă.',
    detail: 'Pensii care țin pasul cu realitatea, sănătate accesibilă și un cuvânt greu de spus în decizia publică.',
  },
  {
    question: 'Ce a făcut concret?',
    answer: 'A publicat un program cu ținte verificabile.',
    detail: 'Șapte obiective pentru 2034, priorități imediate, indicatori publici și raportare a progresului la fiecare șase luni.',
  },
  {
    question: 'Cum mă pot implica astăzi?',
    answer: 'Alegi pasul potrivit pentru tine.',
    detail: 'Citești programul, depui cererea de aderare sau intri în legătură cu organizația PCS din județul tău.',
  },
]

export function HomePage() {
  return (
    <div className="home home--political">
      <section className="hero home-hero">
        <div className="hero-shell">
          <div className="hero-copy">
            <div className="hero-kicker">Ce apărăm · Ce facem · Cum te implici</div>
            <h1 className="home-hero__headline">
              Demnitate pentru seniori.
              <span>Răspundere pentru România.</span>
            </h1>
            <p className="lead home-hero__lead">
              PCS apără pensia demnă, sănătatea accesibilă și dreptul seniorilor de a decide. Am publicat
              Programul 2026—2034: șapte obiective măsurabile și raportare publică la fiecare șase luni.
            </p>

            <div className="hero-actions">
              <Link className="btn primary home-hero__primary" to="/documente/program-politic">
                Citește programul
              </Link>
              <Link className="btn" to="/contact#aderare">
                Aderă la PCS
              </Link>
              <Link className="btn" to="/contact#filiale">
                Găsește organizația din județul tău
              </Link>
            </div>
          </div>

          <aside className="hero-logo home-hero__identity" aria-label="Identitatea Partidului Conservator al Seniorilor">
            <img src={pcsLogo} alt="Sigla PCS" />
            <div>
              <strong>Partidul Conservator al Seniorilor</strong>
              <span>Respect · Demnitate · Solidaritate</span>
            </div>
          </aside>
        </div>

        <div className="home-hero__answers" aria-label="PCS pe scurt">
          {heroAnswers.map((item) => (
            <article key={item.question}>
              <span>{item.question}</span>
              <strong>{item.answer}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-scorecard" aria-label="Programul PCS pe scurt">
        <div>
          <strong>7</strong>
          <span>obiective strategice pentru 2034</span>
        </div>
        <div>
          <strong>3</strong>
          <span>priorități naționale imediate</span>
        </div>
        <div>
          <strong>6 luni</strong>
          <span>între rapoartele publice de progres</span>
        </div>
      </section>

      <section className="home-section" id="prioritati" aria-labelledby="home-priorities-title">
        <div className="home-section__heading">
          <div>
            <div className="hero-kicker">Priorități de guvernare</div>
            <h2 id="home-priorities-title">Primele trei angajamente ale PCS</h2>
          </div>
          <p>
            Măsuri concrete, termene publice și rezultate care pot fi verificate. Acesta este standardul după care
            cerem să fim judecați.
          </p>
        </div>

        <div className="home-priorities">
          {priorities.map((priority) => (
            <article className="home-priority" key={priority.number}>
              <span className="home-priority__number" aria-hidden="true">{priority.number}</span>
              <h3>{priority.title}</h3>
              <p>{priority.description}</p>
              <strong>{priority.commitment}</strong>
            </article>
          ))}
        </div>

        <Link className="text-link home-section__link" to="/documente/program-politic">
          Vezi toate cele șapte obiective și planul de implementare →
        </Link>
      </section>

      <section className="home-position" aria-labelledby="home-position-title">
        <div className="home-position__intro">
          <div className="hero-kicker">Pozițiile PCS</div>
          <h2 id="home-position-title">Spunem clar ce susținem și ce nu negociem.</h2>
          <p>
            Colaborăm cu orice forță politică ce respectă seniorii, dar nu schimbăm drepturile câștigate pe funcții
            sau înțelegeri de culise.
          </p>
          <Link className="btn" to="/manifest">
            Citește manifestul PCS
          </Link>
        </div>

        <ul className="home-position__list">
          {positions.map((position) => (
            <li key={position}>
              <span aria-hidden="true">✓</span>
              <p>{position}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-section" id="conducere" aria-labelledby="home-leadership-title">
        <div className="home-section__heading">
          <div>
            <div className="hero-kicker">Conducere și răspundere</div>
            <h2 id="home-leadership-title">Un mandat clar la fiecare nivel</h2>
          </div>
          <p>
            Conducerea PCS este aleasă conform statutului. Fiecare structură are atribuții distincte și răspunde
            pentru deciziile, obiectivele și rezultatele sale.
          </p>
        </div>

        <div className="home-leadership">
          {leadership.map((role) => (
            <article className="home-leader" key={role.abbreviation}>
              <span className="home-leader__mark" aria-hidden="true">{role.abbreviation}</span>
              <div>
                <h3>{role.title}</h3>
                <p>{role.description}</p>
              </div>
            </article>
          ))}
        </div>

        <Link className="text-link home-section__link" to="/documente/statut">
          Vezi statutul și atribuțiile conducerii →
        </Link>
      </section>

      <section className="home-local" aria-labelledby="home-local-title">
        <div className="home-local__copy">
          <div className="hero-kicker">Din comunități, în decizia publică</div>
          <h2 id="home-local-title">Obiective naționale cu rezultate măsurabile în fiecare localitate</h2>
          <p>
            Organizațiile PCS duc problemele seniorilor din cartier și comună în programul național. Progresul va fi
            urmărit prin indicatori publici, nu prin fotografii de campanie.
          </p>
        </div>

        <div className="home-local__outcomes">
          <article>
            <strong>3 reprezentanți</strong>
            <span>ai seniorilor vizați în fiecare consiliu local și județean</span>
          </article>
          <article>
            <strong>200 centre</strong>
            <span>de zi pentru seniori, operaționale până în 2030</span>
          </article>
          <article>
            <strong>Raport public</strong>
            <span>cu progres, responsabili și surse verificabile la fiecare 6 luni</span>
          </article>
        </div>
      </section>

      <section className="home-mobilize" aria-labelledby="home-mobilize-title">
        <div className="home-mobilize__heading">
          <div className="hero-kicker">Treci de la acord la acțiune</div>
          <h2 id="home-mobilize-title">Alege o formă concretă de implicare.</h2>
          <p>
            Participă la un eveniment, preia o sarcină pentru voluntari, susține o petiție sau contribuie la o
            consultare din județul tău.
          </p>
        </div>
        <div className="home-mobilize__options">
          <article><span>01</span><strong>Participă</strong><p>Evenimente și campanii cu înscriere și confirmare clară.</p></article>
          <article><span>02</span><strong>Contribuie</strong><p>Sarcini punctuale, potrivite timpului și competențelor tale.</p></article>
          <article><span>03</span><strong>Fă-te auzit</strong><p>Petiții și consultări direcționate după județ și temă.</p></article>
        </div>
        <Link className="btn primary" to="/mobilizare">Deschide centrul de mobilizare</Link>
      </section>

      <section className="home-cta" aria-labelledby="home-cta-title">
        <div>
          <div className="hero-kicker">Construim o forță politică serioasă</div>
          <h2 id="home-cta-title">Experiența ta poate schimba decizia publică.</h2>
          <p>Devino membru, sprijină organizația din județul tău și contribuie la programul PCS.</p>
        </div>
        <div className="home-cta__actions">
          <Link className="btn primary" to="/contact#aderare">Aderă la PCS</Link>
          <Link className="btn" to="/documente/program-politic">Analizează programul</Link>
        </div>
      </section>
    </div>
  )
}
