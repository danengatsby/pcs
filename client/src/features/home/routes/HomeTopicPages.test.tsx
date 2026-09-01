import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNews } from '@features/news/hooks/useNews'
import { buildNewsItems } from '@test/testUtils'
import { NewsCommunicationPage, TransparencyPage, VolunteeringPage } from './HomeTopicPages'

vi.mock('@features/news/hooks/useNews', () => ({
  useNews: vi.fn(),
}))

function renderPage(page: React.ReactNode) {
  return render(<MemoryRouter>{page}</MemoryRouter>)
}

describe('Home topic pages', () => {
  beforeEach(() => {
    vi.mocked(useNews).mockReturnValue({
      items: [],
      loading: false,
      error: null,
    })
  })

  it('explains the news and communication direction', () => {
    renderPage(<NewsCommunicationPage />)

    expect(screen.getByRole('heading', { name: 'Știri și comunicare', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Informații verificate' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Vezi toate știrile' })).toHaveAttribute('href', '/news')
  })

  it('shows four sourced senior news panels with links to the cited articles', () => {
    const items = buildNewsItems(5)
    vi.mocked(useNews).mockReturnValue({
      items,
      loading: false,
      error: null,
    })

    renderPage(<NewsCommunicationPage />)

    expect(screen.getByRole('heading', { name: 'Știri recente pentru seniori' })).toBeInTheDocument()
    expect(screen.getByText('News Item 1')).toBeInTheDocument()
    expect(screen.getByText('News Item 4')).toBeInTheDocument()
    expect(screen.queryByText('News Item 5')).not.toBeInTheDocument()

    const sourceLinks = screen.getAllByRole('link', { name: /Citește articolul citat/ })
    expect(sourceLinks).toHaveLength(4)
    sourceLinks.forEach((link) => {
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })
  })

  it('explains how volunteers can contribute', () => {
    renderPage(<VolunteeringPage />)

    expect(screen.getByRole('heading', { name: 'Voluntariat pentru comunitate', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sprijin comunitar' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Trimite cererea de înscriere' })).toHaveAttribute('href', '/contact')
  })

  it('explains transparency and links to public documents', () => {
    renderPage(<TransparencyPage />)

    expect(screen.getByRole('heading', { name: 'Transparență și responsabilitate', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Documente publice' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Consultă documentele PCS' })).toHaveAttribute(
      'href',
      '/documente/statut',
    )
  })
})
