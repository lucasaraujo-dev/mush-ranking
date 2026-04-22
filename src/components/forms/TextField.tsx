interface TextFieldProps {
  id: string
  name: string
  onChange: (value: string) => void
  placeholder: string
  value: string
}

export function TextField({ id, name, onChange, placeholder, value }: TextFieldProps) {
  return (
    <input
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
