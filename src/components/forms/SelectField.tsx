interface SelectFieldOption {
  label: string
  value: string
}

interface SelectFieldProps {
  id: string
  name: string
  onChange: (value: string) => void
  options: SelectFieldOption[]
  value: string
}

export function SelectField({ id, name, onChange, options, value }: SelectFieldProps) {
  return (
    <select
      className="field-input"
      id={id}
      name={name}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
