import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { clearAdminDirectLoginToken, hasAdminDirectLoginToken, redeemAdminDirectLogin } from '@lib/adminDirectLogin'
import { authStorage } from '@react/shared/auth/authStorage'
import { useAuth } from '../context'

export function AdminDirectLoginPage({ onAuthenticatingChange }: { onAuthenticatingChange?: (value: boolean) => void } = {}): JSX.Element {
  const [hasToken] = useState(hasAdminDirectLoginToken)
  const [error, setError] = useState(hasToken ? '' : 'Deschide linkul personal de acces direct primit în conversație.')
  const { reload } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    if (!hasToken) return
    let cancelled = false
    onAuthenticatingChange?.(true)
    void redeemAdminDirectLogin().then(async result => {
      if (cancelled) return
      clearAdminDirectLoginToken()
      if (!result.ok) { setError(result.error.message); return }
      authStorage.setFromResponse(result.data)
      await reload()
      if (!cancelled) navigate('/admin', { replace: true })
    }).catch(() => {
      if (!cancelled) setError('Accesul nu a putut fi finalizat. Deschide administrarea sau solicită un link nou.')
    }).finally(() => {
      if (!cancelled) onAuthenticatingChange?.(false)
    })
    return () => { cancelled = true }
  }, [hasToken, reload, navigate, onAuthenticatingChange])

  return <div className="signin-page"><section className="card contact-card signin-page__card">
    <h1>Acces direct în administrare</h1>
    {error ? <>
      <div className="alert error" role="alert">{error}</div>
      <p><Link to="/admin">Deschide administrarea</Link></p>
    </> : <p role="status">Se deschide panoul tău administrativ…</p>}
  </section></div>
}
