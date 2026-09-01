import { useEffect, useRef, useState } from 'react'
import { captchaAction, captchaSiteKey, isCaptchaEnabled } from '../captchaConfig'

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      action?: string
      callback?: (token: string) => void
      'expired-callback'?: () => void
      'error-callback'?: () => void
    },
  ) => string
  reset: (widgetId?: string) => void
  remove?: (widgetId?: string) => void
}

function readTurnstile(): TurnstileApi | null {
  return (window as Window & { turnstile?: TurnstileApi }).turnstile ?? null
}

export function TurnstileField({
  onTokenChange,
  resetSignal,
}: {
  onTokenChange: (token: string) => void
  resetSignal: number
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const retryTimerRef = useRef<number | null>(null)
  const lastResetSignalRef = useRef(resetSignal)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isCaptchaEnabled) {
      onTokenChange('')
      return
    }

    let cancelled = false
    let attemptCount = 0

    const renderWidget = () => {
      if (cancelled || widgetIdRef.current || !containerRef.current) {
        return
      }

      const turnstile = readTurnstile()
      if (!turnstile) {
        if (attemptCount >= 50) {
          setLoadError('Verificarea anti-abuz nu a putut fi încărcată.')
          return
        }

        attemptCount += 1
        retryTimerRef.current = window.setTimeout(renderWidget, 100)
        return
      }

      widgetIdRef.current = turnstile.render(containerRef.current, {
        sitekey: captchaSiteKey,
        action: captchaAction,
        callback: (token: string) => {
          setReady(true)
          setLoadError(null)
          onTokenChange(token)
        },
        'expired-callback': () => {
          onTokenChange('')
        },
        'error-callback': () => {
          setLoadError('Verificarea anti-abuz nu a putut fi încărcată.')
          onTokenChange('')
        },
      })
      setReady(true)
      setLoadError(null)
    }

    renderWidget()

    return () => {
      cancelled = true
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current)
      }

      const turnstile = readTurnstile()
      if (widgetIdRef.current && turnstile?.remove) {
        turnstile.remove(widgetIdRef.current)
      }

      widgetIdRef.current = null
      onTokenChange('')
    }
  }, [onTokenChange])

  useEffect(() => {
    if (resetSignal === lastResetSignalRef.current) {
      return
    }

    lastResetSignalRef.current = resetSignal
    onTokenChange('')

    const turnstile = readTurnstile()
    if (widgetIdRef.current && turnstile) {
      turnstile.reset(widgetIdRef.current)
    }
  }, [resetSignal, onTokenChange])

  if (!isCaptchaEnabled) {
    return null
  }

  return (
    <div className="field">
      <span>Verificare anti-abuz</span>
      <div ref={containerRef} />
      {loadError ? (
        <small className="field-error">{loadError}</small>
      ) : (
        <small className="field-hint">
          {ready ? 'Confirmă verificarea înainte de trimitere.' : 'Se încarcă verificarea anti-abuz…'}
        </small>
      )}
    </div>
  )
}
