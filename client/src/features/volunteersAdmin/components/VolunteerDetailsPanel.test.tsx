import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useCounties } from '@features/contact/hooks/useCounties'
import { useVolunteerOwners } from '../hooks/useVolunteerOwners'
import { VolunteerDetailsPanel } from './VolunteerDetailsPanel'
import { useAdminVolunteerAudit } from '../hooks/useAdminVolunteerAudit'
import { useUpdateVolunteerWorkflow } from '../hooks/useUpdateVolunteerWorkflow'
import type { VolunteerAdminAuditRow, VolunteerAdminRow } from '../types'

vi.mock('@features/contact/hooks/useCounties', () => ({
  useCounties: vi.fn(),
}))

vi.mock('../hooks/useVolunteerOwners', () => ({
  useVolunteerOwners: vi.fn(),
}))

vi.mock('../hooks/useUpdateVolunteerWorkflow', () => ({
  useUpdateVolunteerWorkflow: vi.fn(),
}))

vi.mock('../hooks/useAdminVolunteerAudit', () => ({
  useAdminVolunteerAudit: vi.fn(),
}))

describe('VolunteerDetailsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCounties).mockReturnValue({
      loading: false,
      error: null,
      counties: ['Cluj', 'Bihor', 'Timiș'],
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
    vi.mocked(useAdminVolunteerAudit).mockReturnValue({
      entries: [],
      loading: false,
      loadingMore: false,
      canLoadMore: false,
      loadMore: vi.fn(),
      error: null,
    })
  })

  it('renders an empty state when no volunteer is selected', () => {
    mockWorkflowHook()

    render(<VolunteerDetailsPanel volunteer={null} />)

    expect(screen.getByText('Selectează un voluntar.')).toBeInTheDocument()
  })

  it('renders a loading state while the selected volunteer details are being fetched', () => {
    mockWorkflowHook()

    render(<VolunteerDetailsPanel volunteer={null} loading />)

    expect(screen.getByText('Se încarcă voluntarul.')).toBeInTheDocument()
  })

  it('shows a read-only message for user-only records', () => {
    mockWorkflowHook()

    render(
      <VolunteerDetailsPanel
        volunteer={buildVolunteer({
          volunteerId: null,
          recordSource: 'user',
        })}
      />,
    )

    expect(screen.getByText(/Workflow-ul poate fi editat doar pentru înregistrări/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salvează' })).toBeNull()
  })

  it('submits workflow updates with reset before mutation', async () => {
    const user = userEvent.setup()
    const reset = vi.fn()
    const submit = vi.fn().mockResolvedValue(undefined)
    mockWorkflowHook({ submit, reset })

    render(<VolunteerDetailsPanel volunteer={buildVolunteer()} />)

    await user.selectOptions(screen.getByLabelText('Status'), 'activ')
    await user.clear(screen.getByLabelText('Note interne'))
    await user.type(screen.getByLabelText('Note interne'), 'Confirmat în comisie')
    await user.click(screen.getByRole('button', { name: 'Salvează' }))

    await waitFor(() => expect(reset).toHaveBeenCalledTimes(1))
    expect(submit).toHaveBeenCalledWith({
      volunteerId: 7,
      input: expect.objectContaining({
        status: 'activ',
        internalNotes: 'Confirmat în comisie',
      }),
    })
  })

  it('resets unsaved workflow edits explicitly', async () => {
    const user = userEvent.setup()
    mockWorkflowHook()

    render(<VolunteerDetailsPanel volunteer={buildVolunteer()} />)

    await user.selectOptions(screen.getByLabelText(/Județ/), 'Timiș')
    await user.clear(screen.getByLabelText('Note interne'))
    await user.type(screen.getByLabelText('Note interne'), 'Draft local')

    expect(screen.getByText('Ai modificări nesalvate.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Resetează' }))

    expect(screen.getByLabelText(/Județ/)).toHaveValue('Cluj')
    expect(screen.getByLabelText('Note interne')).toHaveValue('Necesită follow-up')
    expect(screen.queryByText('Ai modificări nesalvate.')).toBeNull()
  })

  it('shows the workflow error returned by the mutation hook', () => {
    mockWorkflowHook({ error: 'Actualizarea a eșuat.' })

    render(<VolunteerDetailsPanel volunteer={buildVolunteer()} />)

    expect(screen.getByText('Actualizarea a eșuat.')).toBeInTheDocument()
  })

  it('shows detail loading errors above the panel content', () => {
    mockWorkflowHook()

    render(<VolunteerDetailsPanel volunteer={buildVolunteer()} error="Voluntarul nu a putut fi încărcat." />)

    expect(screen.getByText('Voluntarul nu a putut fi încărcat.')).toBeInTheDocument()
  })

  it('renders workflow audit entries for the selected volunteer', () => {
    mockWorkflowHook()
    vi.mocked(useAdminVolunteerAudit).mockReturnValue({
      entries: [buildAuditEntry()],
      loading: false,
      loadingMore: false,
      canLoadMore: false,
      loadMore: vi.fn(),
      error: null,
    })

    render(<VolunteerDetailsPanel volunteer={buildVolunteer()} />)

    expect(screen.getByText('Istoric workflow')).toBeInTheDocument()
    expect(screen.getByText('Workflow actualizat')).toBeInTheDocument()
    expect(screen.getByText(/Status: nou -> activ/)).toBeInTheDocument()
    expect(screen.getByText(/Județ: Cluj -> Bihor/)).toBeInTheDocument()
    expect(screen.getByText(/Note interne: 18 -> 24 caractere/)).toBeInTheDocument()
    expect(screen.getAllByText(/admin@example\.test/).length).toBeGreaterThan(0)
  })

  it('renders the CRM workflow summary when available', () => {
    mockWorkflowHook()

    render(
      <VolunteerDetailsPanel
        volunteer={buildVolunteer({
          ownerUserId: '12',
          ownerName: 'Admin Test',
          ownerEmail: 'admin@example.test',
          ownerRole: 'PRESEDINTE',
          followUpAt: '2026-04-05T08:30:00.000Z',
          reminderAt: '2026-04-04T18:00:00.000Z',
          lastContactAt: '2026-04-03T07:15:00.000Z',
          contactChannel: 'telefon',
          priority: 'ridicata',
          tags: ['student', 'organizator'],
          skillTags: ['door-to-door', 'fundraising'],
          rejectionReason: 'Nu poate continua după primul apel.',
        })}
      />,
    )

    expect(screen.getByText(/Responsabil:/)).toBeInTheDocument()
    expect(screen.getAllByText(/Admin Test \(admin@example\.test\)/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Prioritate:/)).toBeInTheDocument()
    expect(screen.getByText(/ridicată/)).toBeInTheDocument()
    expect(screen.getByText(/telefon/)).toBeInTheDocument()
    expect(screen.getByText(/student, organizator/)).toBeInTheDocument()
    expect(screen.getByText(/door-to-door, fundraising/)).toBeInTheDocument()
    expect(screen.getAllByText('Motiv respingere').length).toBeGreaterThan(0)
  })

  it('loads more audit rows when another page is available', async () => {
    const user = userEvent.setup()
    const loadMore = vi.fn()
    mockWorkflowHook()
    vi.mocked(useAdminVolunteerAudit).mockReturnValue({
      entries: [buildAuditEntry()],
      loading: false,
      loadingMore: false,
      canLoadMore: true,
      loadMore,
      error: null,
    })

    render(<VolunteerDetailsPanel volunteer={buildVolunteer()} />)

    await user.click(screen.getByRole('button', { name: 'Încarcă mai mult' }))

    expect(loadMore).toHaveBeenCalledTimes(1)
  })

  it('renders workflow update metadata when available', () => {
    mockWorkflowHook()

    render(
      <VolunteerDetailsPanel
        volunteer={buildVolunteer({
          statusUpdatedAt: '2026-04-02T15:30:00.000Z',
          statusUpdatedByUserId: '99',
          statusUpdatedByName: 'Admin Test',
          statusUpdatedByEmail: 'admin@example.test',
        })}
      />,
    )

    expect(screen.getByText(/Ultima actualizare workflow:/)).toBeInTheDocument()
    expect(screen.getAllByText(/Admin Test \(admin@example\.test\)/).length).toBeGreaterThan(0)
  })

  it('resets the workflow form when the selected volunteer changes', async () => {
    const user = userEvent.setup()
    mockWorkflowHook()

    const { rerender } = render(<VolunteerDetailsPanel volunteer={buildVolunteer()} />)

    await user.selectOptions(screen.getByLabelText(/Județ/), 'Timiș')
    expect(screen.getByLabelText(/Județ/)).toHaveValue('Timiș')

    rerender(
      <VolunteerDetailsPanel
        volunteer={buildVolunteer({
          id: 2,
          volunteerId: 8,
          county: 'Bihor',
          locality: 'Oradea',
          skills: 'juridic',
          internalNotes: 'Mutat în alt flux',
        })}
      />,
    )

    expect(screen.getByLabelText(/Județ/)).toHaveValue('Bihor')
    expect(screen.getByLabelText('Localitate')).toHaveValue('Oradea')
    expect(screen.getByLabelText('Skill-uri')).toHaveValue('juridic')
    expect(screen.getByLabelText('Note interne')).toHaveValue('Mutat în alt flux')
  })
})

function mockWorkflowHook(
  overrides: Partial<ReturnType<typeof useUpdateVolunteerWorkflow>> = {},
) {
  vi.mocked(useUpdateVolunteerWorkflow).mockReturnValue({
    submit: vi.fn().mockResolvedValue(undefined),
    submitting: false,
    error: null,
    reset: vi.fn(),
    ...overrides,
  })
}

function buildVolunteer(overrides: Partial<VolunteerAdminRow> = {}): VolunteerAdminRow {
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

function buildAuditEntry(overrides: Partial<VolunteerAdminAuditRow> = {}): VolunteerAdminAuditRow {
  return {
    id: '1',
    actorUserId: '99',
    actorEmail: 'admin@example.test',
    actorRole: 'PRESEDINTE',
    action: 'volunteer.workflow_update',
    targetType: 'volunteer',
    targetId: '1',
    createdAt: '2026-04-02T12:00:00.000Z',
    details: {
      changedFields: {
        status: true,
        county: true,
        owner: true,
        reminderAt: true,
        skillTags: true,
      },
      previousStatus: 'nou',
      nextStatus: 'activ',
      previousCounty: 'Cluj',
      nextCounty: 'Bihor',
      previousOwnerLabel: 'Ana (ana@example.test)',
      nextOwnerLabel: 'Admin Test (admin@example.test)',
      previousReminderAt: '2026-04-03T09:00:00.000Z',
      nextReminderAt: '2026-04-04T09:00:00.000Z',
      previousSkillTags: ['telefonic'],
      nextSkillTags: ['telefonic', 'teren'],
      previousNotesLength: 18,
      nextNotesLength: 24,
    },
    ...overrides,
  }
}
