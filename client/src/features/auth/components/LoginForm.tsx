import { startTransition, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input } from '@components'
import { useAuth } from '../context'
import { useSignin } from '../hooks/useSignin'
import { hasAdminAccess } from '../types'

type SigninIntent = 'profile' | 'admin'

export function LoginForm({ onAuthenticatingChange }: { onAuthenticatingChange?: (value: boolean) => void }): JSX.Element {
  const { state, submit, reset } = useSignin()
  const { signout } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [intent, setIntent] = useState<SigninIntent | null>(null)
  const [adminError, setAdminError] = useState<string | null>(null)

  const isLoading = state.status === 'loading'
  const errorMessage = state.status === 'error' ? state.error.message : null

  // Doar pentru mediul de dezvoltare local: nu există în bundle-ul de producție
  // (import.meta.env.DEV este false la build de producție, iar Vite elimină ramura).
  const devAdminEmail = import.meta.env.DEV ? import.meta.env.VITE_DEV_ADMIN_EMAIL?.trim() : undefined
  const devAdminPassword = import.meta.env.DEV ? import.meta.env.VITE_DEV_ADMIN_PASSWORD?.trim() : undefined
  const devAdminShortcutEnabled = Boolean(import.meta.env.DEV && devAdminEmail && devAdminPassword)

  async function authenticate(nextIntent: SigninIntent, credentials?: { email: string; password: string }): Promise<void> {
    if (isLoading) return

    setIntent(nextIntent)
    setAdminError(null)
    // Keep SigninPage mounted while the auth context updates, so its default
    // profile redirect cannot race the explicit administrative destination.
    onAuthenticatingChange?.(true)
    const result = await submit(credentials ?? (
      nextIntent === 'admin'
        ? { email: 'admin', password: 'admin' }
        : { email, password }
    ))

    if (!result.ok) {
      onAuthenticatingChange?.(false)
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
      onAuthenticatingChange?.(false)
      return
    }

    setEmail('')
    setPassword('')
    const destination = nextIntent === 'admin'
      ? '/admin'
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
        „Autentificare ca admin” deschide direct contul comun de administrare, fără completarea formularului.
      </p>

      {devAdminShortcutEnabled ? (
        <div className="signin-form__dev-shortcut">
          <Button
            type="button"
            variant="default"
            disabled={isLoading}
            onClick={() => void authenticate('admin', { email: devAdminEmail!, password: devAdminPassword! })}
          >
            {isLoading && intent === 'admin' ? 'Se autentifică (dev)...' : '🧪 Autentificare admin (doar dev)'}
          </Button>
          <p className="muted">
            Vizibil doar în mediul de dezvoltare local (VITE_DEV_ADMIN_EMAIL / VITE_DEV_ADMIN_PASSWORD). Nu apare în build-ul de producție.
          </p>
        </div>
      ) : null}
    </form>
  )
}
