import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Input } from '@components'
import { apiPost } from '@lib/http'
import { clearAdminActivationToken, readAdminActivationToken } from '@lib/adminActivationToken'
import { authStorage } from '@react/shared/auth/authStorage'
import { useAuth } from '../context'
import type { AuthSessionResponse } from '../types'

type Enrollment = { fullName: string; email: string; secret: string; qrDataUrl: string; expiresAt: string }

export function AdminActivationPage(): JSX.Element {
  const [token] = useState(readAdminActivationToken)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [loading, setLoading] = useState(Boolean(token))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(token ? '' : 'Deschide linkul personal de activare primit de la administrator. Dacă ai reîncărcat pagina, deschide din nou linkul.')
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const { reload } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) return
    let cancelled = false
    void apiPost<Enrollment>('/api/auth/admin-activation/preview', { token }).then(result => {
      if (cancelled) return
      if (result.ok) setEnrollment(result.data)
      else setError(result.error.message)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [token])

  async function activate(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (busy || !enrollment) return
    setBusy(true)
    setError('')
    const result = await apiPost<AuthSessionResponse>('/api/auth/admin-activation/complete', { token, password, mfaCode })
    if (!result.ok) {
      setError(result.error.message)
      setMfaCode('')
      if (result.error.code === 'AUTH_ACTIVATION_INVALID') setEnrollment(null)
      setBusy(false)
      return
    }
    clearAdminActivationToken()
    setPassword('')
    setMfaCode('')
    setEnrollment(null)
    authStorage.setFromResponse(result.data)
    await reload()
    navigate('/admin', { replace: true })
  }

  return <div className="signin-page">
    <section className="card contact-card signin-page__card" style={{ boxSizing: 'border-box', minWidth: 0, overflowWrap: 'anywhere' }}>
      <h1>Activează contul tău</h1>
      {loading ? <p role="status">Se pregătește activarea...</p> : null}
      {error ? <div className="alert error" role="alert">{error}</div> : null}
      {enrollment ? <form className="signin-form" onSubmit={event => { void activate(event) }}>
        <p><strong>{enrollment.fullName}</strong><br />{enrollment.email}</p>
        <Input id="activation-email" label="Email" type="email" value={enrollment.email} autoComplete="username" readOnly />
        <Input id="activation-password" aria-label="1. Alege parola" label="1. Alege parola" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" minLength={10} maxLength={128} required disabled={busy} hint="Minimum 10 caractere, cu literă mare, literă mică, cifră și simbol." />
        <div>
          <h2 style={{ fontSize: '1.2rem' }}>2. Scanează codul cu aplicația de autentificare</h2>
          <p>Pe telefon, deschide aplicația de autentificare, adaugă un cont și scanează acest cod. Configurarea se face o singură dată.</p>
          <img src={enrollment.qrDataUrl} alt="Cod QR pentru configurarea autentificării PCS" width={320} height={320} style={{ display: 'block', maxWidth: '100%', height: 'auto', margin: '0 auto' }} />
          <details><summary>Configurez de pe același telefon / introduc cheia manual</summary>
            <p>Copiază cheia în aplicația de autentificare. Alege un cont bazat pe timp (TOTP).</p>
            <code style={{ display: 'block', overflowWrap: 'anywhere', userSelect: 'all', padding: 12 }}>{enrollment.secret}</code>
          </details>
        </div>
        <Input id="activation-mfa" label="3. Introdu codul de 6 cifre" value={mfaCode} onChange={event => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={busy} />
        <Button type="submit" disabled={busy || mfaCode.length !== 6}>{busy ? 'Se activează...' : 'Activează și intră în cont'}</Button>
      </form> : null}
      {!loading && !enrollment && !busy ? <p><Link to="/auth/signin">Am activat deja contul — autentificare</Link></p> : null}
    </section>
  </div>
}
