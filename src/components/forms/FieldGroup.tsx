import type { PropsWithChildren } from 'react'

type FieldGroupProps = PropsWithChildren<{
  htmlFor: string
  hint?: string
  invalid?: boolean
  label: string
  message?: string
}>

export function FieldGroup({
  children,
  hint,
  htmlFor,
  invalid = false,
  label,
  message,
}: FieldGroupProps) {
  return (
    <label className={invalid ? 'field-group field-group-invalid' : 'field-group'} htmlFor={htmlFor}>
      <span className="field-label">{label}</span>
      {children}
      {message ? <span className="field-error">{message}</span> : null}
      {!message && hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}
