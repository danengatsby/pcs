import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCounties } from '@features/contact/hooks/useCounties'
import { useMobilizationActions } from '../hooks/useMobilizationActions'
import { useSubmitMobilizationResponse } from '../hooks/useSubmitMobilizationResponse'
import type { MobilizationAction, MobilizationActionType } from '../types'
import { MobilizationPage } from './MobilizationPage'
import { MobilizationActionFullError } from '../api/submitMobilizationResponse'

vi.mock('@features/contact/hooks/useCounties', () => ({ useCounties: vi.fn() }))
vi.mock('../hooks/useMobilizationActions', () => ({ useMobilizationActions: vi.fn() }))
vi.mock('../hooks/useSubmitMobilizationResponse', () => ({ useSubmitMobilizationResponse: vi.fn() }))

const submit = vi.fn()

function action(id: number, type: MobilizationActionType, title: string): MobilizationAction {
  return {
    id: String(id),
    slug: `actiune-${id}`,
    type,
    title,
    summary: `Rezumat pentru ${title}`,
    description: `Descriere pentru ${title}`,
    scope: type === 'event' ? 'online' : 'national',
    county: '',
    locality: '',
    startsAt: type === 'event' ? '2026-09-17T16:00:00.000Z' : null,
    endsAt: null,
    participationMode: 'Online',
    commitment: 'Primești detaliile următoare pe email.',
    capacity: type === 'event' ? 100 : null,
    availableSpots: type === 'event' ? 99 : null,
    responseCount: id,
  }
}

const actions = [
  action(1, 'event', 'Orientare voluntari'),
  action(2, 'campaign', 'Campanie locală'),
  action(3, 'volunteer_task', 'Sarcină de apeluri'),
  action(4, 'petition', 'Petiție pensii'),
  action(5, 'consultation', 'Consultare locală'),
]

describe('MobilizationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useMobilizationActions).mockReturnValue({ actions, loading: false, error: null })
    vi.mocked(useCounties).mockReturnValue({ counties: ['Cluj', 'Iași'], loading: false, error: null })
    vi.mocked(useSubmitMobilizationResponse).mockReturnValue({
      submit,
      submitting: false,
      reset: vi.fn(),
    })
    submit.mockResolvedValue({ accepted: true, id: '44', registrationStatus: 'confirmed' })
  })

  it('shows all mobilization instruments and separates participation from membership', () => {
    render(<MemoryRouter><MobilizationPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Nu doar urmărești. Alegi o acțiune și te implici.' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Evenimente 1/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Campanii 1/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sarcini pentru voluntari 1/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Petiții 1/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Consultări 1/ })).toBeInTheDocument()
    expect(screen.getByText('Aderarea și participarea punctuală sunt fluxuri separate.')).toBeInTheDocument()
  })

  it('filters the action catalog', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><MobilizationPage /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: /Petiții 1/ }))

    expect(screen.getByRole('heading', { name: 'Petiție pensii' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Orientare voluntari' })).not.toBeInTheDocument()
  })

  it('records an action response with county, interests and segmented communication consent', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><MobilizationPage /></MemoryRouter>)

    await user.click(screen.getByRole('button', { name: 'Confirmă prezența' }))
    await user.type(screen.getByLabelText('Nume complet'), 'Ana Popescu')
    await user.type(screen.getByLabelText('Email'), 'ana@example.test')
    await user.selectOptions(screen.getByLabelText(/Județ/), 'Cluj')
    await user.click(screen.getByRole('checkbox', { name: 'Pensii și venituri' }))
    await user.click(screen.getByRole('checkbox', { name: /Vreau actualizări/ }))
    await user.click(screen.getByRole('checkbox', { name: /Sunt de acord cu prelucrarea/ }))
    await user.click(screen.getByRole('button', { name: 'Confirmă prezența' }))

    await waitFor(() => expect(submit).toHaveBeenCalledWith({
      slug: 'actiune-1',
      payload: expect.objectContaining({
        fullName: 'Ana Popescu',
        email: 'ana@example.test',
        county: 'Cluj',
        interests: ['pensii'],
        updatesConsent: true,
        privacyConsent: true,
      }),
    }))
    expect(await screen.findByRole('heading', { name: 'Mulțumim pentru implicare.' })).toBeInTheDocument()
  })

  it('disables direct registration at capacity and offers an explicit waiting-list submission', async () => {
    const user = userEvent.setup()
    vi.mocked(useMobilizationActions).mockReturnValue({
      actions: [{ ...actions[0], availableSpots: 0, responseCount: null }], loading: false, error: null,
    })
    submit.mockResolvedValue({ accepted: true, id: '45', registrationStatus: 'waitlisted' })
    render(<MemoryRouter><MobilizationPage /></MemoryRouter>)
    expect(screen.getByText('0 locuri disponibile')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Locuri epuizate' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Lista de așteptare' }))
    await user.type(screen.getByLabelText('Nume complet'), 'Ana Popescu')
    await user.type(screen.getByLabelText('Email'), 'ana@example.test')
    await user.selectOptions(screen.getByLabelText(/Județ/), 'Cluj')
    await user.click(screen.getByRole('checkbox', { name: 'Pensii și venituri' }))
    await user.click(screen.getByRole('checkbox', { name: /Sunt de acord cu prelucrarea/ }))
    await user.click(screen.getByRole('button', { name: 'Înscrie-mă pe lista de așteptare' }))
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ joinWaitlist: true }) }))
    expect(await screen.findByText(/Ești pe lista de așteptare. Înscrierea nu confirmă un loc/)).toBeInTheDocument()
  })

  it('preserves entered data when the last seat is taken and requires another click to join the waitlist', async () => {
    const user = userEvent.setup()
    submit.mockRejectedValueOnce(new MobilizationActionFullError('Locuri epuizate.'))
    render(<MemoryRouter><MobilizationPage /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: 'Confirmă prezența' }))
    await user.type(screen.getByLabelText('Nume complet'), 'Ana Popescu')
    await user.type(screen.getByLabelText('Email'), 'ana@example.test')
    await user.selectOptions(screen.getByLabelText(/Județ/), 'Cluj')
    await user.click(screen.getByRole('checkbox', { name: 'Pensii și venituri' }))
    await user.click(screen.getByRole('checkbox', { name: /Sunt de acord cu prelucrarea/ }))
    await user.click(screen.getByRole('button', { name: 'Confirmă prezența' }))
    const waitlistButton = await screen.findByRole('button', { name: 'Înscrie-mă pe lista de așteptare' })
    expect(submit).toHaveBeenCalledTimes(1)
    expect(submit).toHaveBeenLastCalledWith(expect.objectContaining({ payload: expect.objectContaining({ joinWaitlist: false }) }))
    expect(screen.getByLabelText('Email')).toHaveValue('ana@example.test')
    submit.mockResolvedValueOnce({ accepted: true, id: '46', registrationStatus: 'waitlisted' })
    await user.click(waitlistButton)
    expect(submit).toHaveBeenLastCalledWith(expect.objectContaining({ payload: expect.objectContaining({ joinWaitlist: true }) }))
    expect(await screen.findByText(/Ești pe lista de așteptare/)).toBeInTheDocument()
  })

  it('uses refreshed availability for an already selected action', async () => {
    const user = userEvent.setup()
    const view = render(<MemoryRouter><MobilizationPage /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: 'Confirmă prezența' }))
    vi.mocked(useMobilizationActions).mockReturnValue({
      actions: [{ ...actions[0], availableSpots: 0 }], loading: false, error: null,
    })
    view.rerender(<MemoryRouter><MobilizationPage /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'Locuri epuizate' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Înscrie-mă pe lista de așteptare' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmă prezența' })).not.toBeInTheDocument()
  })
})
