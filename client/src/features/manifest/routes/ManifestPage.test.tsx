import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ManifestPage } from './ManifestPage'

vi.mock('@app/layout/SiteHeader', () => ({
  SiteHeader: () => <header>Antet PCS</header>,
}))

describe('ManifestPage', () => {
  it('offers DOCX and PDF downloads for the manifest', () => {
    render(<ManifestPage />)

    const docxLink = screen.getByRole('link', { name: 'Descarcă DOCX' })
    expect(docxLink).toHaveAttribute('href', '/downloads/Manifestul_PCS.docx?v=2026-09-07-extins')
    expect(docxLink).toHaveAttribute('download')

    const pdfLink = screen.getByRole('link', { name: 'Descarcă PDF' })
    expect(pdfLink).toHaveAttribute('href', '/downloads/Manifestul_PCS.pdf?v=2026-09-07-extins')
    expect(pdfLink).toHaveAttribute('download')
  })

  it('keeps the online manifest viewer', () => {
    render(<ManifestPage />)

    expect(screen.getByTitle('Manifest PCS')).toHaveAttribute('src', '/manifest_pcs.html?v=2026-09-07-extins')
  })
})
