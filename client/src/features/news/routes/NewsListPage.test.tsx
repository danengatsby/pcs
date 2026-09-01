import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NewsListPage } from './NewsListPage'
import { useNews } from '../hooks/useNews'
import { buildNewsItems } from '@test/testUtils'

vi.mock('../hooks/useNews', () => ({
  useNews: vi.fn(),
}))

describe('NewsListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays news items', () => {
    const items = buildNewsItems(2)
    vi.mocked(useNews).mockReturnValue({
      items,
      loading: false,
      error: null,
    })

    render(
      <MemoryRouter>
        <NewsListPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Știri')).toBeInTheDocument()
    expect(screen.getByText('News Item 1')).toBeInTheDocument()
    expect(screen.getByText('News Item 2')).toBeInTheDocument()
  })

  it('displays loading message while fetching', () => {
    vi.mocked(useNews).mockReturnValue({
      items: [],
      loading: true,
      error: null,
    })

    render(
      <MemoryRouter>
        <NewsListPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Se încarcă…')).toBeInTheDocument()
  })

  it('displays error message when fetch fails', () => {
    const errorMessage = 'Failed to fetch news'
    vi.mocked(useNews).mockReturnValue({
      items: [],
      loading: false,
      error: errorMessage,
    })

    render(
      <MemoryRouter>
        <NewsListPage />
      </MemoryRouter>
    )

    expect(screen.getByText(`Eroare: ${errorMessage}`)).toBeInTheDocument()
  })

  it('displays empty state when no news items', () => {
    vi.mocked(useNews).mockReturnValue({
      items: [],
      loading: false,
      error: null,
    })

    render(
      <MemoryRouter>
        <NewsListPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Nu există știri.')).toBeInTheDocument()
  })

  it('links to news detail pages', () => {
    const items = buildNewsItems(1)
    vi.mocked(useNews).mockReturnValue({
      items,
      loading: false,
      error: null,
    })

    render(
      <MemoryRouter>
        <NewsListPage />
      </MemoryRouter>
    )

    const link = screen.getByRole('link', { name: 'News Item 1' })
    expect(link).toHaveAttribute('href', `/news/${encodeURIComponent(1)}`)
  })

  it('displays news summary when available', () => {
    const items = buildNewsItems(1)
    vi.mocked(useNews).mockReturnValue({
      items,
      loading: false,
      error: null,
    })

    render(
      <MemoryRouter>
        <NewsListPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Summary for news 1')).toBeInTheDocument()
  })

  it('renders page header correctly', () => {
    vi.mocked(useNews).mockReturnValue({
      items: [],
      loading: false,
      error: null,
    })

    render(
      <MemoryRouter>
        <NewsListPage />
      </MemoryRouter>
    )

    expect(screen.getByText('Știri și comunicate')).toBeInTheDocument()
    expect(screen.getByText('Actualizări, comunicate și materiale informative.')).toBeInTheDocument()
  })

  it('handles multiple news items', () => {
    const items = buildNewsItems(5)
    vi.mocked(useNews).mockReturnValue({
      items,
      loading: false,
      error: null,
    })

    render(
      <MemoryRouter>
        <NewsListPage />
      </MemoryRouter>
    )

    items.forEach((item) => {
      expect(screen.getByText(`News Item ${item.id}`)).toBeInTheDocument()
    })
  })
})
