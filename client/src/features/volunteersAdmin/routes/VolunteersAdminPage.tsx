import { startTransition, useCallback, useMemo, useState, type SetStateAction } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { VolunteerAdminFilters, VolunteerWorkflowStatus } from '../types'
import { volunteerWorkflowStatusValues } from '../types'
import { useBulkDeleteVolunteer } from '../hooks/useBulkDeleteVolunteer'
import { useBulkUpdateVolunteerWorkflow } from '../hooks/useBulkUpdateVolunteerWorkflow'
import { exportAdminVolunteersCsv } from '../api/exportAdminVolunteersCsv'
import type { ListAdminVolunteersQuery } from '../api/listVolunteers'
import { useAdminVolunteerDetails } from '../hooks/useAdminVolunteerDetails'
import { useAdminVolunteers } from '../hooks/useAdminVolunteers'
import {
  buildVolunteersAdminSearchParams,
  normalizeVolunteersAdminQuery,
  parseSelectedVolunteerId,
  readVolunteersAdminQuery,
} from '../queryState'
import { VolunteerDetailsPanel } from '../components/VolunteerDetailsPanel'
import { VolunteerListPanel } from '../components/VolunteerListPanel'
import { VolunteersAdminToolbar } from '../components/VolunteersAdminToolbar'

function buildBulkFilters(query: ListAdminVolunteersQuery): VolunteerAdminFilters {
  return {
    search: query.search,
    status: query.status,
    county: query.county,
    locality: query.locality,
    skills: query.skills,
  }
}

function hasActiveFilters(query: ListAdminVolunteersQuery): boolean {
  return Boolean(query.search || query.status || query.county || query.locality || query.skills)
}

export function VolunteersAdminPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [exportError, setExportError] = useState<string | null>(null)
  const [bulkMessage, setBulkMessage] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [selectedRecordIds, setSelectedRecordIds] = useState<number[]>([])
  const [bulkSelectionAllFiltered, setBulkSelectionAllFiltered] = useState(false)
  const [bulkStatus, setBulkStatus] = useState('')
  const query = useMemo(() => readVolunteersAdminQuery(searchParams), [searchParams])
  const selectedId = useMemo(() => parseSelectedVolunteerId(searchParams.get('selected')), [searchParams])
  const { loading, loadingMore, error, rows, canLoadMore, loadMore, reload } = useAdminVolunteers(query)
  const {
    submit: submitBulkUpdate,
    submitting: bulkUpdating,
    error: bulkError,
    reset: resetBulkUpdate,
  } = useBulkUpdateVolunteerWorkflow()
  const {
    submit: submitBulkDelete,
    submitting: bulkDeleting,
    error: bulkDeleteError,
    reset: resetBulkDelete,
  } = useBulkDeleteVolunteer()
  const selectedPreview = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId])
  const {
    volunteer: selectedVolunteer,
    loading: selectedLoading,
    error: selectedError,
  } = useAdminVolunteerDetails(selectedId, selectedPreview)
  const selectableVisibleRecordIds = useMemo(
    () => rows.filter((row) => row.volunteerId !== null).map((row) => row.id),
    [rows],
  )
  const visibleRecordIds = useMemo(() => new Set(rows.map((row) => row.id)), [rows])
  const effectiveSelectedRecordIds = useMemo(
    () => (
      bulkSelectionAllFiltered
        ? selectableVisibleRecordIds
        : selectedRecordIds.filter((id) => visibleRecordIds.has(id))
    ),
    [bulkSelectionAllFiltered, selectableVisibleRecordIds, selectedRecordIds, visibleRecordIds],
  )

  const setQuery = useCallback((nextValue: SetStateAction<ListAdminVolunteersQuery>) => {
    const nextQuery = normalizeVolunteersAdminQuery(
      typeof nextValue === 'function' ? nextValue(query) : nextValue,
    )
    const nextParams = buildVolunteersAdminSearchParams(nextQuery, { includePagination: false, selectedId })
    const currentParams = buildVolunteersAdminSearchParams(query, { includePagination: false, selectedId })

    if (currentParams.toString() === nextParams.toString()) {
      return
    }

    setBulkSelectionAllFiltered(false)
    setSelectedRecordIds([])
    setBulkStatus('')
    setBulkMessage(null)
    resetBulkUpdate()
    resetBulkDelete()
    startTransition(() => {
      setSearchParams(nextParams, { replace: true })
    })
  }, [query, resetBulkDelete, resetBulkUpdate, selectedId, setSearchParams])

  const handleSelect = useCallback((nextSelectedId: number | null) => {
    const nextParams = buildVolunteersAdminSearchParams(query, { includePagination: false, selectedId: nextSelectedId })
    const currentParams = buildVolunteersAdminSearchParams(query, { includePagination: false, selectedId })

    if (currentParams.toString() === nextParams.toString()) {
      return
    }

    startTransition(() => {
      setSearchParams(nextParams, { replace: true })
    })
  }, [query, selectedId, setSearchParams])

  const handleExport = useCallback(async () => {
    setExportError(null)
    setExporting(true)

    try {
      await exportAdminVolunteersCsv(query)
    } catch (exportCsvError) {
      setExportError(exportCsvError instanceof Error ? exportCsvError.message : 'Exportul CSV a eșuat.')
    } finally {
      setExporting(false)
    }
  }, [query])

  const handleToggleBulkSelection = useCallback((recordId: number) => {
    if (bulkSelectionAllFiltered) {
      setBulkSelectionAllFiltered(false)
      setSelectedRecordIds(selectableVisibleRecordIds.filter((value) => value !== recordId))
      return
    }

    setSelectedRecordIds((current) => (
      current.includes(recordId)
        ? current.filter((value) => value !== recordId)
        : [...current, recordId]
    ))
  }, [bulkSelectionAllFiltered, selectableVisibleRecordIds])

  const handleSelectAllVisible = useCallback(() => {
    setBulkSelectionAllFiltered(false)
    setSelectedRecordIds(selectableVisibleRecordIds)
  }, [selectableVisibleRecordIds])

  const handleSelectAllFiltered = useCallback(() => {
    if (selectableVisibleRecordIds.length === 0) {
      return
    }

    setBulkSelectionAllFiltered(true)
    setSelectedRecordIds([])
  }, [selectableVisibleRecordIds.length])

  const handleClearSelection = useCallback(() => {
    setBulkSelectionAllFiltered(false)
    setSelectedRecordIds([])
    setBulkStatus('')
    setBulkMessage(null)
    resetBulkUpdate()
    resetBulkDelete()
  }, [resetBulkDelete, resetBulkUpdate])

  const handleApplyBulkStatus = useCallback(async () => {
    if (!volunteerWorkflowStatusValues.includes(bulkStatus as VolunteerWorkflowStatus)) {
      return
    }

    const bulkTarget = bulkSelectionAllFiltered
      ? {
          type: 'filters' as const,
          filters: buildBulkFilters(query),
        }
      : {
          type: 'ids' as const,
          volunteerIds: rows
            .filter((row) => effectiveSelectedRecordIds.includes(row.id) && row.volunteerId !== null)
            .map((row) => row.volunteerId as number),
        }

    if (bulkTarget.type === 'ids' && bulkTarget.volunteerIds.length === 0) {
      return
    }

    setBulkMessage(null)
    resetBulkUpdate()
    resetBulkDelete()
    try {
      const response = await submitBulkUpdate({
        target: bulkTarget,
        status: bulkStatus as VolunteerWorkflowStatus,
      })

      setBulkMessage(`Actualizați: ${response.updatedCount} · Săriți: ${response.skippedCount} · Lipsă: ${response.missingCount}`)
      setBulkSelectionAllFiltered(false)
      setSelectedRecordIds([])
      setBulkStatus('')
    } catch {
      // Error state is already exposed by the mutation hook.
    }
  }, [bulkSelectionAllFiltered, bulkStatus, effectiveSelectedRecordIds, query, resetBulkDelete, resetBulkUpdate, rows, submitBulkUpdate])

  const handleApplyBulkDelete = useCallback(async () => {
    const selectedRows = rows.filter((row) => effectiveSelectedRecordIds.includes(row.id) && row.volunteerId !== null)
    const volunteerIds = selectedRows
      .map((row) => row.volunteerId)
      .filter((value): value is number => typeof value === 'number')
    const bulkTarget = bulkSelectionAllFiltered
      ? {
          type: 'filters' as const,
          filters: buildBulkFilters(query),
        }
      : {
          type: 'ids' as const,
          volunteerIds,
        }

    if (bulkTarget.type === 'ids' && bulkTarget.volunteerIds.length === 0) {
      return
    }

    const confirmationMessage = bulkSelectionAllFiltered
      ? hasActiveFilters(query)
        ? 'Ștergi toate formularele de voluntar care corespund filtrelor curente? Conturile de utilizator rămân active.'
        : 'Ștergi toate formularele de voluntar? Conturile de utilizator rămân active.'
      : volunteerIds.length === 1
        ? 'Ștergi formularul de voluntar selectat? Contul de utilizator rămâne activ.'
        : `Ștergi ${volunteerIds.length} formulare de voluntar selectate? Conturile de utilizator rămân active.`

    if (!window.confirm(confirmationMessage)) {
      return
    }

    setBulkMessage(null)
    resetBulkUpdate()
    resetBulkDelete()

    try {
      const response = await submitBulkDelete({
        target: bulkTarget,
      })

      const selectedVolunteerId = selectedVolunteer?.volunteerId
      const shouldClearSelectedVolunteer = typeof selectedVolunteerId === 'number'
        && response.deletedVolunteerIds.includes(selectedVolunteerId)

      if (selectedId !== null && shouldClearSelectedVolunteer) {
        const nextParams = buildVolunteersAdminSearchParams(query, { includePagination: false, selectedId: null })
        startTransition(() => {
          setSearchParams(nextParams, { replace: true })
        })
      }

      setBulkMessage(`Formulare șterse: ${response.deletedCount} · Lipsă: ${response.missingCount}`)
      setBulkSelectionAllFiltered(false)
      setSelectedRecordIds([])
      setBulkStatus('')
    } catch {
      // Error state is already exposed by the mutation hook.
    }
  }, [bulkSelectionAllFiltered, effectiveSelectedRecordIds, query, resetBulkDelete, resetBulkUpdate, rows, selectedId, selectedVolunteer, setSearchParams, submitBulkDelete])

  return (
    <div className="volunteer-admin">
      <VolunteersAdminToolbar
        loading={loading}
        exporting={exporting}
        bulkUpdating={bulkUpdating}
        bulkDeleting={bulkDeleting}
        visibleCount={rows.length}
        canLoadMore={canLoadMore}
        bulkSelectionCount={effectiveSelectedRecordIds.length}
        bulkSelectionAllFiltered={bulkSelectionAllFiltered}
        bulkStatus={bulkStatus}
        query={query}
        setQuery={setQuery}
        onBulkStatusChange={setBulkStatus}
        onBulkApply={() => {
          void handleApplyBulkStatus()
        }}
        onBulkDelete={() => {
          void handleApplyBulkDelete()
        }}
        onClearSelection={handleClearSelection}
        onRefresh={reload}
        onExport={handleExport}
      />

      {error ? <div className="alert error">{error}</div> : null}
      {exportError ? <div className="alert error">{exportError}</div> : null}
      {bulkError ? <div className="alert error">{bulkError}</div> : null}
      {bulkDeleteError ? <div className="alert error">{bulkDeleteError}</div> : null}
      {bulkMessage ? <div className="alert success">{bulkMessage}</div> : null}

      <div className="volunteer-admin__content">
        <VolunteerListPanel
          rows={rows}
          loading={loading}
          loadingMore={loadingMore}
          canLoadMore={canLoadMore}
          selectedId={selectedId}
          selectedRecordIds={effectiveSelectedRecordIds}
          bulkSelectionAllFiltered={bulkSelectionAllFiltered}
          onSelect={handleSelect}
          onToggleBulkSelection={handleToggleBulkSelection}
          onSelectAllVisible={handleSelectAllVisible}
          onSelectAllFiltered={handleSelectAllFiltered}
          onClearSelection={handleClearSelection}
          onLoadMore={loadMore}
        />
        <VolunteerDetailsPanel
          volunteer={selectedVolunteer}
          loading={selectedId !== null && selectedVolunteer === null && selectedLoading}
          error={selectedError}
        />
      </div>
    </div>
  )
}

export default VolunteersAdminPage
