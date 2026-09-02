import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NewsListPage } from './NewsListPage'
import { useNews } from '../hooks/useNews'
import { buildNewsItem, buildNewsItems } from '@test/testUtils'

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

    expect(screen.getByRole('heading', { name: 'Vocea PCS, distinctă de informația din presă.' })).toBeInTheDocument()
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

    expect(screen.getByText('Se încarcă publicațiile…')).toBeInTheDocument()
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

    expect(screen.getByText(`Publicațiile nu au putut fi încărcate: ${errorMessage}`)).toBeInTheDocument()
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

    expect(screen.getByText('Nu există publicații disponibile momentan.')).toBeInTheDocument()
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

  it('links each panel to the cited article', () => {
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

    const sourceLink = screen.getByRole('link', { name: /Citește articolul citat/ })
    expect(sourceLink).toHaveAttribute('href', 'https://example.test/articol')
    expect(sourceLink).toHaveAttribute('target', '_blank')
    expect(sourceLink).toHaveAttribute('rel', 'noopener noreferrer')
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

    expect(screen.getByText('Centrul editorial PCS')).toBeInTheDocument()
    expect(screen.getByText(/Aici separăm conținutul asumat de partid/)).toBeInTheDocument()
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

  it('separates PCS positions, local activity, releases and external press', () => {
    const items = [
      buildNewsItem({ id: 1, title: 'Poziția partidului', category: 'Poziție PCS', sourceName: '', sourceUrl: '' }),
      buildNewsItem({ id: 2, title: 'Activitate în Cluj', category: 'Activitate locală', sourceName: '', sourceUrl: '' }),
      buildNewsItem({ id: 3, title: 'Anunț oficial', category: 'Comunicat', sourceName: '', sourceUrl: '' }),
      buildNewsItem({ id: 4, title: 'Articol extern', category: 'Pensii', sourceName: 'AGERPRES', sourceUrl: 'https://example.test/presa' }),
    ]
    vi.mocked(useNews).mockReturnValue({ items, loading: false, error: null })

    render(
      <MemoryRouter>
        <NewsListPage />
      </MemoryRouter>,
    )

    expect(within(screen.getByRole('region', { name: 'Poziții PCS' })).getByText('Poziția partidului')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Activitate locală' })).getByText('Activitate în Cluj')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Comunicate' })).getByText('Anunț oficial')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Informații din presă' })).getByText('Articol extern')).toBeInTheDocument()
  })
})
