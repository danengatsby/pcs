import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCounties } from '@features/contact/hooks/useCounties'
import { AuthContext, type AuthContextValue } from '@features/auth/context'
import type { Role } from '@features/auth/types'
import { exportAdminVolunteersCsv } from '../api/exportAdminVolunteersCsv'
import { useAdminVolunteerAudit } from '../hooks/useAdminVolunteerAudit'
import { useVolunteerOwners } from '../hooks/useVolunteerOwners'
import { useBulkDeleteVolunteer } from '../hooks/useBulkDeleteVolunteer'
import { useBulkUpdateVolunteerWorkflow } from '../hooks/useBulkUpdateVolunteerWorkflow'
import { useAdminVolunteerDetails } from '../hooks/useAdminVolunteerDetails'
import { useUpdateVolunteerWorkflow } from '../hooks/useUpdateVolunteerWorkflow'
import { useAdminVolunteers } from '../hooks/useAdminVolunteers'
import { VolunteersAdminPage } from './VolunteersAdminPage'
import type { VolunteerAdminRow } from '../types'

vi.mock('@features/contact/hooks/useCounties', () => ({
  useCounties: vi.fn(),
}))

vi.mock('../api/exportAdminVolunteersCsv', () => ({
  exportAdminVolunteersCsv: vi.fn(),
}))

vi.mock('../hooks/useAdminVolunteerDetails', () => ({
  useAdminVolunteerDetails: vi.fn(),
}))

vi.mock('../hooks/useAdminVolunteerAudit', () => ({
  useAdminVolunteerAudit: vi.fn(),
}))

vi.mock('../hooks/useVolunteerOwners', () => ({
  useVolunteerOwners: vi.fn(),
}))

vi.mock('../hooks/useBulkDeleteVolunteer', () => ({
  useBulkDeleteVolunteer: vi.fn(),
}))

vi.mock('../hooks/useBulkUpdateVolunteerWorkflow', () => ({
  useBulkUpdateVolunteerWorkflow: vi.fn(),
}))

vi.mock('../hooks/useAdminVolunteers', () => ({
  useAdminVolunteers: vi.fn(),
}))

vi.mock('../hooks/useUpdateVolunteerWorkflow', () => ({
  useUpdateVolunteerWorkflow: vi.fn(),
}))

describe('VolunteersAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    vi.mocked(useCounties).mockReturnValue({
      loading: false,
      error: null,
      counties: ['Cluj', 'Iași', 'Bihor', 'Timiș'],
    })
    vi.mocked(useAdminVolunteerDetails).mockImplementation((id, initialVolunteer = null) => ({
      volunteer: id === null ? null : buildVolunteerRows().find((row) => row.id === id) ?? initialVolunteer,
      loading: false,
      error: null,
    }))
    vi.mocked(useAdminVolunteerAudit).mockReturnValue({
      entries: [],
      loading: false,
      loadingMore: false,
      canLoadMore: false,
      loadMore: vi.fn(),
      error: null,
    })
    vi.mocked(useVolunteerOwners).mockReturnValue({
      owners: [
        {
          id: '12',
          fullName: 'Admin Test',
          email: 'admin@example.test',
          role: 'PRESEDINTE',
        },
      ],
      loading: false,
      error: null,
    })
    vi.mocked(useBulkDeleteVolunteer).mockReturnValue({
      submit: vi.fn().mockResolvedValue({
        message: 'Formularele de voluntar selectate au fost șterse.',
        deletedCount: 1,
        missingCount: 0,
        deletedVolunteerIds: [7],
        missingVolunteerIds: [],
      }),
      submitting: false,
      data: null,
      error: null,
      reset: vi.fn(),
    })
    vi.mocked(useBulkUpdateVolunteerWorkflow).mockReturnValue({
      submit: vi.fn().mockResolvedValue({
        message: 'Workflow-ul selectat a fost actualizat.',
        updatedCount: 1,
        skippedCount: 0,
        missingCount: 0,
        updatedVolunteerIds: [7],
        skippedVolunteerIds: [],
        missingVolunteerIds: [],
      }),
      submitting: false,
      data: null,
      error: null,
      reset: vi.fn(),
    })
    vi.mocked(useUpdateVolunteerWorkflow).mockReturnValue({
      submit: vi.fn().mockResolvedValue(undefined),
      submitting: false,
      error: null,
      reset: vi.fn(),
    })
  })

  it('selects a volunteer and shows the details panel', async () => {
    const user = userEvent.setup()
    mockAdminVolunteers()

    renderPage()

    expect(screen.getByText('Selectează un voluntar.')).toBeInTheDocument()
    expect(screen.getByText('Afișate: 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Ana Pop/i }))

    const details = screen.getByRole('heading', { name: 'Ana Pop' }).closest('section')
    expect(details).not.toBeNull()
    expect(within(details as HTMLElement).getByText(/ana@example\.test/)).toBeInTheDocument()
    expect(within(details as HTMLElement).getByDisplayValue('Necesită follow-up')).toBeInTheDocument()
    expect(screen.getByTestId('location-search')).toHaveTextContent('selected=1')
  })

  it('reads filters from the URL and keeps the URL updated when filters change', async () => {
    const user = userEvent.setup()
    mockAdminVolunteers()

    renderPage('/admin/volunteers?search=mihai&status=contactat')

    await waitFor(() => expect(screen.getByText('Afișate: 1')).toBeInTheDocument())
    expect(screen.getByLabelText('Caută')).toHaveValue('mihai')
    expect(screen.getByLabelText('Status')).toHaveValue('contactat')
    expect(screen.getByRole('button', { name: /Mihai Ionescu/i })).toBeInTheDocument()
    expect(screen.getByTestId('location-search')).toHaveTextContent('?search=mihai&status=contactat')

    await user.selectOptions(screen.getByLabelText('Județ'), 'Iași')

    await waitFor(() =>
      expect(screen.getByTestId('location-search')).toHaveTextContent('?search=mihai&status=contactat&county=Ia%C8%99i'))
  })

  it('resets filters back to the default query state', async () => {
    const user = userEvent.setup()
    mockAdminVolunteers()

    renderPage('/admin/volunteers?search=ana&county=Cluj')

    await user.click(screen.getByRole('button', { name: 'Resetează filtrele' }))

    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent(''))
    expect(screen.getByLabelText('Caută')).toHaveValue('')
    expect(screen.getByLabelText('Județ')).toHaveValue('')
  })

  it('keeps the selected volunteer details visible when filters exclude it from the list', async () => {
    const user = userEvent.setup()
    mockAdminVolunteers()

    renderPage()

    await user.click(screen.getByRole('button', { name: /Ana Pop/i }))
    expect(screen.getByRole('heading', { name: 'Ana Pop' })).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Caută'))
    await user.type(screen.getByLabelText('Caută'), 'mihai')

    expect(screen.getByTestId('location-search')).toHaveTextContent('selected=1')

    await waitFor(() => expect(screen.getByText('Afișate: 1')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /Ana Pop/i })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Ana Pop' })).toBeInTheDocument()
    expect(screen.getByTestId('location-search')).toHaveTextContent('selected=1')
  })

  it('loads more volunteers when another cursor page is available', async () => {
    const user = userEvent.setup()
    const { loadMore } = mockAdminVolunteers(buildVolunteerRows(), { canLoadMore: true })

    renderPage()

    await user.click(screen.getByRole('button', { name: 'Mai multe' }))

    expect(loadMore).toHaveBeenCalledTimes(1)
  })

  it('applies a bulk status update for selected volunteers', async () => {
    const user = userEvent.setup()
    const submit = vi.fn().mockResolvedValue({
      message: 'Workflow-ul selectat a fost actualizat.',
      updatedCount: 1,
      skippedCount: 0,
      missingCount: 0,
      updatedVolunteerIds: [7],
      skippedVolunteerIds: [],
      missingVolunteerIds: [],
    })
    vi.mocked(useBulkUpdateVolunteerWorkflow).mockReturnValue({
      submit,
      submitting: false,
      data: null,
      error: null,
      reset: vi.fn(),
    })
    mockAdminVolunteers()

    renderPage()

    await user.click(screen.getByLabelText('Selectează Ana Pop'))
    await user.selectOptions(screen.getByLabelText('Status bulk'), 'activ')
    await user.click(screen.getByRole('button', { name: 'Aplică status' }))

    await waitFor(() => expect(submit).toHaveBeenCalledWith({
      target: {
        type: 'ids',
        volunteerIds: [7],
      },
      status: 'activ',
    }))
    expect(screen.getByText('Actualizați: 1 · Săriți: 0 · Lipsă: 0')).toBeInTheDocument()
  })

  it('applies a bulk status update for all filtered volunteers', async () => {
    const user = userEvent.setup()
    const submit = vi.fn().mockResolvedValue({
      message: 'Workflow-ul selectat a fost actualizat.',
      updatedCount: 1,
      skippedCount: 0,
      missingCount: 0,
      updatedVolunteerIds: [8],
      skippedVolunteerIds: [],
      missingVolunteerIds: [],
    })
    vi.mocked(useBulkUpdateVolunteerWorkflow).mockReturnValue({
      submit,
      submitting: false,
      data: null,
      error: null,
      reset: vi.fn(),
    })
    mockAdminVolunteers()

    renderPage('/admin/volunteers?status=contactat&county=Iași')

    await user.click(screen.getByRole('button', { name: 'Selectează tot filtrul' }))
    expect(screen.getByText('Selectate: toate rezultatele filtrate')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Status bulk'), 'activ')
    await user.click(screen.getByRole('button', { name: 'Aplică status' }))

    await waitFor(() => expect(submit).toHaveBeenCalledWith({
      target: {
        type: 'filters',
        filters: {
          status: 'contactat',
          county: 'Iași',
          search: undefined,
          locality: undefined,
          skills: undefined,
        },
      },
      status: 'activ',
    }))
  })

  it('deletes selected volunteers in bulk and clears the selected volunteer from the URL', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.fn().mockReturnValue(true)
    vi.stubGlobal('confirm', confirmSpy)
    const submit = vi.fn().mockResolvedValue({
      message: 'Formularele de voluntar selectate au fost șterse.',
      deletedCount: 1,
      missingCount: 0,
      deletedVolunteerIds: [7],
      missingVolunteerIds: [],
    })
    vi.mocked(useBulkDeleteVolunteer).mockReturnValue({
      submit,
      submitting: false,
      data: null,
      error: null,
      reset: vi.fn(),
    })
    mockAdminVolunteers()

    renderPage('/admin/volunteers?selected=1')

    await user.click(screen.getByLabelText('Selectează Ana Pop'))
    await user.click(screen.getByRole('button', { name: 'Șterge formularele' }))

    expect(confirmSpy).toHaveBeenCalledWith('Ștergi formularul de voluntar selectat? Contul de utilizator rămâne activ.')
    await waitFor(() => expect(submit).toHaveBeenCalledWith({
      target: {
        type: 'ids',
        volunteerIds: [7],
      },
    }))
    expect(screen.getByText('Formulare șterse: 1 · Lipsă: 0')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent(''))
    expect(screen.getByText('Selectează un voluntar.')).toBeInTheDocument()
  })

  it('deletes all filtered volunteer forms and clears the selected volunteer when it matches the filter', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.fn().mockReturnValue(true)
    vi.stubGlobal('confirm', confirmSpy)
    const submit = vi.fn().mockResolvedValue({
      message: 'Formularele de voluntar selectate au fost șterse.',
      deletedCount: 1,
      missingCount: 0,
      deletedVolunteerIds: [8],
      missingVolunteerIds: [],
    })
    vi.mocked(useBulkDeleteVolunteer).mockReturnValue({
      submit,
      submitting: false,
      data: null,
      error: null,
      reset: vi.fn(),
    })
    mockAdminVolunteers()

    renderPage('/admin/volunteers?selected=2&status=contactat&county=Iași')

    await user.click(screen.getByRole('button', { name: 'Selectează tot filtrul' }))
    await user.click(screen.getByRole('button', { name: 'Șterge formularele' }))

    expect(confirmSpy).toHaveBeenCalledWith(
      'Ștergi toate formularele de voluntar care corespund filtrelor curente? Conturile de utilizator rămân active.',
    )
    await waitFor(() => expect(submit).toHaveBeenCalledWith({
      target: {
        type: 'filters',
        filters: {
          status: 'contactat',
          county: 'Iași',
          search: undefined,
          locality: undefined,
          skills: undefined,
        },
      },
    }))
    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent('?status=contactat&county=Ia%C8%99i'))
    expect(screen.getByText('Selectează un voluntar.')).toBeInTheDocument()
  })

  it('loads the selected volunteer from the URL on initial render', () => {
    mockAdminVolunteers()

    renderPage('/admin/volunteers?selected=2')

    expect(screen.getByRole('heading', { name: 'Mihai Ionescu' })).toBeInTheDocument()
  })

  it('calls reload when the refresh button is clicked', async () => {
    const user = userEvent.setup()
    const { reload } = mockAdminVolunteers()

    renderPage()

    await user.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('exports the currently filtered volunteer list as CSV', async () => {
    const user = userEvent.setup()
    mockAdminVolunteers()

    renderPage('/admin/volunteers?status=contactat&county=Iași')

    await user.click(screen.getByRole('button', { name: 'Export CSV' }))

    await waitFor(() =>
      expect(exportAdminVolunteersCsv).toHaveBeenCalledWith({
        limit: 50,
        status: 'contactat',
        county: 'Iași',
        search: undefined,
        locality: undefined,
        skills: undefined,
      }))
  })

  it('keeps the adviser interface read-only', async () => {
    const user = userEvent.setup()
    mockAdminVolunteers()

    renderPage('/admin/volunteers', 'CONSILIER')

    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Tablou de comandă' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Selectează Ana Pop')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Ana Pop/i }))
    expect(screen.getByText(/consultarea dosarului, nu modificarea workflow-ului/i)).toBeInTheDocument()
  })

  it('lets the secretary manage CRM without promotion or deletion controls', async () => {
    const user = userEvent.setup()
    mockAdminVolunteers()

    renderPage('/admin/volunteers', 'SECRETAR')

    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument()
    await user.click(screen.getByLabelText('Selectează Ana Pop'))
    expect(screen.queryByRole('option', { name: 'activ' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Șterge formularele' })).not.toBeInTheDocument()
  })
})

function renderPage(initialEntry = '/admin/volunteers', role: Role = 'PRESEDINTE') {
  const auth: AuthContextValue = {
    user: { id: '1', fullName: 'Admin Test', email: 'admin@example.test', role },
    loading: false,
    signin: vi.fn(),
    reload: vi.fn(),
    signout: vi.fn(),
  }
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[initialEntry]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <LocationSearch />
        <VolunteersAdminPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

function LocationSearch() {
  const location = useLocation()
  return <div data-testid="location-search">{location.search}</div>
}

function mockAdminVolunteers(
  rows: VolunteerAdminRow[] = buildVolunteerRows(),
  options: { canLoadMore?: boolean } = {},
) {
  const reload = vi.fn()
  const loadMore = vi.fn()
  const canLoadMore = options.canLoadMore ?? false

  vi.mocked(useAdminVolunteers).mockImplementation((query = {}) => {
    const search = (query.search ?? '').trim().toLowerCase()
    const county = (query.county ?? '').trim().toLowerCase()
    const locality = (query.locality ?? '').trim().toLowerCase()
    const skills = (query.skills ?? '').trim().toLowerCase()
    const status = (query.status ?? '').trim().toLowerCase()

    const filteredRows = rows.filter((volunteer) => {
      const matchesSearch = !search
        || volunteer.fullName.toLowerCase().includes(search)
        || volunteer.email.toLowerCase().includes(search)
      const matchesCounty = !county || volunteer.county.toLowerCase().includes(county)
      const matchesLocality = !locality || volunteer.locality.toLowerCase().includes(locality)
      const matchesSkills = !skills || volunteer.skills.toLowerCase().includes(skills)
      const matchesStatus = !status || volunteer.workflowStatus.toLowerCase().includes(status)

      return matchesSearch && matchesCounty && matchesLocality && matchesSkills && matchesStatus
    })

    return {
      loading: false,
      loadingMore: false,
      error: null,
      rows: filteredRows,
      canLoadMore,
      loadMore,
      reload,
    }
  })

  return { reload, loadMore }
}

function buildVolunteerRows(): VolunteerAdminRow[] {
  return [
    buildVolunteer({
      id: 1,
      volunteerId: 7,
      fullName: 'Ana Pop',
      email: 'ana@example.test',
      county: 'Cluj',
      locality: 'Cluj-Napoca',
      workflowStatus: 'nou',
      internalNotes: 'Necesită follow-up',
    }),
    buildVolunteer({
      id: 2,
      volunteerId: 8,
      fullName: 'Mihai Ionescu',
      email: 'mihai@example.test',
      county: 'Iași',
      locality: 'Iași',
      workflowStatus: 'contactat',
      internalNotes: 'A răspuns la email',
    }),
  ]
}

function buildVolunteer(overrides: Partial<VolunteerAdminRow>): VolunteerAdminRow {
  return {
    id: 1,
    volunteerId: 7,
    fullName: 'Ana Pop',
    email: 'ana@example.test',
    phone: '0712345678',
    county: 'Cluj',
    locality: 'Cluj-Napoca',
    skills: 'organizare',
    motivation: 'Vreau sa ajut.',
    workflowStatus: 'nou',
    internalNotes: 'Necesită follow-up',
    createdAt: '2026-04-02T10:00:00.000Z',
    statusUpdatedAt: null,
    statusUpdatedByUserId: null,
    statusUpdatedByName: null,
    statusUpdatedByEmail: null,
    ownerUserId: null,
    ownerName: null,
    ownerEmail: null,
    ownerRole: null,
    followUpAt: null,
    reminderAt: null,
    lastContactAt: null,
    contactChannel: null,
    priority: 'medie',
    rejectionReason: null,
    tags: [],
    skillTags: [],
    accountRole: null,
    recordSource: 'volunteer',
    ...overrides,
  }
}
