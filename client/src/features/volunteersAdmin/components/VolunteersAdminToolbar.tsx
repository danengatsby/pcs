import { useEffect, useMemo, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react'
import { Button, Input } from '@components'
import { Select } from '@components'
import { useCounties } from '@features/contact/hooks/useCounties'
import type { ListAdminVolunteersQuery } from '../api/listVolunteers'
import { defaultVolunteersAdminQuery } from '../queryState'
import { volunteerWorkflowStatusValues } from '../types'

export const volunteerAdminTextFiltersDebounceMs = 350

type TextFilterField = 'search' | 'locality' | 'skills'

type TextFilterDraft = Record<TextFilterField, string>

type TextFilterDraftState = {
  queryTextFilters: TextFilterDraft
  draftValues: TextFilterDraft
}

function buildTextFilterDraft(query: ListAdminVolunteersQuery): TextFilterDraft {
  return {
    search: query.search ?? '',
    locality: query.locality ?? '',
    skills: query.skills ?? '',
  }
}

function areTextFilterDraftsEqual(
  current: TextFilterDraft,
  next: TextFilterDraft,
): boolean {
  return current.search === next.search
    && current.locality === next.locality
    && current.skills === next.skills
}

function resolveTextFilterDraftValues(
  state: TextFilterDraftState,
  queryTextFilters: TextFilterDraft,
): TextFilterDraft {
  return areTextFilterDraftsEqual(state.queryTextFilters, queryTextFilters)
    ? state.draftValues
    : queryTextFilters
}

type VolunteersAdminToolbarProps = {
  canManage?: boolean
  canPromote?: boolean
  canDelete?: boolean
  canExport?: boolean
  loading: boolean
  exporting: boolean
  bulkUpdating: boolean
  bulkDeleting: boolean
  visibleCount: number
  canLoadMore: boolean
  bulkSelectionCount: number
  bulkSelectionAllFiltered: boolean
  bulkStatus: string
  query: ListAdminVolunteersQuery
  setQuery: Dispatch<SetStateAction<ListAdminVolunteersQuery>>
  onBulkStatusChange: (value: string) => void
  onBulkApply: () => void
  onBulkDelete: () => void
  onClearSelection: () => void
  onRefresh: () => void
  onExport: () => void
}

export function VolunteersAdminToolbar({
  canManage = true,
  canPromote = true,
  canDelete = true,
  canExport = true,
  loading,
  exporting,
  bulkUpdating,
  bulkDeleting,
  visibleCount,
  canLoadMore,
  bulkSelectionCount,
  bulkSelectionAllFiltered,
  bulkStatus,
  query,
  setQuery,
  onBulkStatusChange,
  onBulkApply,
  onBulkDelete,
  onClearSelection,
  onRefresh,
  onExport,
}: VolunteersAdminToolbarProps) {
  const { loading: countiesLoading, error: countiesError, counties } = useCounties()
  const queryTextFilters = buildTextFilterDraft(query)
  const [textFilterState, setTextFilterState] = useState<TextFilterDraftState>(() => ({
    queryTextFilters,
    draftValues: queryTextFilters,
  }))
  const textFilters = resolveTextFilterDraftValues(textFilterState, queryTextFilters)
  const countyOptions = useMemo(
    () => counties.map((county) => ({ value: county, label: county })),
    [counties],
  )
  const statusOptions = useMemo(
    () => volunteerWorkflowStatusValues
      .filter((status) => canPromote || status !== 'activ')
      .map((status) => ({ value: status, label: status })),
    [canPromote],
  )
  const bulkBusy = bulkUpdating || bulkDeleting

  useEffect(() => {
    if (areTextFilterDraftsEqual(textFilters, queryTextFilters)) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setQuery((current) => ({
        ...current,
        search: textFilters.search,
        locality: textFilters.locality,
        skills: textFilters.skills,
        cursor: undefined,
      }))
    }, volunteerAdminTextFiltersDebounceMs)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [queryTextFilters, setQuery, textFilters])

  const updateSelectFilter = (field: 'county' | 'status') =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setQuery((current) => ({
        ...current,
        [field]: event.target.value,
        cursor: undefined,
      }))
    }

  const updateTextFilter = (field: TextFilterField) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value
      setTextFilterState((current) => {
        const currentValues = resolveTextFilterDraftValues(current, queryTextFilters)

        if (
          areTextFilterDraftsEqual(current.queryTextFilters, queryTextFilters)
          && currentValues[field] === nextValue
        ) {
          return current
        }

        return {
          queryTextFilters,
          draftValues: currentValues[field] === nextValue
            ? currentValues
            : {
                ...currentValues,
                [field]: nextValue,
              },
        }
      })
    }

  function handleResetFilters() {
    const nextTextFilters = buildTextFilterDraft(defaultVolunteersAdminQuery)
    setTextFilterState((current) => (
      areTextFilterDraftsEqual(resolveTextFilterDraftValues(current, queryTextFilters), nextTextFilters)
        && areTextFilterDraftsEqual(current.queryTextFilters, nextTextFilters)
        ? current
        : {
            queryTextFilters: nextTextFilters,
            draftValues: nextTextFilters,
          }
    ))
    setQuery(defaultVolunteersAdminQuery)
  }

  return (
    <header className="volunteer-admin__toolbar">
      <div className="volunteer-admin__heading">
        <h1 className="volunteer-admin__title">Voluntari (Admin)</h1>

        <div className="volunteer-admin__filters">
          <Input
            label="Caută"
            value={textFilters.search}
            onChange={updateTextFilter('search')}
            placeholder="Nume sau email"
          />
          <Select
            label="Județ"
            value={query.county ?? ''}
            onChange={updateSelectFilter('county')}
            placeholder={countiesLoading ? 'Se încarcă județele…' : 'Toate județele'}
            disabled={countiesLoading}
            options={countyOptions}
            hint={countiesError ?? undefined}
          />
          <Select
            label="Status"
            value={query.status ?? ''}
            onChange={updateSelectFilter('status')}
            placeholder="Toate statusurile"
            options={statusOptions}
          />
          <Input
            label="Localitate"
            value={textFilters.locality}
            onChange={updateTextFilter('locality')}
            placeholder="Ex: Iași"
          />
          <Input
            label="Skill-uri"
            value={textFilters.skills}
            onChange={updateTextFilter('skills')}
            placeholder="Ex: organizare"
          />
        </div>

        <p className="volunteer-admin__summary">
          Afișate: {visibleCount}{canLoadMore ? '+' : ''} {loading ? '· Se încarcă…' : ''}
        </p>
      </div>

      <div className="volunteer-admin__actions">
        {canManage && bulkSelectionCount > 0 ? (
          <div className="volunteer-admin__bulk-actions">
            <span className="muted">
              {bulkSelectionAllFiltered ? 'Selectate: toate rezultatele filtrate' : `Selectate: ${bulkSelectionCount}`}
            </span>
            <Select
              label="Status bulk"
              value={bulkStatus}
              onChange={(event) => onBulkStatusChange(event.target.value)}
              placeholder="Alege status"
              options={statusOptions}
              disabled={bulkBusy}
            />
            <Button
              variant="primary"
              loading={bulkUpdating}
              disabled={!bulkStatus || bulkDeleting}
              onClick={onBulkApply}
            >
              Aplică status
            </Button>
            {canDelete ? <Button
              className="volunteer-admin__bulk-delete"
              loading={bulkDeleting}
              disabled={bulkUpdating}
              onClick={onBulkDelete}
            >
              Șterge formularele
            </Button> : null}
            <Button disabled={bulkBusy} onClick={onClearSelection}>
              Anulează selecția
            </Button>
          </div>
        ) : null}
        {canExport ? <Button onClick={onExport} loading={exporting}>
          Export CSV
        </Button> : null}
        <Button onClick={handleResetFilters}>
          Resetează filtrele
        </Button>
        <Button onClick={onRefresh} loading={loading}>
          Refresh
        </Button>
      </div>
    </header>
  )
}
