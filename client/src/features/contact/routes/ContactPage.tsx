import { Link } from 'react-router-dom'
import { useCounties } from '../hooks/useCounties'
import { usePublicOrganizations } from '../hooks/usePublicOrganizations'
import { JoinRequestForm } from '../components/JoinRequestForm'

const statutoryHeadquarters = 'Șos. Bucium nr. 23, Iași, județul Iași'
const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(statutoryHeadquarters)}`

const publicContactEmail = import.meta.env.VITE_PUBLIC_CONTACT_EMAIL?.trim() ?? ''
const publicContactPhone = import.meta.env.VITE_PUBLIC_CONTACT_PHONE?.trim() ?? ''
const publicOfficeHours = import.meta.env.VITE_PUBLIC_OFFICE_HOURS?.trim()
  || 'Audiențe și întâlniri numai cu programare confirmată în prealabil.'

const responsibilities = [
  {
    area: 'Corespondență oficială și audiențe',
    title: 'Secretariatul General',
    description: 'Primește petiții, solicitări instituționale, invitații și cereri de audiență adresate conducerii PCS.',
  },
  {
    area: 'Filiale și probleme locale',
    title: 'Organizațiile teritoriale',
    description: 'Preiau sesizările din comunitate și coordonează activitatea membrilor la nivel județean și local.',
  },
  {
    area: 'Presă și poziții publice',
    title: 'Biroul de comunicare',
    description: 'Gestionează solicitările jurnaliștilor, comunicatele și punctele de vedere oficiale ale partidului.',
  },
]

export function ContactPage() {
  const { loading: countiesLoading, error: countiesError, counties } = useCounties()
  const {
    organizations,
    loading: organizationsLoading,
    error: organizationsError,
  } = usePublicOrganizations()

  const nationalOrganization = organizations.find((organization) => organization.level === 'national')
  const branches = organizations.filter((organization) => organization.level !== 'national')
  const headquarters = nationalOrganization?.headquarters || statutoryHeadquarters
  const generalEmail = nationalOrganization?.officialEmail || publicContactEmail
  const generalPhone = nationalOrganization?.phone || publicContactPhone
  const nationalLeaders = nationalOrganization?.leaders ?? []

  return (
    <div className="contact-page">
      <section className="contact-hero">
        <div>
          <div className="hero-kicker">Contact oficial PCS</div>
          <h1>Suntem aici pentru dialog, nu doar pentru înscrieri.</h1>
          <p className="lead">
            Găsește sediul central, canalele instituționale și organizația din teritoriu. Formularul de aderare este
            disponibil separat, la finalul paginii.
          </p>
          <div className="hero-actions">
            <a className="btn primary" href="#aderare">Aderă la PCS</a>
            <a className="btn" href="#coordonate">Date de contact</a>
            <a className="btn" href="#filiale">Găsește filiala</a>
          </div>
        </div>
        <aside className="contact-hero__aside">
          <span>Răspundem prin canalul potrivit</span>
          <strong>Instituțional · Teritorial · Aderare</strong>
          <p>Pentru un răspuns mai rapid, menționează localitatea și subiectul solicitării.</p>
        </aside>
      </section>

      <section className="contact-section" id="coordonate" aria-labelledby="contact-details-title">
        <div className="contact-section__heading">
          <div>
            <div className="hero-kicker">Coordonate oficiale</div>
            <h2 id="contact-details-title">Contactează sediul central</h2>
          </div>
          <p>Datele sunt preluate din statut și din registrul organizațional public al PCS.</p>
        </div>

        <div className="contact-details">
          <article className="contact-detail-card contact-detail-card--wide">
            <span className="contact-detail-card__label">Sediu central</span>
            <strong>{headquarters}</strong>
            <p>Corespondența oficială poate fi transmisă în atenția Secretariatului General.</p>
            <a className="text-link" href={mapsUrl} target="_blank" rel="noreferrer">
              Deschide adresa pe hartă ↗
            </a>
          </article>

          <article className="contact-detail-card">
            <span className="contact-detail-card__label">Email general</span>
            {generalEmail ? (
              <a className="contact-detail-card__value" href={`mailto:${generalEmail}`}>{generalEmail}</a>
            ) : (
              <strong className="contact-detail-card__pending">În curs de publicare</strong>
            )}
            <p>{generalEmail ? 'Pentru petiții și corespondență instituțională.' : 'Folosește momentan corespondența la sediul central.'}</p>
          </article>

          <article className="contact-detail-card">
            <span className="contact-detail-card__label">Telefon general</span>
            {generalPhone ? (
              <a className="contact-detail-card__value" href={`tel:${generalPhone.replace(/[^\d+]/g, '')}`}>
                {generalPhone}
              </a>
            ) : (
              <strong className="contact-detail-card__pending">În curs de publicare</strong>
            )}
            <p>{generalPhone ? 'Apeluri și informații generale.' : 'Numărul va apărea aici după validarea oficială.'}</p>
          </article>

          <article className="contact-detail-card">
            <span className="contact-detail-card__label">Program cu publicul</span>
            <strong>{publicOfficeHours}</strong>
            <p>Nu te deplasa la sediu fără o confirmare prealabilă.</p>
          </article>
        </div>
      </section>

      <section className="contact-section" aria-labelledby="contact-responsibilities-title">
        <div className="contact-section__heading">
          <div>
            <div className="hero-kicker">Cine răspunde</div>
            <h2 id="contact-responsibilities-title">Responsabili pe tipuri de solicitări</h2>
          </div>
          <p>Solicitările sunt direcționate după competență, nu amestecate cu cererile de aderare.</p>
        </div>

        <div className="contact-responsibilities">
          {responsibilities.map((responsibility) => (
            <article key={responsibility.title}>
              <span>{responsibility.area}</span>
              <h3>{responsibility.title}</h3>
              <p>{responsibility.description}</p>
            </article>
          ))}
        </div>

        {nationalLeaders.length > 0 ? (
          <div className="contact-national-leaders" aria-label="Responsabili naționali în funcție">
            {nationalLeaders.map((leader) => (
              <div key={`${leader.positionTitle}-${leader.fullName}`}>
                <span>{leader.positionTitle}</span>
                <strong>{leader.fullName}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="contact-section" id="filiale" aria-labelledby="contact-branches-title">
        <div className="contact-section__heading">
          <div>
            <div className="hero-kicker">În teritoriu</div>
            <h2 id="contact-branches-title">Organizații județene și locale</h2>
          </div>
          <p>Sunt afișate exclusiv organizațiile active și datele lor de contact validate în registrul PCS.</p>
        </div>

        {organizationsLoading ? <p className="contact-registry-state">Se încarcă registrul teritorial…</p> : null}
        {organizationsError ? <p className="alert error">{organizationsError}</p> : null}
        {!organizationsLoading && !organizationsError && branches.length === 0 ? (
          <div className="contact-registry-state contact-registry-state--empty">
            <strong>Nicio filială activă nu este încă publicată în registru.</strong>
            <p>
              Pentru legătura cu echipa din județul tău, indică județul și localitatea în cererea de aderare.
            </p>
            <a className="text-link" href="#aderare">Mergi la formularul de aderare →</a>
          </div>
        ) : null}

        {branches.length > 0 ? (
          <div className="contact-branches">
            {branches.map((branch) => (
              <article className="contact-branch" key={branch.id}>
                <div className="contact-branch__header">
                  <div>
                    <span>{branch.level === 'county' ? 'Organizație județeană' : 'Organizație locală'}</span>
                    <h3>{branch.name}</h3>
                  </div>
                  <strong>{branch.territories.join(' · ') || branch.county}</strong>
                </div>

                {branch.leaders.length > 0 ? (
                  <div className="contact-branch__leaders">
                    {branch.leaders.map((leader) => (
                      <p key={`${leader.positionTitle}-${leader.fullName}`}>
                        <span>{leader.positionTitle}</span>
                        <strong>{leader.fullName}</strong>
                      </p>
                    ))}
                  </div>
                ) : null}

                <div className="contact-branch__channels">
                  {branch.headquarters ? <span>{branch.headquarters}</span> : null}
                  {branch.officialEmail ? <a href={`mailto:${branch.officialEmail}`}>{branch.officialEmail}</a> : null}
                  {branch.phone ? (
                    <a href={`tel:${branch.phone.replace(/[^\d+]/g, '')}`}>{branch.phone}</a>
                  ) : null}
                  {!branch.headquarters && !branch.officialEmail && !branch.phone ? (
                    <span>Datele de contact ale filialei sunt în curs de publicare.</span>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="contact-membership" id="aderare" aria-labelledby="contact-membership-title">
        <aside className="contact-membership__intro">
          <div className="hero-kicker">Aderare la PCS</div>
          <h2 id="contact-membership-title">Vrei să intri în echipă?</h2>
          <p>
            Formularul alăturat este exclusiv pentru cereri de aderare. După trimitere, solicitarea este direcționată
            către organizația relevantă pentru județul și localitatea selectate.
          </p>
          <ol>
            <li>Completezi datele și motivația.</li>
            <li>Organizația teritorială verifică solicitarea.</li>
            <li>Primești pe email pașii următori.</li>
          </ol>
          <Link className="text-link" to="/documente/statut">Consultă statutul PCS →</Link>
        </aside>

        <JoinRequestForm
          countiesLoading={countiesLoading}
          countiesError={countiesError}
          counties={counties}
        />
      </section>
    </div>
  )
}
