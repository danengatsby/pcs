import { Navigate } from 'react-router-dom'
import { LoginForm } from '../components/LoginForm'
import { useAuth } from '../context'

export function SigninPage(): JSX.Element {
  const { user, loading } = useAuth()

  if (loading) {
    return <div style={{ padding: 24 }}>Se încarcă...</div>
  }

  if (user) {
    return <Navigate to="/profil" replace />
  }

  return (
    <div style={{ padding: 24 }}>
      <section className="card contact-card" style={{ maxWidth: 420 }}>
        <LoginForm />
      </section>
    </div>
  )
}
