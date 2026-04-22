import type { PropsWithChildren } from 'react'

type FieldGroupProps = PropsWithChildren<{
  htmlFor: string
  hint?: string
  label: string
}>

export function FieldGroup({ children, hint, htmlFor, label }: FieldGroupProps) {
  return (
    <label className="field-group" htmlFor={htmlFor}>
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}
