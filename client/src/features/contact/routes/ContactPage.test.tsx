import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ContactPage } from './ContactPage'
import { useCounties } from '../hooks/useCounties'
import { usePublicOrganizations } from '../hooks/usePublicOrganizations'
import type { JoinRequestForm } from '../components/JoinRequestForm'
import { buildCounties } from '@test/testUtils'

vi.mock('../hooks/useCounties', () => ({
  useCounties: vi.fn(),
}))

vi.mock('../hooks/usePublicOrganizations', () => ({
  usePublicOrganizations: vi.fn(),
}))

type JoinRequestFormProps = Parameters<typeof JoinRequestForm>[0]

vi.mock('../components/JoinRequestForm', () => ({
  JoinRequestForm: ({ countiesLoading, countiesError, counties }: JoinRequestFormProps) => (
    <div data-testid="join-request-form">
      <p>Counties Loading: {countiesLoading.toString()}</p>
      <p>Counties Error: {countiesError ?? 'none'}</p>
      <p>Counties Count: {counties.length}</p>
    </div>
  ),
}))

describe('ContactPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(usePublicOrganizations).mockReturnValue({
      organizations: [],
      loading: false,
      error: null,
    })
  })

  it('renders official contact details separately from membership', () => {
    vi.mocked(useCounties).mockReturnValue({
      loading: false,
      error: null,
      counties: [],
    })

    render(
      <MemoryRouter>
        <ContactPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Contact oficial PCS')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Suntem aici pentru dialog, nu doar pentru înscrieri.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Contactează sediul central' })).toBeInTheDocument()
    expect(screen.getByText('Șos. Bucium nr. 23, Iași, județul Iași')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Responsabili pe tipuri de solicitări' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Vrei să intri în echipă?' })).toBeInTheDocument()
  })

  it('renders validated territorial contacts and leaders from the public registry', () => {
    vi.mocked(useCounties).mockReturnValue({ loading: false, error: null, counties: [] })
    vi.mocked(usePublicOrganizations).mockReturnValue({
      loading: false,
      error: null,
      organizations: [{
        id: 'org-cluj',
        code: 'CJ-CLUJ',
        level: 'county',
        name: 'Filiala Județeană Cluj',
        county: 'Cluj',
        membersCount: 20,
        foundedAt: '2026-01-15',
        territories: ['Cluj'],
        officialEmail: 'cluj@example.test',
        phone: '0700 000 000',
        headquarters: 'Str. Exemplu nr. 1, Cluj-Napoca',
        leaders: [{ fullName: 'Maria Exemplu', positionTitle: 'Președinte filială' }],
      }],
    })

    render(
      <MemoryRouter>
        <ContactPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Filiala Județeană Cluj' })).toBeInTheDocument()
    expect(screen.getByText('Maria Exemplu')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'cluj@example.test' })).toHaveAttribute('href', 'mailto:cluj@example.test')
    expect(screen.getByRole('link', { name: '0700 000 000' })).toHaveAttribute('href', 'tel:0700000000')
  })

  it('displays join request form with loaded counties', () => {
    const counties = buildCounties()
    vi.mocked(useCounties).mockReturnValue({
      loading: false,
      error: null,
      counties,
    })

    render(
      <MemoryRouter>
        <ContactPage />
      </MemoryRouter>
    )

    expect(screen.getByTestId('join-request-form')).toBeInTheDocument()
    expect(screen.getByText('Counties Loading: false')).toBeInTheDocument()
    expect(screen.getByText('Counties Count: 3')).toBeInTheDocument()
  })

  it('displays loading state to form', () => {
    vi.mocked(useCounties).mockReturnValue({
      loading: true,
      error: null,
      counties: [],
    })

    render(
      <MemoryRouter>
        <ContactPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Counties Loading: true')).toBeInTheDocument()
  })

  it('displays error state to form', () => {
    const errorMessage = 'Failed to load counties'
    vi.mocked(useCounties).mockReturnValue({
      loading: false,
      error: errorMessage,
      counties: [],
    })

    render(
      <MemoryRouter>
        <ContactPage />
      </MemoryRouter>
    )

    expect(screen.getByText(`Counties Error: ${errorMessage}`)).toBeInTheDocument()
  })

  it('passes counties to form component', () => {
    const counties = buildCounties()
    vi.mocked(useCounties).mockReturnValue({
      loading: false,
      error: null,
      counties,
    })

    render(
      <MemoryRouter>
        <ContactPage />
      </MemoryRouter>
    )

    expect(screen.getByText(`Counties Count: ${counties.length}`)).toBeInTheDocument()
  })

  it('handles empty counties list', () => {
    vi.mocked(useCounties).mockReturnValue({
      loading: false,
      error: null,
      counties: [],
    })

    render(
      <MemoryRouter>
        <ContactPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Counties Count: 0')).toBeInTheDocument()
  })

  it('handles counties loading and error states together', () => {
    vi.mocked(useCounties).mockReturnValue({
      loading: true,
      error: 'Loading error',
      counties: [],
    })

    render(
      <MemoryRouter>
        <ContactPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Counties Loading: true')).toBeInTheDocument()
    expect(screen.getByText('Counties Error: Loading error')).toBeInTheDocument()
  })
})
