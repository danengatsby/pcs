import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCounties } from '@features/contact/hooks/useCounties'
import { useVolunteerOwners } from '../hooks/useVolunteerOwners'
import { VolunteerWorkflowForm } from './VolunteerWorkflowForm'
import type { VolunteerAdminRow } from '../types'

vi.mock('@features/contact/hooks/useCounties', () => ({
  useCounties: vi.fn(),
}))

vi.mock('../hooks/useVolunteerOwners', () => ({
  useVolunteerOwners: vi.fn(),
}))

describe('VolunteerWorkflowForm', () => {
  beforeEach(() => {
    vi.mocked(useCounties).mockReturnValue({
      loading: false,
      error: null,
      counties: ['Cluj', 'Bihor', 'București'],
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
  })

  it('renders the current volunteer workflow values', () => {
    render(
      <VolunteerWorkflowForm
        volunteer={buildVolunteer()}
        submitting={false}
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Nume complet')).toHaveValue('Ana Pop')
    expect(screen.getByLabelText('Email')).toHaveValue('ana@example.test')
    expect(screen.getByLabelText('Telefon')).toHaveValue('0712345678')
    expect(screen.getByLabelText('Motivație')).toHaveValue('Vreau sa ajut.')
    expect(screen.getByLabelText('Status')).toHaveValue('nou')
    expect(screen.getByLabelText(/Județ/)).toHaveValue('Cluj')
    expect(screen.getByLabelText('Localitate')).toHaveValue('Cluj-Napoca')
    expect(screen.getByLabelText('Skill-uri')).toHaveValue('organizare')
    expect(screen.getByLabelText('Responsabil')).toHaveValue('')
    expect(screen.getByLabelText('Prioritate')).toHaveValue('medie')
    expect(screen.getByLabelText('Note interne')).toHaveValue('Necesită follow-up')
    expect(screen.getByLabelText('Tag-uri CRM')).toHaveValue('')
    expect(screen.getByLabelText('Tag-uri skill-uri')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Resetează' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Salvează' })).toBeDisabled()
  })

  it('submits the edited workflow values', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <VolunteerWorkflowForm
        volunteer={buildVolunteer()}
        submitting={false}
        onSubmit={onSubmit}
      />,
    )

    fireEvent.change(screen.getByLabelText('Nume complet'), { target: { value: '  Ana Maria Pop  ' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ANA.NOUA@example.test' } })
    fireEvent.change(screen.getByLabelText('Telefon'), { target: { value: ' 0722333444 ' } })
    fireEvent.change(screen.getByLabelText('Motivație'), { target: { value: '  Vreau să coordonez proiecte locale.  ' } })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'activ' } })
    fireEvent.change(screen.getByLabelText(/Județ/), { target: { value: 'Bihor' } })
    fireEvent.change(screen.getByLabelText('Localitate'), { target: { value: '  Oradea  ' } })
    fireEvent.change(screen.getByLabelText('Skill-uri'), { target: { value: ' juridic ' } })
    fireEvent.change(screen.getByLabelText('Responsabil'), { target: { value: '12' } })
    fireEvent.change(screen.getByLabelText('Prioritate'), { target: { value: 'ridicata' } })
    fireEvent.change(screen.getByLabelText('Follow-up la'), { target: { value: '2026-04-05T10:30' } })
    fireEvent.change(screen.getByLabelText('Reminder la'), { target: { value: '2026-04-04T18:00' } })
    fireEvent.change(screen.getByLabelText('Ultimul contact'), { target: { value: '2026-04-03T09:15' } })
    fireEvent.change(screen.getByLabelText('Canal contact'), { target: { value: 'telefon' } })
    fireEvent.change(screen.getByLabelText('Tag-uri CRM'), { target: { value: ' student, organizator ' } })
    fireEvent.change(screen.getByLabelText('Tag-uri skill-uri'), { target: { value: ' door-to-door, fundraising ' } })
    fireEvent.change(screen.getByLabelText('Note interne'), { target: { value: '  Confirmat telefonic  ' } })
    fireEvent.change(screen.getByLabelText('Motiv respingere'), { target: { value: '  ' } })

    expect(screen.getByText('Ai modificări nesalvate.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resetează' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Salvează' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Salvează' }))

    expect(onSubmit).toHaveBeenCalledWith({
      fullName: 'Ana Maria Pop',
      email: 'ana.noua@example.test',
      phone: '0722333444',
      motivation: 'Vreau să coordonez proiecte locale.',
      status: 'activ',
      internalNotes: 'Confirmat telefonic',
      county: 'Bihor',
      locality: 'Oradea',
      skills: 'juridic',
      ownerUserId: 12,
      followUpAt: new Date('2026-04-05T10:30').toISOString(),
      reminderAt: new Date('2026-04-04T18:00').toISOString(),
      lastContactAt: new Date('2026-04-03T09:15').toISOString(),
      contactChannel: 'telefon',
      priority: 'ridicata',
      rejectionReason: '',
      tags: ['student', 'organizator'],
      skillTags: ['door-to-door', 'fundraising'],
    })
  })

  it('disables submit while the form is saving', () => {
    render(
      <VolunteerWorkflowForm
        volunteer={buildVolunteer()}
        submitting
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Salvez...' })).toBeDisabled()
  })

  it('ignores form submit events while the mutation is pending', () => {
    const onSubmit = vi.fn()
    const { container } = render(
      <VolunteerWorkflowForm
        volunteer={buildVolunteer()}
        submitting
        onSubmit={onSubmit}
      />,
    )

    fireEvent.submit(container.querySelector('form')!)

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('normalizes blank optional values before submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <VolunteerWorkflowForm
        volunteer={buildVolunteer()}
        submitting={false}
        onSubmit={onSubmit}
      />,
    )

    fireEvent.change(screen.getByLabelText('Skill-uri'), { target: { value: '   ' } })
    fireEvent.change(screen.getByLabelText('Note interne'), { target: { value: '  Mutat în alt flux  ' } })

    await user.click(screen.getByRole('button', { name: 'Salvează' }))

    expect(onSubmit).toHaveBeenCalledWith({
      fullName: 'Ana Pop',
      email: 'ana@example.test',
      phone: '0712345678',
      motivation: 'Vreau sa ajut.',
      status: 'nou',
      internalNotes: 'Mutat în alt flux',
      county: 'Cluj',
      locality: 'Cluj-Napoca',
      skills: undefined,
      ownerUserId: null,
      followUpAt: null,
      reminderAt: null,
      lastContactAt: null,
      contactChannel: null,
      priority: 'medie',
      rejectionReason: '',
      tags: [],
      skillTags: [],
    })
  })

  it('resets unsaved changes explicitly without remounting the form', async () => {
    const user = userEvent.setup()

    render(
      <VolunteerWorkflowForm
        volunteer={buildVolunteer()}
        submitting={false}
        onSubmit={vi.fn()}
      />,
    )

    await user.selectOptions(screen.getByLabelText(/Județ/), 'Bihor')
    await user.clear(screen.getByLabelText('Localitate'))
    await user.type(screen.getByLabelText('Localitate'), 'Oradea')
    expect(screen.getByText('Ai modificări nesalvate.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Resetează' }))

    expect(screen.getByLabelText(/Județ/)).toHaveValue('Cluj')
    expect(screen.getByLabelText('Localitate')).toHaveValue('Cluj-Napoca')
    expect(screen.queryByText('Ai modificări nesalvate.')).toBeNull()
  })

  it('preserves local edits for the same volunteer while new data arrives and resets on demand', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <VolunteerWorkflowForm
        volunteer={buildVolunteer()}
        submitting={false}
        onSubmit={vi.fn()}
      />,
    )

    await user.selectOptions(screen.getByLabelText('Status'), 'activ')
    await user.clear(screen.getByLabelText('Note interne'))
    await user.type(screen.getByLabelText('Note interne'), 'În lucru local')

    rerender(
      <VolunteerWorkflowForm
        volunteer={buildVolunteer({
          workflowStatus: 'contactat',
          internalNotes: 'Date venite din refetch',
        })}
        submitting={false}
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Status')).toHaveValue('activ')
    expect(screen.getByLabelText('Note interne')).toHaveValue('În lucru local')

    await user.click(screen.getByRole('button', { name: 'Resetează' }))

    expect(screen.getByLabelText('Status')).toHaveValue('contactat')
    expect(screen.getByLabelText('Note interne')).toHaveValue('Date venite din refetch')
  })

  it('resets the draft immediately when a different volunteer is rendered without remounting', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <VolunteerWorkflowForm
        volunteer={buildVolunteer()}
        submitting={false}
        onSubmit={vi.fn()}
      />,
    )

    await user.selectOptions(screen.getByLabelText('Status'), 'activ')
    await user.clear(screen.getByLabelText('Note interne'))
    await user.type(screen.getByLabelText('Note interne'), 'În lucru local')

    rerender(
      <VolunteerWorkflowForm
        volunteer={buildVolunteer({
          id: 2,
          volunteerId: 8,
          fullName: 'Mihai Ionescu',
          county: 'Bihor',
          locality: 'Oradea',
          workflowStatus: 'contactat',
          internalNotes: 'Voluntar nou selectat',
        })}
        submitting={false}
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Status')).toHaveValue('contactat')
    expect(screen.getByLabelText(/Județ/)).toHaveValue('Bihor')
    expect(screen.getByLabelText('Localitate')).toHaveValue('Oradea')
    expect(screen.getByLabelText('Note interne')).toHaveValue('Voluntar nou selectat')
    expect(screen.queryByText('Ai modificări nesalvate.')).toBeNull()
  })

  it('blocks submit when required workflow fields are invalid', () => {
    const onSubmit = vi.fn()
    const { container } = render(
      <VolunteerWorkflowForm
        volunteer={buildVolunteer()}
        submitting={false}
        onSubmit={onSubmit}
      />,
    )

    fireEvent.change(screen.getByLabelText('Localitate'), { target: { value: '' } })
    fireEvent.submit(container.querySelector('form')!)

    expect(onSubmit).not.toHaveBeenCalled()
  })
})

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
