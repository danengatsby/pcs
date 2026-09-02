import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { HomePage } from './HomePage'

describe('HomePage', () => {
  it('presents the political program and clear membership actions', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: /Demnitate pentru seniori/ })).toBeInTheDocument()
    expect(screen.getByText(/PCS apără pensia demnă, sănătatea accesibilă/)).toBeInTheDocument()
    expect(screen.getByText(/Am publicat Programul 2026—2034/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Primele trei angajamente ale PCS' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Un mandat clar la fiecare nivel' })).toBeInTheDocument()
    expect(screen.getByText('Ce apără PCS?')).toBeInTheDocument()
    expect(screen.getByText('Ce a făcut concret?')).toBeInTheDocument()
    expect(screen.getByText('Cum mă pot implica astăzi?')).toBeInTheDocument()
    expect(screen.getByText('Șapte obiective pentru 2034, priorități imediate, indicatori publici și raportare a progresului la fiecare șase luni.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Citește programul' })).toHaveAttribute(
      'href', '/documente/program-politic',
    )
    expect(screen.getAllByRole('link', { name: 'Aderă la PCS' })[0]).toHaveAttribute('href', '/contact#aderare')
    expect(screen.getByRole('link', { name: 'Găsește organizația din județul tău' })).toHaveAttribute(
      'href', '/contact#filiale',
    )
  })

  it('renders the PCS logo in the main hero', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('img', { name: 'Sigla PCS' })).toBeInTheDocument()
  })
})
