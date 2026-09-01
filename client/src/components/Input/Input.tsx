import type { InputHTMLAttributes, ReactNode } from 'react'

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'children'> & {
  label?: string
  hint?: ReactNode
  error?: ReactNode
}

export function Input({
  label,
  hint,
  error,
  id,
  className,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  ...props
}: InputProps) {
  const inputId = id ?? props.name
  const hintId = hint ? `${inputId ?? 'input'}-hint` : undefined
  const errorId = error ? `${inputId ?? 'input'}-error` : undefined

  const describedBy = [ariaDescribedBy, errorId, hintId].filter(Boolean).join(' ') || undefined
  const invalid = ariaInvalid ?? (error ? true : undefined)

  return (
    <label className="field">
      {label ? <span>{label}</span> : null}
      <input
        id={inputId}
        className={className}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        {...props}
      />
      {error ? (
        <small id={errorId} className="field-error">
          {error}
        </small>
      ) : hint ? (
        <small id={hintId} className="field-hint">
          {hint}
        </small>
      ) : null}
    </label>
  )
}
