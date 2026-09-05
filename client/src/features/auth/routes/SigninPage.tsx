import { Navigate } from 'react-router-dom'
import { useState } from 'react'
import { LoginForm } from '../components/LoginForm'
import { useAuth } from '../context'

export function SigninPage(): JSX.Element {
  const { user, loading } = useAuth()
  const [authenticating, setAuthenticating] = useState(false)

  if (loading) {
    return <div style={{ padding: 24 }}>Se încarcă...</div>
  }

  if (user && !authenticating) {
    return <Navigate to="/profil" replace />
  }

  return (
    <div className="signin-page">
      <section className="card contact-card signin-page__card">
        <LoginForm onAuthenticatingChange={setAuthenticating} />
      </section>
    </div>
  )
}
