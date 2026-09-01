import { useCounties } from '../hooks/useCounties'
import { JoinRequestForm } from '../components/JoinRequestForm'

export function ContactPage() {
  const { loading: countiesLoading, error: countiesError, counties } = useCounties()

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-kicker">Contact & înscrieri</div>
        <h1>Contact</h1>
        <p className="lead">Înscriere aderent și informații de contact pentru platforma PCP.</p>
      </section>

      <div className="mt-18">
        <JoinRequestForm
          countiesLoading={countiesLoading}
          countiesError={countiesError}
          counties={counties}
        />
      </div>
    </div>
  )
}
