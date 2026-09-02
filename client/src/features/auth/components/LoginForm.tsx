import { startTransition, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input } from '@components'
import { prefetchAdminRoutes } from '@app/routeModules'
import { useAuth } from '../context'
import { useSignin } from '../hooks/useSignin'
import { hasAdminAccess } from '../types'

type SigninIntent = 'profile' | 'admin'

export function LoginForm(): JSX.Element {
  const { state, submit, reset } = useSignin()
  const { signout } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [intent, setIntent] = useState<SigninIntent | null>(null)
  const [adminError, setAdminError] = useState<string | null>(null)

  const isLoading = state.status === 'loading'
  const errorMessage = state.status === 'error' ? state.error.message : null

  async function authenticate(nextIntent: SigninIntent): Promise<void> {
    if (isLoading) return

    setIntent(nextIntent)
    setAdminError(null)
    const result = await submit({ email, password })

    if (!result.ok) {
      setIntent(null)
      return
    }

    const adminAccess = hasAdminAccess(result.data.user.role)
    if (nextIntent === 'admin' && !adminAccess) {
      try {
        await signout()
      } catch {
        // Contextul elimină sesiunea locală inclusiv când revocarea serverului eșuează.
      }
      reset()
      setIntent(null)
      setAdminError('Acest cont nu are drepturi administrative PCS.')
      return
    }

    if (adminAccess) {
      prefetchAdminRoutes()
    }

    setEmail('')
    setPassword('')
    const destination = nextIntent === 'admin'
      ? result.data.user.role === 'VICEPRESEDINTE' || result.data.user.role === 'PRESEDINTE'
        ? '/admin/dashboard'
        : '/admin/volunteers'
      : '/profil'

    startTransition(() => {
      navigate(destination)
    })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void authenticate('profile')
      }}
      className="signin-form"
    >
      <h1>Autentificare</h1>
      <p className="muted">Autentifică-te cu utilizatorul și parola contului tău PCS.</p>

      <label className="field">
        <span>Utilizator</span>
        <Input value={email} onChange={(e) => setEmail(e.target.value)} type="text" autoComplete="username" />
      </label>
      <p className="muted">Introdu partea dinainte de @.</p>

      <label className="field">
        <span>Parolă</span>
        <Input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
        />
      </label>

      {errorMessage ? <div className="alert error" role="alert">{errorMessage}</div> : null}
      {adminError ? <div className="alert error" role="alert">{adminError}</div> : null}

      <div className="signin-form__actions">
        <Button type="submit" disabled={isLoading}>
          {isLoading && intent === 'profile' ? 'Se autentifică...' : 'Autentificare'}
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={isLoading}
          onClick={() => void authenticate('admin')}
        >
          {isLoading && intent === 'admin' ? 'Se verifică accesul...' : 'Autentificare ca admin'}
        </Button>
      </div>
      <p className="signin-form__admin-hint">
        Folosește acest buton dacă ai primit acces de administrator PCS.
      </p>
    </form>
  )
}
