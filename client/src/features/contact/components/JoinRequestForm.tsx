import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Button, Input, Select } from '@components'
import type { CountyName } from '../api/getCounties'
import { useSubmitJoin } from '../hooks/useSubmitJoin'

type JoinFormState = {
  fullName: string
  email: string
  password: string
  phone: string
  county: string
  locality: string
  motivation: string
  skills: string
  website: string
  agreement: boolean
}

type JoinRequestFormProps = {
  countiesLoading: boolean
  countiesError: string | null
  counties: CountyName[]
}

type JoinFormStep = 1 | 2

function createInitialJoinFormState(): JoinFormState {
  return {
    fullName: '',
    email: '',
    password: '',
    phone: '',
    county: '',
    locality: '',
    motivation: '',
    skills: '',
    website: '',
    agreement: false,
  }
}

export function JoinRequestForm({
  countiesLoading,
  countiesError,
  counties,
}: JoinRequestFormProps) {
  const { submit, submitting, reset: resetSubmitJoin } = useSubmitJoin()
  const [join, setJoin] = useState<JoinFormState>(createInitialJoinFormState)
  const [step, setStep] = useState<JoinFormStep>(1)
  const [joinStatus, setJoinStatus] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const stepHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const shouldFocusStepRef = useRef(false)

  const countyOptions = useMemo(
    () => counties.map((county) => ({ value: county, label: county })),
    [counties],
  )

  useEffect(() => {
    if (!shouldFocusStepRef.current) return

    shouldFocusStepRef.current = false
    stepHeadingRef.current?.focus()
  }, [step])

  const updateField = <Key extends keyof JoinFormState>(key: Key) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const nextValue =
        key === 'agreement'
          ? (event.target as HTMLInputElement).checked
          : event.target.value

      setJoin((current) => ({
        ...current,
        [key]: nextValue,
      }))
    }

  function moveToStep(nextStep: JoinFormStep) {
    setJoinStatus(null)
    shouldFocusStepRef.current = true
    setStep(nextStep)
  }

  function handleFirstStepSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    moveToStep(2)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!join.agreement) {
      setJoinStatus('Trebuie să accepți prelucrarea datelor (GDPR).')
      return
    }

    setJoinStatus(null)
    resetSubmitJoin()

    try {
      await submit({
        fullName: join.fullName,
        email: join.email,
        password: join.password,
        phone: join.phone,
        county: join.county,
        locality: join.locality,
        motivation: join.motivation,
        skills: join.skills,
        website: join.website,
      })

      setJoinStatus('Cererea de înscriere a fost trimisă. Mulțumim!')
      setJoin(createInitialJoinFormState())
      setSubmitted(true)
    } catch (error) {
      setJoinStatus(error instanceof Error ? error.message : 'Eroare la trimitere. Încearcă din nou.')
    }
  }

  if (submitted) {
    return (
      <section className="card contact-card contact-card--success" aria-live="polite">
        <div className="contact-card__success-mark" aria-hidden="true">✓</div>
        <div>
          <div className="hero-kicker">Cerere înregistrată</div>
          <h2>Mulțumim pentru înscriere.</h2>
          <p className="muted">{joinStatus}</p>
          <p className="muted">Vei primi pe email confirmarea și informațiile despre pașii următori.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="card contact-card">
      <div className="stack-12">
        <h2>Cerere de aderare</h2>
        <p className="muted">
          Completează datele pentru a trimite cererea. Contul rămâne susținător până la validarea administrativă.
        </p>
      </div>

      <div className={`join-stepper join-stepper--step-${step}`} aria-label={`Pasul ${step} din 2`}>
        <div className="join-stepper__progress" aria-hidden="true">
          <span />
        </div>
        <ol>
          <li className={step >= 1 ? 'is-active' : ''}>
            <span>{step > 1 ? '✓' : '1'}</span>
            <strong>Date de contact</strong>
          </li>
          <li className={step === 2 ? 'is-active' : ''}>
            <span>2</span>
            <strong>Cont și implicare</strong>
          </li>
        </ol>
        <p>Pasul {step} din 2</p>
      </div>

      <form className="form join-form" onSubmit={step === 1 ? handleFirstStepSubmit : handleSubmit}>
        {step === 1 ? (
          <div className="join-form__step" aria-labelledby="join-step-one-title">
            <div className="join-form__step-heading">
              <h3 id="join-step-one-title" ref={stepHeadingRef} tabIndex={-1}>Cum te putem contacta?</h3>
              <p>Începem cu datele necesare pentru direcționarea cererii către organizația potrivită.</p>
            </div>

            <Input
              label="Nume complet"
              name="fullName"
              autoComplete="name"
              value={join.fullName}
              onChange={updateField('fullName')}
              required
              placeholder="Nume Prenume"
            />

            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              value={join.email}
              onChange={updateField('email')}
              required
              placeholder="email@exemplu.ro"
            />

            <Input
              label="Telefon (opțional)"
              name="phone"
              type="tel"
              autoComplete="tel"
              value={join.phone}
              onChange={updateField('phone')}
              placeholder="07xx xxx xxx"
            />

            <Select
              label="Județ"
              name="county"
              value={join.county}
              onChange={updateField('county')}
              required
              disabled={countiesLoading || Boolean(countiesError)}
              placeholder={
                countiesLoading
                  ? 'Se încarcă județele…'
                  : countiesError
                    ? 'Nu s-au putut încărca județele'
                    : 'Alege județul'
              }
              options={countyOptions}
              hint={countiesError ?? undefined}
            />

            <Input
              label="Localitate"
              name="locality"
              autoComplete="address-level2"
              value={join.locality}
              onChange={updateField('locality')}
              required
              placeholder="Ex: Cluj-Napoca"
            />
          </div>
        ) : (
          <div className="join-form__step" aria-labelledby="join-step-two-title">
            <div className="join-form__step-heading">
              <h3 id="join-step-two-title" ref={stepHeadingRef} tabIndex={-1}>Cum vrei să te implici?</h3>
              <p>Creează parola contului și spune-ne ce experiență vrei să aduci în echipă.</p>
            </div>

            <div className="join-form__identity-summary">
              <div>
                <span>Cerere pentru</span>
                <strong>{join.fullName}</strong>
                <small>{join.email} · {join.locality}, {join.county}</small>
              </div>
              <button className="text-link" type="button" onClick={() => moveToStep(1)}>Editează datele</button>
            </div>

            <Input
              label="Parolă pentru cont"
              name="password"
              type="password"
              autoComplete="new-password"
              value={join.password}
              onChange={updateField('password')}
              required
              placeholder="••••••••••"
              hint="Minim 10 caractere, cu literă mare, literă mică, cifră și simbol."
            />

            <Input
              label="Competențe (opțional)"
              name="skills"
              value={join.skills}
              onChange={updateField('skills')}
              placeholder="Ex: comunicare, organizare, IT…"
            />

            <label className="field">
              <span>De ce vrei să te implici?</span>
              <textarea
                name="motivation"
                value={join.motivation}
                onChange={updateField('motivation')}
                required
                minLength={10}
                maxLength={1500}
                rows={4}
                placeholder="Spune-ne pe scurt ce te motivează (minim 10 caractere)."
              />
            </label>

            <label className="field checkbox join-form__agreement">
              <input
                type="checkbox"
                required
                checked={join.agreement}
                onChange={updateField('agreement')}
              />
              <span className="muted">
                Sunt de acord cu prelucrarea datelor conform{' '}
                <a className="text-link" href="/documente/regulament-gdpr" target="_blank" rel="noreferrer">
                  regulamentului GDPR
                </a>
                .
              </span>
            </label>
          </div>
        )}

        <div
          className="join-form__honeypot"
          aria-hidden="true"
        >
          <label>
            Website
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={join.website}
              onChange={updateField('website')}
            />
          </label>
        </div>

        <div className="join-form__actions contact-card__footer">
          {step === 2 ? (
            <button className="btn" type="button" onClick={() => moveToStep(1)} disabled={submitting}>
              ← Înapoi
            </button>
          ) : null}
          <Button variant="primary" type="submit" loading={submitting}>
            {step === 1 ? 'Continuă' : 'Trimite cererea'}
          </Button>
          {joinStatus ? (
            <span className="muted contact-card__status" role="status" aria-live="polite">
              {joinStatus}
            </span>
          ) : null}
        </div>
      </form>
    </section>
  )
}
