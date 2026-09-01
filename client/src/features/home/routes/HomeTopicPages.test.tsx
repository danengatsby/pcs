import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { NewsCommunicationPage, TransparencyPage, VolunteeringPage } from './HomeTopicPages'

function renderPage(page: React.ReactNode) {
  return render(<MemoryRouter>{page}</MemoryRouter>)
}

describe('Home topic pages', () => {
  it('explains the news and communication direction', () => {
    renderPage(<NewsCommunicationPage />)

    expect(screen.getByRole('heading', { name: 'Știri și comunicare', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Informații verificate' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Vezi toate știrile' })).toHaveAttribute('href', '/news')
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
