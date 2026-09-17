import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@components'
import { apiPost } from '@lib/http'
import { authStorage } from '@react/shared/auth/authStorage'
import { useAuth } from '../context'
import { hasAdminAccess, type AuthSessionResponse } from '../types'

export function AdminDirectLoginForm({ onAuthenticatingChange }: { onAuthenticatingChange: (value: boolean) => void }): JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { reload } = useAuth()
  const navigate = useNavigate()

  async function enter(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    onAuthenticatingChange(true)
    try {
      const result = await apiPost<AuthSessionResponse>('/api/auth/admin-public-login', {})
      if (!result.ok) { setError(result.error.message); return }
      if (!hasAdminAccess(result.data.user.role)) {
        setError('Accesul administrativ nu este disponibil. Reîncearcă.')
        return
      }
      authStorage.setFromResponse(result.data)
      await reload()
      navigate('/admin', { replace: true })
    } catch {
      setError('Conexiunea nu a permis deschiderea administrării. Reîncearcă.')
    } finally {
      setBusy(false)
      onAuthenticatingChange(false)
    }
  }

  return <form className="signin-form" aria-label="Acces direct administrativ" onSubmit={event => { void enter(event) }}>
    <Button type="submit" variant="primary" disabled={busy}>
      {busy ? 'Se deschide administrarea…' : 'Intră direct ca administrator'}
    </Button>
    <p className="muted">Acces liber în administrare, fără parolă sau link.</p>
    {error ? <div className="alert error" role="alert">{error}</div> : null}
  </form>
}
