interface TextFieldProps {
  id: string
  invalid?: boolean
  name: string
  onChange: (value: string) => void
  placeholder: string
  value: string
}

export function TextField({
  id,
  invalid = false,
  name,
  onChange,
  placeholder,
  value,
}: TextFieldProps) {
  return (
    <input
      aria-invalid={invalid}
      autoComplete="off"
      className="field-input"
      id={id}
      name={name}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      type="text"
      value={value}
    />
  )
}
