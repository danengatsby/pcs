import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAdminWorkspace } from './AdminContext'
import { adminNavigation, adminNavigationGroups } from './adminNavigation'

export function RequireCapability({ capability, children }: { capability: string; children: ReactNode }) {
  const { access } = useAdminWorkspace()
  if (!access.capabilities.includes(capability)) return <section role="alert">
    <h1>Acces restricționat</h1><p>Mandatul tău nu permite accesul la această zonă.</p><Link to="/admin">Înapoi la administrare</Link>
  </section>
  return <>{children}</>
}

export function AdminHomePage() {
  const { access, tasks } = useAdminWorkspace()
  const navigation = adminNavigation.filter((item) => access.capabilities.includes(item.capability))
  const pending = navigation.filter((item) => item.tasks && (tasks?.counts[item.key] ?? 0) > 0)
    .sort((a, b) => (tasks?.counts[b.key] ?? 0) - (tasks?.counts[a.key] ?? 0))
  const countsComplete = tasks && navigation.every((item) => !item.tasks || tasks.counts[item.key] !== undefined)
  return <section className="admin-home">
    <header className="admin-home__header">
      <span className="admin-workspace__eyebrow">Spațiul tău de lucru</span>
      <h1>Administrare</h1>
      <p className="lead">Vezi ce necesită atenție, apoi deschide registrul potrivit.</p>
      <p className="muted">Arie autorizată: {access.scope.label}</p>
    </header>
    <section className="card admin-home__attention" aria-labelledby="admin-attention-title">
      <div className="admin-home__section-heading"><div><span className="admin-workspace__eyebrow">De urmărit</span><h2 id="admin-attention-title">Necesită atenție</h2></div>
        {tasks && <span className="admin-home__total">{tasks.total} {tasks.total === 1 ? 'activitate în așteptare' : 'activități în așteptare'}</span>}
      </div>
      {!countsComplete && <p role="status">Situația sarcinilor este incompletă sau indisponibilă. Poți consulta registrele de mai jos.</p>}
      {countsComplete && pending.length === 0 && <p>Nu sunt activități în așteptare conform criteriilor urmărite.</p>}
      {pending.length > 0 && <ul className="admin-home__queue">{pending.map((item) => <li key={item.key}>
        <Link to={`/admin/${item.path}`}><span className="admin-home__queue-count">{tasks?.counts[item.key]}</span><span><strong>{item.label}</strong><small>{item.tasks}</small></span><span aria-hidden="true">→</span></Link>
      </li>)}</ul>}
      <details className="admin-home__help"><summary>Ce includ aceste numere?</summary><p>Contoarele includ lucrări în așteptare, nu doar termene depășite. Același dosar poate necesita activități distincte în CRM și în registrul membrilor. Totalul reprezintă activități, nu persoane unice.</p></details>
    </section>
    <div className="admin-home__registers">
      {adminNavigationGroups.map((group) => {
        const items = navigation.filter((item) => item.group === group.key)
        if (!items.length) return null
        return <section key={group.key} aria-labelledby={`admin-home-${group.key}`}>
          <div className="admin-home__section-heading"><div><h2 id={`admin-home-${group.key}`}>{group.label}</h2><p className="muted">{group.description}</p></div></div>
          <div className="admin-workspace__grid">{items.map((item) => <Link className="card admin-home__register" to={`/admin/${item.path}`} key={item.key}>
            <div><h3>{item.label}</h3><p>{item.description}</p></div><span aria-hidden="true">→</span>
          </Link>)}</div>
        </section>
      })}
      {navigation.length === 0 && <p>Nu ai registre disponibile pentru mandatul curent.</p>}
    </div>
  </section>
}
