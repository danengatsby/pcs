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
  const [mfaCode, setMfaCode] = useState('')
  const [requiresMfa, setRequiresMfa] = useState(false)
  const [intent, setIntent] = useState<SigninIntent | null>(null)
  const [adminError, setAdminError] = useState<string | null>(null)

  const isLoading = state.status === 'loading'
  const errorMessage = state.status === 'error' ? state.error.message : null

  async function authenticate(nextIntent: SigninIntent): Promise<void> {
    if (isLoading) return
    if (!email.trim() || !password) {
      setAdminError('Completează utilizatorul și parola contului personal.')
      return
    }

    setIntent(nextIntent)
    setAdminError(null)
    // Keep SigninPage mounted while the auth context updates, so its default
    // profile redirect cannot race the explicit administrative destination.
    onAuthenticatingChange?.(true)
    const result = await submit({ email: email.trim(), password, ...(requiresMfa ? { mfaCode } : {}) })

    if (!result.ok) {
      if (['AUTH_MFA_REQUIRED', 'AUTH_MFA_INVALID', 'AUTH_MFA_LOCKED'].includes(result.error.code ?? '')) {
        setRequiresMfa(true)
        setMfaCode('')
      }
      onAuthenticatingChange?.(false)
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
    setMfaCode('')
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
        void authenticate(requiresMfa ? (intent ?? 'profile') : 'profile')
      }}
      className="signin-form"
    >
      <p className="muted">Te poți autentifica și cu datele contului personal. Pentru administrare, această opțiune cere parola și codul din aplicația de autentificare.</p>

      <Input id="signin-username" label="Utilizator" value={email} onChange={(e) => { setEmail(e.target.value); setRequiresMfa(false); setMfaCode(''); reset() }} type="text" autoComplete="username" required disabled={isLoading} />
      <p className="muted">Introdu emailul complet sau numele unic de utilizator.</p>

        <Input
          id="signin-password"
          label="Parolă"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
          required
          disabled={isLoading}
        />

      {requiresMfa ? <Input
        id="signin-mfa"
        aria-label="Cod din aplicația de autentificare"
        label="Cod din aplicația de autentificare"
        value={mfaCode}
        onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
        autoComplete="one-time-code"
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        autoFocus
        disabled={isLoading}
        hint="Cod de 6 cifre. Fiecare cod poate fi folosit o singură dată."
      /> : null}

      {errorMessage ? <div className="alert error" role="alert">{errorMessage}</div> : null}
      {adminError ? <div className="alert error" role="alert">{adminError}</div> : null}

      <div className="signin-form__actions">
        <Button type="submit" disabled={isLoading}>
          {isLoading && intent === 'profile' ? 'Se autentifică...' : 'Autentificare'}
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={isLoading || (requiresMfa && mfaCode.length !== 6)}
          onClick={() => void authenticate('admin')}
        >
          {isLoading && intent === 'admin' ? 'Se verifică accesul...' : 'Autentificare ca admin'}
        </Button>
      </div>
      <p className="signin-form__admin-hint">
        „Autentificare ca admin” verifică datele contului personal și drepturile atribuite. Pentru activarea sau recuperarea autentificării în doi pași, contactează administratorul.
      </p>
    </form>
  )
}
