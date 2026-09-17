import { useState } from 'react'
import { Button, Input, Select } from '@components'
import { createCommunicationDispatch, previewCommunication } from '@features/politicalOperations/api/politicalOperations'
import type { CommunicationAudience } from '@features/politicalOperations/types'
import { useAdminWorkspace } from './AdminContext'

export function CommunicationsPage() {
  const { access } = useAdminWorkspace()
  const [channel, setChannel] = useState<CommunicationAudience['channel']>('email')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [eligible, setEligible] = useState<number | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const canSend = access.capabilities.includes('communication.dispatch')
  const audience: CommunicationAudience = { channel, organizationId: null, countyIds: [], roles: [], interests: [] }

  async function preview() {
    setBusy(true); setError(''); setStatus(''); setConfirmed(false); setEligible(null)
    try {
      const response = await previewCommunication(audience)
      if (!response.ok) { setError(response.error.message); return }
      setEligible(response.data.eligible)
    } finally { setBusy(false) }
  }

  async function save(mode: 'draft' | 'send') {
    if (busy || !confirmed || !eligible || (mode === 'send' && !canSend)) return
    setBusy(true); setError(''); setStatus('')
    try {
      const response = await createCommunicationDispatch({ ...audience, title, message, mode, confirmConsentSelection: confirmed })
      if (!response.ok) { setError(response.error.message); return }
      setStatus(mode === 'draft' ? 'Comunicarea a fost salvată ca draft.' : channel === 'email' ? 'Emailurile au fost puse în coada de trimitere.' : 'Comunicarea este pregătită pentru furnizorul autorizat. Nu a fost încă expediată.')
      setConfirmed(false); setEligible(null)
    } finally { setBusy(false) }
  }

  return <section className="admin-register">
    <header><h1>Comunicare</h1><p>Pregătește comunicări pentru destinatarii cu acord activ din aria autorizată: {access.scope.label}.</p></header>
    <form className="card admin-workspace__panel" onSubmit={(event) => {
      event.preventDefault()
      const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
      void save(submitter?.value === 'send' ? 'send' : 'draft')
    }}>
      <Select label="Canal" value={channel} disabled={busy} onChange={(event) => { setChannel(event.target.value as CommunicationAudience['channel']); setEligible(null); setConfirmed(false) }} options={[{ value: 'email', label: 'Email' }, { value: 'sms', label: 'SMS' }, { value: 'whatsapp', label: 'WhatsApp' }]} />
      <Button type="button" disabled={busy} onClick={() => void preview()}>Verifică destinatarii eligibili</Button>
      {eligible !== null && <p role="status">{eligible} destinatari cu acord activ pentru canalul selectat.</p>}
      <Input label="Subiect" value={title} required minLength={3} maxLength={180} disabled={busy} onChange={(event) => { setTitle(event.target.value); setConfirmed(false) }} />
      <label>Mesaj<textarea value={message} required minLength={10} maxLength={10000} rows={6} disabled={busy} onChange={(event) => { setMessage(event.target.value); setConfirmed(false) }} /></label>
      <label><input type="checkbox" checked={confirmed} disabled={busy || !eligible} onChange={(event) => setConfirmed(event.target.checked)} /> Confirm destinatarii eligibili și conținutul comunicării.</label>
      <div className="admin-register__actions">
        <Button type="submit" name="mode" value="draft" disabled={busy || !eligible || !confirmed}>Salvează draft</Button>
        {canSend && <Button type="submit" name="mode" value="send" variant="primary" disabled={busy || !eligible || !confirmed}>{channel === 'email' ? 'Pune emailurile în coadă' : 'Pregătește pentru furnizor'}</Button>}
      </div>
      {status && <p role="status">{status}</p>}
      {error && <p role="alert">{error}</p>}
    </form>
  </section>
}
