import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { HomePage } from './HomePage'

describe('HomePage', () => {
  it('links every direction card to its dedicated page', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: /Știri & comunicare/ })).toHaveAttribute(
      'href',
      '/initiative/stiri-si-comunicare',
    )
    expect(screen.getByRole('link', { name: /Voluntariat/ })).toHaveAttribute(
      'href',
      '/initiative/voluntariat',
    )
    expect(screen.getByRole('link', { name: /Transparență/ })).toHaveAttribute(
      'href',
      '/initiative/transparenta',
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
