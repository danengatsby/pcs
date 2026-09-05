import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Button, Input, Select } from '@components'
import { useCounties } from '@features/contact/hooks/useCounties'
import {
  mobilizationActionTypeConfig,
  mobilizationAvailabilityOptions,
  mobilizationInterests,
} from '../config'
import { useSubmitMobilizationResponse } from '../hooks/useSubmitMobilizationResponse'
import { MobilizationActionFullError } from '../api/submitMobilizationResponse'
import type {
  MobilizationAction,
  MobilizationAvailability,
  MobilizationInterest,
} from '../types'

type FormState = {
  fullName: string
  email: string
  phone: string
  county: string
  locality: string
  interests: MobilizationInterest[]
  availability: MobilizationAvailability
  message: string
  emailConsent: boolean
  smsConsent: boolean
  whatsappConsent: boolean
  privacyConsent: boolean
  website: string
}

const initialState: FormState = {
  fullName: '',
  email: '',
  phone: '',
  county: '',
  locality: '',
  interests: [],
  availability: '',
  message: '',
  emailConsent: false,
  smsConsent: false,
  whatsappConsent: false,
  privacyConsent: false,
  website: '',
}

type MobilizationResponseFormProps = {
  action: MobilizationAction
  onClose: () => void
}

export function MobilizationResponseForm({ action, onClose }: MobilizationResponseFormProps) {
  const { counties, loading: countiesLoading, error: countiesError } = useCounties()
  const { submit, submitting, reset } = useSubmitMobilizationResponse()
  const [form, setForm] = useState<FormState>(initialState)
  const [status, setStatus] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [capacityExhausted, setCapacityExhausted] = useState(false)
  const waitlistMode = action.availableSpots === 0 || capacityExhausted
  const config = mobilizationActionTypeConfig[action.type]

  const updateField = (key: keyof Omit<FormState, 'interests' | 'emailConsent' | 'smsConsent' | 'whatsappConsent' | 'privacyConsent'>) => (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((current) => ({ ...current, [key]: event.target.value }))

  function toggleInterest(interest: MobilizationInterest) {
    setForm((current) => ({
      ...current,
      interests: current.interests.includes(interest)
        ? current.interests.filter((item) => item !== interest)
        : [...current.interests, interest],
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (form.interests.length === 0) {
      setStatus('Alege cel puțin un domeniu de interes pentru direcționarea răspunsului.')
      return
    }
    if (!form.privacyConsent) {
      setStatus('Acordul privind prelucrarea datelor este obligatoriu.')
      return
    }

    setStatus(null)
    reset()
    try {
      const response = await submit({
        slug: action.slug,
        payload: {
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          county: form.county,
          locality: form.locality,
          interests: form.interests,
          availability: form.availability,
          message: form.message,
          joinWaitlist: waitlistMode,
          updatesConsent: form.emailConsent || form.smsConsent || form.whatsappConsent,
          emailConsent: form.emailConsent,
          smsConsent: form.smsConsent,
          whatsappConsent: form.whatsappConsent,
          consentVersion: 'mobilizare-v2',
          privacyConsent: true,
          website: form.website,
        },
      })
      setSubmitted(true)
      setStatus(response.registrationStatus === 'waitlisted'
        ? 'Ești pe lista de așteptare. Înscrierea nu confirmă un loc; organizatorii te vor contacta dacă devine disponibil.'
        : 'Răspunsul tău a fost înregistrat. Vei primi detaliile următoare prin canalul indicat.')
    } catch (error) {
      if (error instanceof MobilizationActionFullError) setCapacityExhausted(true)
      setStatus(error instanceof Error ? error.message : 'Răspunsul nu a putut fi trimis.')
    }
  }

  if (submitted) {
    return (
      <section className="mobilization-form mobilization-form--success" id="participa" aria-live="polite">
        <div className="hero-kicker">Răspuns înregistrat</div>
        <h2>Mulțumim pentru implicare.</h2>
        <p>{status}</p>
        <button className="btn" type="button" onClick={onClose}>Vezi celelalte acțiuni</button>
      </section>
    )
  }

  return (
    <section className="mobilization-form" id="participa" aria-labelledby="mobilization-form-title">
      <div className="mobilization-form__intro">
        <div>
          <div className="hero-kicker">{config.shortLabel} selectat</div>
          <h2 id="mobilization-form-title">{action.title}</h2>
          <p>{action.description}</p>
        </div>
        <button className="text-link" type="button" onClick={onClose}>Schimbă acțiunea</button>
      </div>

      <div className="mobilization-form__commitment">
        <strong>Ce se întâmplă după trimitere</strong>
        <span>{waitlistMode
          ? 'Locuri epuizate. Poți solicita înscrierea pe lista de așteptare. Dacă un loc devine disponibil înainte de trimitere, înscrierea va fi confirmată direct.'
          : action.commitment}</span>
      </div>

      <form className="form mobilization-form__fields" onSubmit={handleSubmit}>
        <div className="mobilization-form__grid">
          <Input label="Nume complet" value={form.fullName} onChange={updateField('fullName')} required minLength={2} />
          <Input label="Email" type="email" value={form.email} onChange={updateField('email')} required />
          <Input label="Telefon (opțional)" value={form.phone} onChange={updateField('phone')} maxLength={40} />
          <Select
            label="Județ"
            value={form.county}
            onChange={updateField('county')}
            required
            disabled={countiesLoading || Boolean(countiesError)}
            placeholder={countiesLoading ? 'Se încarcă județele…' : 'Alege județul'}
            options={counties.map((county) => ({ value: county, label: county }))}
            hint={countiesError ?? 'Răspunsul ajunge la echipa teritorială relevantă.'}
          />
          <Input label="Localitate (opțional)" value={form.locality} onChange={updateField('locality')} maxLength={120} />
          <Select
            label="Disponibilitate (opțional)"
            value={form.availability}
            onChange={updateField('availability')}
            placeholder="Alege intervalul potrivit"
            options={mobilizationAvailabilityOptions}
          />
        </div>

        <fieldset className="mobilization-form__interests">
          <legend>Domenii de interes — alege cel puțin unul</legend>
          <p>Folosim aceste opțiuni pentru direcționarea contribuției și, numai cu acordul tău, pentru actualizări relevante.</p>
          <div>
            {mobilizationInterests.map((interest) => (
              <label key={interest.value}>
                <input
                  type="checkbox"
                  checked={form.interests.includes(interest.value)}
                  onChange={() => toggleInterest(interest.value)}
                />
                <span>{interest.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span>Mesaj sau contribuție (opțional)</span>
          <textarea
            value={form.message}
            onChange={updateField('message')}
            rows={5}
            maxLength={1200}
            placeholder="Adaugă detalii utile pentru organizatori…"
          />
        </label>

        <div className="mobilization-form__consents">
          <label className="field checkbox">
            <input
              type="checkbox"
              checked={form.emailConsent}
              onChange={(event) => setForm((current) => ({ ...current, emailConsent: event.target.checked }))}
            />
            <span>
              Vreau actualizări prin email despre acest domeniu și despre acțiunile din județul meu.
            </span>
          </label>
          <label className="field checkbox">
            <input
              type="checkbox"
              checked={form.smsConsent}
              onChange={(event) => setForm((current) => ({ ...current, smsConsent: event.target.checked }))}
            />
            <span>Primesc actualizări prin SMS. Numărul de telefon devine obligatoriu.</span>
          </label>
          <label className="field checkbox">
            <input
              type="checkbox"
              checked={form.whatsappConsent}
              onChange={(event) => setForm((current) => ({ ...current, whatsappConsent: event.target.checked }))}
            />
            <span>Primesc actualizări prin WhatsApp. Pot retrage separat fiecare acord din portal.</span>
          </label>
          <label className="field checkbox">
            <input
              type="checkbox"
              required
              checked={form.privacyConsent}
              onChange={(event) => setForm((current) => ({ ...current, privacyConsent: event.target.checked }))}
            />
            <span>
              Sunt de acord cu prelucrarea datelor pentru gestionarea acestui răspuns, conform{' '}
              <a className="text-link" href="/documente/regulament-gdpr" target="_blank" rel="noreferrer">regulamentului GDPR</a>.
            </span>
          </label>
        </div>

        <div className="mobilization-form__honeypot" aria-hidden="true">
          <label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={updateField('website')} /></label>
        </div>

        <div className="mobilization-form__submit">
          <Button type="submit" variant="primary" loading={submitting}>
            {waitlistMode ? 'Înscrie-mă pe lista de așteptare' : config.cta}
          </Button>
          {status ? <p role="status" aria-live="polite">{status}</p> : null}
        </div>
      </form>
    </section>
  )
}
