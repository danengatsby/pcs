import { useDeferredValue, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Input } from '@components'
import { useAdminMembersDashboard } from '../hooks/useAdminMembersDashboard'
import type { AdminDashboardGroup, AdminDashboardMemberRole } from '../types'

const summaryCards = [
  {
    key: 'aderenti',
    label: 'Aderenți',
    description: 'Conturi confirmate la nivel de aderent.',
  },
  {
    key: 'membri',
    label: 'Membri',
    description: 'Utilizatori promovați la statut de membru.',
  },
  {
    key: 'organizatori',
    label: 'Organizatori',
    description: 'Consilieri și roluri executive.',
  },
  {
    key: 'total',
    label: 'Total',
    description: 'Totalul utilizatorilor afișați în dashboard.',
  },
] as const

function formatRoleLabel(role: AdminDashboardMemberRole): string {
  if (role === 'VICEPRESEDINTE') {
    return 'Vicepreședinte'
  }

  return role.charAt(0) + role.slice(1).toLowerCase()
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('ro-RO', {
    dateStyle: 'medium',
  }).format(new Date(value))
}

function MembersGroupPanel({
  title,
  helper,
  group,
}: {
  title: string
  helper: string
  group: AdminDashboardGroup
}) {
  return (
    <section className="panel admin-members__panel">
      <header className="panel__header admin-members__panel-header">
        <div className="stack-8">
          <div className="panel__title">{title}</div>
          <p className="muted">{helper}</p>
        </div>
        <span className="admin-members__count">{group.count}</span>
      </header>

      <div className="panel__body admin-members__panel-body">
        {group.rows.length === 0 ? (
          <div className="admin-members__empty">Nu există rezultate în această categorie.</div>
        ) : (
          <div className="admin-members__list">
            {group.rows.map((member) => (
              <article key={member.id} className="admin-members__item">
                <div className="admin-members__item-header">
                  <div className="admin-members__identity">
                    <h2 className="admin-members__name">{member.fullName}</h2>
                    <a className="text-link" href={`mailto:${member.email}`}>
                      {member.email}
                    </a>
                  </div>

                  <span
                    className={[
                      'admin-members__role',
                      group.label === 'Organizatori' ? 'is-organizer' : '',
                      group.label === 'Membri' ? 'is-member' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {formatRoleLabel(member.role)}
                  </span>
                </div>

                <p className="admin-members__meta">Creat la {formatDate(member.createdAt)}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export function AdminMembersDashboardPage() {
  const [searchInput, setSearchInput] = useState('')
  const deferredSearch = useDeferredValue(searchInput)
  const { dashboard, loading, error, reload } = useAdminMembersDashboard({
    search: deferredSearch,
    limit: 10,
  })

  return (
    <div className="admin-members">
      <section className="hero admin-members__hero">
        <div className="hero-kicker">Zona administrativă</div>

        <div className="admin-members__hero-top">
          <div className="stack-12">
            <h1 className="admin-members__title">Dashboard membri</h1>
            <p className="lead">
              Vezi rapid aderentii, membrii și organizatorii înregistrați, cu acces direct către zona de voluntari.
            </p>
          </div>

          <div className="admin-members__actions">
            <Link className="btn" to="/admin/volunteers">
              Administrare voluntari
            </Link>
            <Button onClick={reload} loading={loading}>
              Reîncarcă
            </Button>
          </div>
        </div>

        <div className="admin-members__filters">
          <Input
            label="Caută după nume sau email"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Ex: pensio53@gmail.com"
          />
          <p className="admin-members__filter-note muted">
            {dashboard
              ? `Afișăm primele ${dashboard.filters.limit} rezultate pe categorie.`
              : 'Afișăm rezultatele pe categorii administrative.'}{' '}
            {deferredSearch ? `Filtru activ: “${deferredSearch}”.` : ''}
          </p>
        </div>
      </section>

      {error ? <div className="alert error">{error}</div> : null}

      <section className="admin-members__stats">
        {summaryCards.map((card) => (
          <article key={card.key} className="card admin-members__stat">
            <div className="hero-kicker admin-members__stat-kicker">{card.label}</div>
            <strong className="admin-members__stat-value">
              {dashboard ? dashboard.summary[card.key] : loading ? '…' : '0'}
            </strong>
            <p>{card.description}</p>
          </article>
        ))}
      </section>

      <section className="admin-members__groups">
        <MembersGroupPanel
          title="Aderenți"
          helper="Utilizatorii care au intrat în platformă cu rol de aderent."
          group={dashboard?.groups.aderenti ?? { label: 'Aderenți', count: 0, rows: [] }}
        />
        <MembersGroupPanel
          title="Membri"
          helper="Utilizatorii confirmați la nivel de membru."
          group={dashboard?.groups.membri ?? { label: 'Membri', count: 0, rows: [] }}
        />
        <MembersGroupPanel
          title="Organizatori"
          helper="Rolurile de coordonare și conducere."
          group={dashboard?.groups.organizatori ?? { label: 'Organizatori', count: 0, rows: [] }}
        />
      </section>
    </div>
  )
}
