import { useState } from 'react'
import type { XpCalculatorFormValues } from '../types/xp'

const initialFormValues: XpCalculatorFormValues = {
  averageXpPerMatch: '450',
  currentLevel: '1',
  currentXp: '0',
  mode: 'bedwars',
  nickname: '',
  targetLevel: '2',
}

export function useXpCalculatorForm() {
  const [formValues, setFormValues] = useState(initialFormValues)

  function updateField<FieldName extends keyof XpCalculatorFormValues>(
    field: FieldName,
    value: XpCalculatorFormValues[FieldName],
  ) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }))
  }

  function patchFormValues(values: Partial<XpCalculatorFormValues>) {
    setFormValues((currentValues) => ({
      ...currentValues,
      ...values,
    }))
  }

  return {
    formValues,
    patchFormValues,
    updateField,
  }
}
