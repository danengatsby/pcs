import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NewsDetailPage } from './NewsDetailPage'
import { useNewsById } from '../hooks/useNewsById'
import { buildNewsItem } from '@test/testUtils'

vi.mock('../hooks/useNewsById', () => ({
  useNewsById: vi.fn(),
}))

describe('NewsDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays a single news item', () => {
    const item = buildNewsItem({
      id: 1,
      title: 'Breaking News',
      summary: 'This is a breaking news item',
      content: 'Full content of the news',
      publishedAt: '2026-04-05T10:00:00.000Z',
    })

    vi.mocked(useNewsById).mockReturnValue({
      item,
      loading: false,
      error: null,
    })

    render(
      <MemoryRouter initialEntries={['/news/1']}>
        <Routes>
          <Route path="/news/:id" element={<NewsDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Breaking News')).toBeInTheDocument()
    expect(screen.getByText('This is a breaking news item')).toBeInTheDocument()
    expect(screen.getByText('Full content of the news')).toBeInTheDocument()
  })

  it('displays loading message while fetching', () => {
    vi.mocked(useNewsById).mockReturnValue({
      item: null,
      loading: true,
      error: null,
    })

    render(
      <MemoryRouter initialEntries={['/news/1']}>
        <Routes>
          <Route path="/news/:id" element={<NewsDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Se încarcă…')).toBeInTheDocument()
  })

  it('displays error message when fetch fails', () => {
    const errorMessage = 'Failed to fetch news'
    vi.mocked(useNewsById).mockReturnValue({
      item: null,
      loading: false,
      error: errorMessage,
    })

    render(
      <MemoryRouter initialEntries={['/news/1']}>
        <Routes>
          <Route path="/news/:id" element={<NewsDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText(`Eroare: ${errorMessage}`)).toBeInTheDocument()
  })

  it('displays unavailable content message when no content', () => {
    const item = buildNewsItem({
      id: 1,
      title: 'News Without Content',
      summary: 'Summary available',
      content: '',
    })

    vi.mocked(useNewsById).mockReturnValue({
      item,
      loading: false,
      error: null,
    })

    render(
      <MemoryRouter initialEntries={['/news/1']}>
        <Routes>
          <Route path="/news/:id" element={<NewsDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Conținut indisponibil.')).toBeInTheDocument()
  })

  it('displays published date', () => {
    const publishedAt = '2026-04-05T10:00:00.000Z'
    const item = buildNewsItem({
      id: 1,
      title: 'News',
      publishedAt,
    })

    vi.mocked(useNewsById).mockReturnValue({
      item,
      loading: false,
      error: null,
    })

    render(
      <MemoryRouter initialEntries={['/news/1']}>
        <Routes>
          <Route path="/news/:id" element={<NewsDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText(`Publicat: ${publishedAt}`)).toBeInTheDocument()
  })

  it('displays back to list link', () => {
    const item = buildNewsItem({ id: 1, title: 'News' })

    vi.mocked(useNewsById).mockReturnValue({
      item,
      loading: false,
      error: null,
    })

    render(
      <MemoryRouter initialEntries={['/news/1']}>
        <Routes>
          <Route path="/news/:id" element={<NewsDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    const backLink = screen.getByRole('link', { name: /Înapoi la listă/ })
    expect(backLink).toHaveAttribute('href', '/news')
  })

  it('uses default title when item not loaded', () => {
    vi.mocked(useNewsById).mockReturnValue({
      item: null,
      loading: true,
      error: null,
    })

    render(
      <MemoryRouter initialEntries={['/news/1']}>
        <Routes>
          <Route path="/news/:id" element={<NewsDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Știre')).toBeInTheDocument()
  })

  it('passes correct id from URL to hook', () => {
    const item = buildNewsItem({ id: 123, title: 'Test News' })
    vi.mocked(useNewsById).mockReturnValue({
      item,
      loading: false,
      error: null,
    })

    render(
      <MemoryRouter initialEntries={['/news/123']}>
        <Routes>
          <Route path="/news/:id" element={<NewsDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(useNewsById).toHaveBeenCalledWith('123')
  })

  it('handles encoded URL parameters', () => {
    const item = buildNewsItem({ id: 1, title: 'Test with & Symbol' })
    vi.mocked(useNewsById).mockReturnValue({
      item,
      loading: false,
      error: null,
    })

    const encodedId = encodeURIComponent('1')
    render(
      <MemoryRouter initialEntries={[`/news/${encodedId}`]}>
        <Routes>
          <Route path="/news/:id" element={<NewsDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(useNewsById).toHaveBeenCalled()
  })

  it('displays summary when available', () => {
    const summary = 'This is a detailed summary'
    const item = buildNewsItem({
      id: 1,
      title: 'News',
      summary,
      content: 'Content',
    })

    vi.mocked(useNewsById).mockReturnValue({
      item,
      loading: false,
      error: null,
    })

    render(
      <MemoryRouter initialEntries={['/news/1']}>
        <Routes>
          <Route path="/news/:id" element={<NewsDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText(summary)).toBeInTheDocument()
  })

  it('renders page header correctly', () => {
    const item = buildNewsItem({ id: 1, title: 'News' })

    vi.mocked(useNewsById).mockReturnValue({
      item,
      loading: false,
      error: null,
    })

    render(
      <MemoryRouter initialEntries={['/news/1']}>
        <Routes>
          <Route path="/news/:id" element={<NewsDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Știri și comunicate')).toBeInTheDocument()
  })
})
