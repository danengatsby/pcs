import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

type ButtonVariant = 'primary' | 'default'

export type ButtonProps = PropsWithChildren<
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> & {
    variant?: ButtonVariant
    loading?: boolean
    disabled?: boolean
  }
>

export function Button({
  variant = 'default',
  loading,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = Boolean(disabled || loading)

  const classes = ['btn', variant === 'primary' ? 'primary' : '', className ?? '']
    .filter(Boolean)
    .join(' ')

  return (
    <button {...props} disabled={isDisabled} className={classes} aria-busy={loading ? true : undefined}>
      {loading ? 'Se încarcă…' : children}
    </button>
  )
}
