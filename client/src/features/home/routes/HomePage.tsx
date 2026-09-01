import { Link } from 'react-router-dom'
import pcsLogo from '../../../assets/pcs-logo.svg'

export function HomePage() {
  return (
    <div className="home">
      <section className="hero">
        <div className="hero-shell">
          <div className="hero-copy">
            <div className="hero-kicker">Platforma Partidului Conservator al Seniorilor</div>
            <h1 className="home__headline">
              <span className="home__headline-prefix">PCS —</span>
              <span className="home__headline-main">PARTIDUL</span>
              <span className="home__headline-subtitle">CONSERVATOR AL</span>
              <span className="home__headline-tail">SENIORILOR</span>
            </h1>
            <p className="lead">
              Inițiative civice, știri și mobilizare voluntară. Construim o platformă modernă pentru informare,
              transparență și implicare.
            </p>

            <div className="hero-actions">
              <Link className="btn primary" to="/news">
                Vezi știrile
              </Link>
              <Link className="btn" to="/contact">
                Contact
              </Link>
            </div>
          </div>

          <aside className="hero-logo" aria-label="Sigla PCS">
            <img src={pcsLogo} alt="Sigla PCS" />
          </aside>
        </div>
      </section>

      <section className="grid" aria-label="Direcții de implicare PCS">
        <Link className="card home-topic-card" to="/initiative/stiri-si-comunicare">
          <h2>Știri & comunicare</h2>
          <p>Publicăm actualizări, comunicate și materiale media. Urmărește ultimele noutăți.</p>
          <span className="text-link">Descoperă această direcție →</span>
        </Link>

        <Link className="card home-topic-card" to="/initiative/voluntariat">
          <h2>Voluntariat</h2>
          <p>Implică-te în campanii locale și activități comunitare. Înscriere rapidă și organizare pe județe.</p>
          <span className="text-link">Află cum te poți implica →</span>
        </Link>

        <Link className="card home-topic-card" to="/initiative/transparenta">
          <h2>Transparență</h2>
          <p>Lucrăm cu reguli clare, date structurate și procese auditate. Încredere prin transparență.</p>
          <span className="text-link">Vezi principiile și documentele →</span>
        </Link>
      </section>

      <section className="split">
        <div>
          <h2>Ce găsești pe platformă</h2>
          <ul className="list">
            <li>Știri publice și arhivă</li>
            <li>Contact și formulare</li>
            <li>Zone administrative (în lucru)</li>
            <li>API pentru integrare și raportare</li>
          </ul>
        </div>
        <div className="note">
          <h3>Status</h3>
          <p className="muted">
            Platforma este în dezvoltare incrementală. Urmează: pagini dedicate programului, evenimente și membri.
          </p>
        </div>
      </section>
    </div>
  )
}
