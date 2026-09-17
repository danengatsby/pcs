import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminContext } from './AdminContext'
import { CommunicationsPage } from './CommunicationsPage'
import { createCommunicationDispatch, previewCommunication } from '@features/politicalOperations/api/politicalOperations'

vi.mock('@features/politicalOperations/api/politicalOperations', () => ({
  createCommunicationDispatch: vi.fn(), previewCommunication: vi.fn(),
}))

function renderCommunications(canSend: boolean) {
  return render(<AdminContext.Provider value={{ access: {
    role: 'SECRETAR', profile: 'communications', capabilities: ['workspace.read', 'communication.preview', ...(canSend ? ['communication.dispatch'] : [])],
    scope: { national: true, label: 'Național', organizationIds: [] },
  } }}><CommunicationsPage /></AdminContext.Provider>)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(previewCommunication).mockResolvedValue({ ok: true, data: { eligible: 2, byCounty: {}, byRole: {}, channel: 'email' } })
  vi.mocked(createCommunicationDispatch).mockResolvedValue({ ok: true, data: { id: '1', status: 'draft', recipientCount: 2, delivery: 'draft' } })
})

describe('communication duties', () => {
  it('allows drafting without displaying dispatch controls to an account without dispatch capability', async () => {
    const user = userEvent.setup()
    renderCommunications(false)
    expect(screen.queryByRole('button', { name: 'Pune emailurile în coadă' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvează draft' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Verifică destinatarii eligibili' }))
    await user.type(screen.getByLabelText('Subiect'), 'Ședință de organizare')
    await user.type(screen.getByLabelText('Mesaj'), 'Ședința de organizare are loc vineri.')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Salvează draft' }))
    expect(createCommunicationDispatch).toHaveBeenCalledWith(expect.objectContaining({ mode: 'draft', confirmConsentSelection: true }))
    expect(await screen.findByText('Comunicarea a fost salvată ca draft.')).toBeInTheDocument()
  })

  it('dispatches only after preview and confirmation and invalidates confirmation when content changes', async () => {
    const user = userEvent.setup()
    renderCommunications(true)
    const send = screen.getByRole('button', { name: 'Pune emailurile în coadă' })
    expect(send).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Verifică destinatarii eligibili' }))
    await user.type(screen.getByLabelText('Subiect'), 'Ședință de organizare')
    await user.type(screen.getByLabelText('Mesaj'), 'Ședința de organizare are loc vineri.')
    await user.click(screen.getByRole('checkbox'))
    await user.type(screen.getByLabelText('Mesaj'), ' Ora 10.')
    expect(send).toBeDisabled()
    await user.click(screen.getByRole('checkbox'))
    await user.click(send)
    expect(createCommunicationDispatch).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ mode: 'send', channel: 'email' }))
    expect(send).toBeDisabled()
  })
})
