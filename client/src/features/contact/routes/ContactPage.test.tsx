import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ContactPage } from './ContactPage'
import { useCounties } from '../hooks/useCounties'
import type { JoinRequestForm } from '../components/JoinRequestForm'
import { buildCounties } from '@test/testUtils'

vi.mock('../hooks/useCounties', () => ({
  useCounties: vi.fn(),
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
  })

  it('renders contact page header', () => {
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

    expect(screen.getByText('Contact & înscrieri')).toBeInTheDocument()
    expect(screen.getByText('Contact')).toBeInTheDocument()
    expect(
      screen.getByText('Înscriere aderent și informații de contact pentru platforma PCS.')
    ).toBeInTheDocument()
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
