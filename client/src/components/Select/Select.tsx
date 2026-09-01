import type { SelectHTMLAttributes } from 'react'

export type SelectOption = {
  value: string
  label: string
}

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  label: string
  options: SelectOption[]
  placeholder?: string
  hint?: string
}

export function Select({ label, options, placeholder, hint, id, ...props }: SelectProps) {
  const selectId = id ?? `select-${label.toLowerCase().replace(/\s+/g, '-')}`

  return (
    <label className="field">
      <span className="label">{label}</span>
      <select id={selectId} {...props}>
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint ? <span className="hint">{hint}</span> : null}
    </label>
  )
}
