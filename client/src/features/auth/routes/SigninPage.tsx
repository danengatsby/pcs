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
    <div className="signin-page">
      <section className="card contact-card signin-page__card">
        <LoginForm />
      </section>
    </div>
  )
}
