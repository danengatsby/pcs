import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCounties } from '@features/contact/hooks/useCounties'
import type { ListAdminVolunteersQuery } from '../api/listVolunteers'
import { VolunteersAdminToolbar, volunteerAdminTextFiltersDebounceMs } from './VolunteersAdminToolbar'

vi.mock('@features/contact/hooks/useCounties', () => ({
  useCounties: vi.fn(),
}))

describe('VolunteersAdminToolbar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(useCounties).mockReturnValue({
      loading: false,
      error: null,
      counties: ['Cluj', 'Iași', 'Bihor'],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps local text drafts during unrelated query updates and adopts external text changes', () => {
    const props = buildProps()
    const { rerender } = renderToolbar(props)

    fireEvent.change(screen.getByLabelText('Caută'), { target: { value: 'ana' } })
    expect(screen.getByLabelText('Caută')).toHaveValue('ana')

    rerenderToolbar(rerender, {
      ...props,
      query: {
        ...props.query,
        status: 'contactat',
      },
    })

    expect(screen.getByLabelText('Caută')).toHaveValue('ana')

    rerenderToolbar(rerender, {
      ...props,
      query: {
        ...props.query,
        search: 'mihai',
        status: 'contactat',
      },
    })

    expect(screen.getByLabelText('Caută')).toHaveValue('mihai')
  })

  it('debounces text filter changes before syncing them into the query state', () => {
    const setQuery = vi.fn()
    renderToolbar(buildProps({ setQuery }))

    fireEvent.change(screen.getByLabelText('Caută'), { target: { value: 'ana' } })

    expect(setQuery).not.toHaveBeenCalled()

    vi.advanceTimersByTime(volunteerAdminTextFiltersDebounceMs - 1)
    expect(setQuery).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(setQuery).toHaveBeenCalledTimes(1)
    expect(setQuery).toHaveBeenCalledWith(expect.any(Function))
  })
})

function renderToolbar(props: VolunteersAdminToolbarProps) {
  return render(
    <MemoryRouter>
      <VolunteersAdminToolbar {...props} />
    </MemoryRouter>,
  )
}

function rerenderToolbar(
  rerender: ReturnType<typeof render>['rerender'],
  props: VolunteersAdminToolbarProps,
) {
  rerender(
    <MemoryRouter>
      <VolunteersAdminToolbar {...props} />
    </MemoryRouter>,
  )
}

type VolunteersAdminToolbarProps = Parameters<typeof VolunteersAdminToolbar>[0]

function buildProps(
  overrides: Partial<VolunteersAdminToolbarProps> = {},
): VolunteersAdminToolbarProps {
  return {
    loading: false,
    exporting: false,
    bulkUpdating: false,
    bulkDeleting: false,
    visibleCount: 2,
    canLoadMore: false,
    bulkSelectionCount: 0,
    bulkSelectionAllFiltered: false,
    bulkStatus: '',
    query: buildQuery(),
    setQuery: vi.fn(),
    onBulkStatusChange: vi.fn(),
    onBulkApply: vi.fn(),
    onBulkDelete: vi.fn(),
    onClearSelection: vi.fn(),
    onRefresh: vi.fn(),
    onExport: vi.fn(),
    ...overrides,
  }
}

function buildQuery(overrides: Partial<ListAdminVolunteersQuery> = {}): ListAdminVolunteersQuery {
  return {
    limit: 50,
    ...overrides,
  }
}
