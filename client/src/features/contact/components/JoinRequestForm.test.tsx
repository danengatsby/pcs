import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSubmitJoin } from '../hooks/useSubmitJoin'
import { JoinRequestForm } from './JoinRequestForm'

vi.mock('../captchaConfig', () => ({
  isCaptchaEnabled: false,
}))

vi.mock('../hooks/useSubmitJoin', () => ({
  useSubmitJoin: vi.fn(),
}))

vi.mock('./TurnstileField', () => ({
  TurnstileField: () => <div data-testid="turnstile-field" />,
}))

const submit = vi.fn()
const reset = vi.fn()

function renderForm() {
  return render(
    <JoinRequestForm
      counties={['Cluj', 'Iași']}
      countiesLoading={false}
      countiesError={null}
    />,
  )
}

async function completeFirstStep(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Nume complet'), 'Maria Popescu')
  await user.type(screen.getByLabelText('Email'), 'maria@example.test')
  await user.type(screen.getByLabelText('Telefon (opțional)'), '0712 345 678')
  await user.selectOptions(screen.getByLabelText('Județ'), 'Cluj')
  await user.type(screen.getByLabelText('Localitate'), 'Cluj-Napoca')
  await user.click(screen.getByRole('button', { name: 'Continuă' }))
}

describe('JoinRequestForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    submit.mockResolvedValue({ id: 42 })
    vi.mocked(useSubmitJoin).mockReturnValue({
      submit,
      submitting: false,
      error: null,
      reset,
    })
  })

  it('splits the request into two short steps and preserves contact data', async () => {
    const user = userEvent.setup()
    renderForm()

    expect(screen.getByText('Pasul 1 din 2')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cum te putem contacta?' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/Parolă pentru cont/)).not.toBeInTheDocument()

    await completeFirstStep(user)

    expect(screen.getByText('Pasul 2 din 2')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cum vrei să te implici?' })).toBeInTheDocument()
    expect(screen.getByText('Maria Popescu')).toBeInTheDocument()
    expect(screen.getByText('maria@example.test · Cluj-Napoca, Cluj')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Editează datele' }))

    expect(screen.getByText('Pasul 1 din 2')).toBeInTheDocument()
    expect(screen.getByLabelText('Nume complet')).toHaveValue('Maria Popescu')
    expect(screen.getByLabelText('Email')).toHaveValue('maria@example.test')
    expect(screen.getByLabelText('Județ')).toHaveValue('Cluj')
    expect(screen.getByLabelText('Localitate')).toHaveValue('Cluj-Napoca')
  })

  it('submits the same complete membership payload from the second step', async () => {
    const user = userEvent.setup()
    renderForm()

    await completeFirstStep(user)
    await user.type(screen.getByLabelText(/Parolă pentru cont/), 'Parola!2026')
    await user.type(screen.getByLabelText('Competențe (opțional)'), 'organizare')
    await user.type(screen.getByLabelText('De ce vrei să te implici?'), 'Vreau să ajut comunitatea locală.')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Trimite cererea' }))

    await waitFor(() => {
      expect(submit).toHaveBeenCalledWith({
        fullName: 'Maria Popescu',
        email: 'maria@example.test',
        password: 'Parola!2026',
        phone: '0712 345 678',
        county: 'Cluj',
        locality: 'Cluj-Napoca',
        motivation: 'Vreau să ajut comunitatea locală.',
        skills: 'organizare',
        captchaToken: '',
        website: '',
      })
    })
    expect(reset).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('heading', { name: 'Mulțumim pentru înscriere.' })).toBeInTheDocument()
  })
})
