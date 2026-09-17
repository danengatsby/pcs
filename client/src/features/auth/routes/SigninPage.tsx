import { Navigate } from 'react-router-dom'
import { useState } from 'react'
import { LoginForm } from '../components/LoginForm'
import { AdminDirectLoginForm } from '../components/AdminDirectLoginForm'
import { useAuth } from '../context'
import { hasAdminAccess } from '../types'
import { hasAdminDirectLoginToken } from '@lib/adminDirectLogin'
import { AdminDirectLoginPage } from './AdminDirectLoginPage'

export function SigninPage(): JSX.Element {
  const { user, loading } = useAuth()
  const [authenticating, setAuthenticating] = useState(false)
  const [directAccess] = useState(hasAdminDirectLoginToken)

  if (loading && !authenticating) {
    return <div style={{ padding: 24 }}>Se încarcă...</div>
  }

  if (directAccess) return <AdminDirectLoginPage onAuthenticatingChange={setAuthenticating} />

  if (user && hasAdminAccess(user.role) && !authenticating) {
    return <Navigate to="/admin" replace />
  }

  return (
    <div className="signin-page">
      <section className="card contact-card signin-page__card">
        <h1>Autentificare</h1>
        <AdminDirectLoginForm onAuthenticatingChange={setAuthenticating} />
        <LoginForm onAuthenticatingChange={setAuthenticating} />
      </section>
    </div>
  )
}
