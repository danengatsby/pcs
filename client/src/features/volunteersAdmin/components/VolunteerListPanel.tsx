import { Button } from '@components'
import type { VolunteerAdminRow } from '../types'

function formatRoleLabel(role: VolunteerAdminRow['accountRole']): string {
  if (!role) return 'fără cont'
  if (role === 'SUSTINATOR') return 'Susținător'
  if (role === 'VICEPRESEDINTE') return 'Vicepreședinte'
  return role.charAt(0) + role.slice(1).toLowerCase()
}

function formatSourceLabel(source: VolunteerAdminRow['recordSource']): string {
  if (source === 'both') return 'cont + formular'
  if (source === 'user') return 'cont'
  return 'formular'
}

type VolunteerListPanelProps = {
  canSelect?: boolean
  rows: VolunteerAdminRow[]
  loading: boolean
  loadingMore: boolean
  canLoadMore: boolean
  selectedId: number | null
  selectedRecordIds: number[]
  bulkSelectionAllFiltered: boolean
  onSelect: (volunteerId: number) => void
  onToggleBulkSelection: (volunteerId: number) => void
  onSelectAllVisible: () => void
  onSelectAllFiltered: () => void
  onClearSelection: () => void
  onLoadMore: () => void
}

export function VolunteerListPanel({
  canSelect = true,
  rows,
  loading,
  loadingMore,
  canLoadMore,
  selectedId,
  selectedRecordIds,
  bulkSelectionAllFiltered,
  onSelect,
  onToggleBulkSelection,
  onSelectAllVisible,
  onSelectAllFiltered,
  onClearSelection,
  onLoadMore,
}: VolunteerListPanelProps) {
  const selectableRows = rows.filter((row) => row.volunteerId !== null)
  const allVisibleSelected = selectableRows.length > 0 && selectableRows.every((row) => selectedRecordIds.includes(row.id))

  return (
    <section className="panel volunteer-admin__panel">
      <div className="panel__header">
        <div className="panel__title">Înregistrări ({rows.length})</div>
        {canSelect ? <div className="volunteer-admin__list-actions">
          <Button disabled={selectableRows.length === 0 || bulkSelectionAllFiltered} onClick={onSelectAllFiltered}>
            Selectează tot filtrul
          </Button>
          <Button disabled={selectableRows.length === 0 || allVisibleSelected || bulkSelectionAllFiltered} onClick={onSelectAllVisible}>
            Selectează vizibile
          </Button>
          <Button disabled={selectedRecordIds.length === 0 && !bulkSelectionAllFiltered} onClick={onClearSelection}>
            Golește selecția
          </Button>
        </div> : null}
      </div>

      <div className="panel__scroll volunteer-admin__results">
        {rows.map((volunteer) => (
          <div
            key={volunteer.id}
            className={`volunteer-admin__result ${volunteer.id === selectedId ? 'is-active' : ''}`}
          >
            {canSelect ? <label className="volunteer-admin__result-check">
              <input
                type="checkbox"
                checked={selectedRecordIds.includes(volunteer.id)}
                disabled={volunteer.volunteerId === null}
                onChange={() => onToggleBulkSelection(volunteer.id)}
                aria-label={`Selectează ${volunteer.fullName}`}
              />
            </label> : null}
            <button
              type="button"
              onClick={() => onSelect(volunteer.id)}
              className="volunteer-admin__result-button"
            >
              <div className="volunteer-admin__result-name">{volunteer.fullName}</div>
              <div className="volunteer-admin__result-meta">{volunteer.email}</div>
              <div className="volunteer-admin__result-meta">
                {volunteer.county && volunteer.locality
                  ? `${volunteer.county} / ${volunteer.locality}`
                  : 'Fără date din formular'}
                {' · '}
                {formatRoleLabel(volunteer.accountRole)}
                {' · '}
                {volunteer.workflowStatus}
                {' · '}
                {formatSourceLabel(volunteer.recordSource)}
              </div>
            </button>
          </div>
        ))}

        {!loading && rows.length === 0 ? (
          <div className="volunteer-admin__empty">Nu există rezultate.</div>
        ) : null}
      </div>

      <div className="panel__footer volunteer-admin__pagination">
        <div className="volunteer-admin__pagination-meta">
          Afișate: {rows.length} · Selectate: {bulkSelectionAllFiltered ? 'tot filtrul curent' : selectedRecordIds.length}
          {loadingMore ? ' · Se încarcă încă o pagină…' : canLoadMore ? ' · Există mai multe rezultate.' : ' · Sfârșit listă.'}
        </div>

        <Button
          disabled={loading || loadingMore || !canLoadMore}
          loading={loadingMore}
          onClick={onLoadMore}
        >
          Mai multe
        </Button>
      </div>
    </section>
  )
}
