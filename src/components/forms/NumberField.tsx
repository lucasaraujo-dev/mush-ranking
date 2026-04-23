interface NumberFieldProps {
  id: string
  invalid?: boolean
  min?: number
  name: string
  onChange: (value: string) => void
  placeholder: string
  readOnly?: boolean
  step?: number
  value: string
}

export function NumberField({
  id,
  invalid = false,
  min,
  name,
  onChange,
  placeholder,
  readOnly = false,
  step = 1,
  value,
}: NumberFieldProps) {
  return (
    <input
      aria-invalid={invalid}
      className="field-input"
      id={id}
      inputMode="decimal"
      min={min}
      name={name}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      step={step}
      type="number"
      value={value}
    />
  )
}
