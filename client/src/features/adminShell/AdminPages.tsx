import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAdminWorkspace } from './AdminContext'
import { adminNavigation, formatTaskCount } from './adminNavigation'

export function RequireCapability({ capability, children }: { capability: string; children: ReactNode }) {
  const { access } = useAdminWorkspace()
  if (!access.capabilities.includes(capability)) return <section role="alert">
    <h1>Acces restricționat</h1><p>Mandatul tău nu permite accesul la această zonă.</p><Link to="/admin">Înapoi la administrare</Link>
  </section>
  return <>{children}</>
}

export function AdminHomePage() {
  const { access, tasks } = useAdminWorkspace()
  return <section>
    <h1>Administrare</h1>
    <p className="lead">Sarcini și registre pentru aria {access.scope.label}.</p>
    <p>Contoarele includ lucrări în așteptare, nu doar termene depășite. Același dosar poate necesita activități distincte în CRM și în registrul membrilor.</p>
    <div className="admin-workspace__grid">
      {adminNavigation.filter((item) => access.capabilities.includes(item.capability)).map((item) => <article className="card admin-workspace__panel" key={item.key}>
        <h2><Link to={`/admin/${item.path}`}>{item.label}</Link></h2>
        {item.tasks ? <><strong>{tasks?.counts[item.key] === undefined ? 'Sarcini: indisponibile' : formatTaskCount(tasks.counts[item.key]!)}</strong><p>{item.tasks}</p></> : <p>Indicatori și ținte operaționale.</p>}
      </article>)}
    </div>
  </section>
}
