import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Button, Input, Select } from '@components'
import type { CountyName } from '../api/getCounties'
import { isCaptchaEnabled } from '../captchaConfig'
import { useSubmitJoin } from '../hooks/useSubmitJoin'
import { TurnstileField } from './TurnstileField'

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
  const [joinStatus, setJoinStatus] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0)

  const countyOptions = useMemo(
    () => counties.map((county) => ({ value: county, label: county })),
    [counties],
  )

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!join.agreement) {
      setJoinStatus('Trebuie să accepți prelucrarea datelor (GDPR).')
      return
    }

    if (isCaptchaEnabled && !captchaToken) {
      setJoinStatus('Confirmă verificarea anti-abuz înainte de trimitere.')
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
        captchaToken,
        website: join.website,
      })

      setJoinStatus('Cererea de înscriere a fost trimisă. Mulțumim!')
      setJoin(createInitialJoinFormState())
    } catch (error) {
      setJoinStatus(error instanceof Error ? error.message : 'Eroare la trimitere. Încearcă din nou.')
    } finally {
      setCaptchaResetSignal((current) => current + 1)
    }
  }

  return (
    <section className="card contact-card">
      <div className="stack-12">
        <h2>Înscriere aderent</h2>
        <p className="muted">
          Completează datele pentru a trimite o cerere de înscriere.
        </p>
      </div>

      <form className="form" onSubmit={handleSubmit}>
        <Input
          label="Nume complet"
          value={join.fullName}
          onChange={updateField('fullName')}
          required
          placeholder="Nume Prenume"
        />

        <Input
          label="Email"
          type="email"
          value={join.email}
          onChange={updateField('email')}
          required
          placeholder="email@exemplu.ro"
        />

        <Input
          label="Parolă (pentru cont)"
          type="password"
          value={join.password}
          onChange={updateField('password')}
          required
          placeholder="••••••••"
          hint="Minim 10 caractere, cu literă mare, literă mică, cifră și simbol."
        />

        <Input
          label="Telefon"
          value={join.phone}
          onChange={updateField('phone')}
          placeholder="07xx xxx xxx"
        />

        <Select
          label="Județ"
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
          value={join.locality}
          onChange={updateField('locality')}
          required
          placeholder="Ex: Cluj-Napoca"
        />

        <Input
          label="Competențe (opțional)"
          value={join.skills}
          onChange={updateField('skills')}
          placeholder="Ex: comunicare, organizare, IT…"
        />

        <label className="field">
          <span>Motivație</span>
          <textarea
            value={join.motivation}
            onChange={updateField('motivation')}
            required
            minLength={10}
            maxLength={1500}
            rows={5}
            placeholder="De ce vrei să te implici? (min. 10 caractere)"
          />
        </label>

        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '-9999px',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
          }}
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

        <TurnstileField onTokenChange={setCaptchaToken} resetSignal={captchaResetSignal} />

        <label className="field checkbox">
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

        <div className="row row-start contact-card__footer">
          <Button variant="primary" type="submit" loading={submitting}>
            Trimite cererea
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
