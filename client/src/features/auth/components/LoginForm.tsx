import { startTransition, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input } from '@components'
import { prefetchAdminRoutes } from '@app/routeModules'
import { useSignin } from '../hooks/useSignin'
import { hasAdminAccess } from '../types'

export function LoginForm(): JSX.Element {
  const { state, submit } = useSignin()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const isLoading = state.status === 'loading'
  const errorMessage = state.status === 'error' ? state.error.message : null

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void (async () => {
          const result = await submit({ email, password })
          if (!result.ok) {
            return
          }

          const adminAccess = hasAdminAccess(result.data.user.role)
          if (adminAccess) {
            prefetchAdminRoutes()
          }

          setEmail('')
          setPassword('')
          startTransition(() => {
            navigate('/profil')
          })
        })()
      }}
      style={{ display: 'grid', gap: 12 }}
    >
      <h1>Autentificare</h1>
      <p className="muted">Autentifică-te cu userul sau emailul și parola contului de administrator.</p>

      <label style={{ display: 'grid', gap: 6 }}>
        <span>User / Email</span>
        <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" />
      </label>

      <label style={{ display: 'grid', gap: 6 }}>
        <span>Parolă</span>
        <Input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="text"
          autoComplete="current-password"
        />
      </label>

      {errorMessage ? <div style={{ color: 'crimson' }}>{errorMessage}</div> : null}

      <Button type="submit" disabled={isLoading}>
        {isLoading ? 'Se autentifică...' : 'Autentificare'}
      </Button>
    </form>
  )
}
