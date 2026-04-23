import type { MushXpTable } from '../types/mush'
import type { XpCalculatorFormValues } from '../types/xp'

export interface ValidatedXpCalculatorValues {
  averageXpPerMatch: number
  currentLevel: number
  currentXp: number
  targetLevel: number
}

export interface XpCalculatorValidationResult {
  fieldErrors: Partial<Record<keyof XpCalculatorFormValues, string>>
  parsedValues: ValidatedXpCalculatorValues | null
  summary: string | null
}

function parseIntegerField(value: string) {
  if (value.trim() === '') {
    return null
  }

  const parsedValue = Number(value)

  if (!Number.isInteger(parsedValue)) {
    return null
  }

  return parsedValue
}

function parseNumberField(value: string) {
  if (value.trim() === '') {
    return null
  }

  const parsedValue = Number(value)

  if (!Number.isFinite(parsedValue)) {
    return null
  }

  return parsedValue
}

function getLevelRequirement(table: MushXpTable, level: number) {
  const currentLevelFloor = table.levels[level] ?? 0
  const nextLevelFloor = table.levels[level + 1] ?? currentLevelFloor

  return nextLevelFloor - currentLevelFloor
}

export function validateXpCalculatorForm(
  formValues: XpCalculatorFormValues,
  xpTable: MushXpTable | null,
): XpCalculatorValidationResult {
  const fieldErrors: XpCalculatorValidationResult['fieldErrors'] = {}
  const currentLevel = parseIntegerField(formValues.currentLevel)
  const currentXp = parseNumberField(formValues.currentXp)
  const targetLevel = parseIntegerField(formValues.targetLevel)
  const averageXpPerMatch = parseNumberField(formValues.averageXpPerMatch)

  if (formValues.nickname.trim() !== '') {
    const trimmedNickname = formValues.nickname.trim()

    if (trimmedNickname.length < 3 || trimmedNickname.length > 16 || /\s/.test(trimmedNickname)) {
      fieldErrors.nickname = 'Use um nick entre 3 e 16 caracteres, sem espacos.'
    }
  }

  if (currentLevel === null || currentLevel < 0) {
    fieldErrors.currentLevel = 'Informe um level atual inteiro maior ou igual a zero.'
  }

  if (currentXp === null || currentXp < 0) {
    fieldErrors.currentXp = 'Informe uma XP atual maior ou igual a zero.'
  }

  if (targetLevel === null || targetLevel < 0) {
    fieldErrors.targetLevel = 'Informe um level alvo inteiro maior ou igual a zero.'
  }

  if (averageXpPerMatch === null || averageXpPerMatch <= 0) {
    fieldErrors.averageXpPerMatch = 'Informe uma XP por vitoria maior que zero.'
  }

  if (currentLevel !== null && targetLevel !== null && targetLevel < currentLevel) {
    fieldErrors.targetLevel = 'O level alvo nao pode ser menor que o level atual.'
  }

  if (xpTable && currentLevel !== null) {
    const maxLevel = xpTable.levels.length - 1

    if (currentLevel > maxLevel) {
      fieldErrors.currentLevel = `O level atual deve estar entre 0 e ${maxLevel}.`
    }
  }

  if (xpTable && targetLevel !== null) {
    const maxLevel = xpTable.levels.length - 1

    if (targetLevel > maxLevel) {
      fieldErrors.targetLevel = `O level alvo deve estar entre 0 e ${maxLevel}.`
    }
  }

  if (xpTable && currentLevel !== null && currentXp !== null && !fieldErrors.currentLevel) {
    const levelRequirement = getLevelRequirement(xpTable, currentLevel)

    if (currentXp > levelRequirement) {
      fieldErrors.currentXp = `A XP atual excede o limite do level atual (${levelRequirement}).`
    }
  }

  const hasErrors = Object.keys(fieldErrors).length > 0

  return {
    fieldErrors,
    parsedValues:
      hasErrors ||
      currentLevel === null ||
      currentXp === null ||
      targetLevel === null ||
      averageXpPerMatch === null
        ? null
        : {
            averageXpPerMatch,
            currentLevel,
            currentXp,
            targetLevel,
          },
    summary: hasErrors ? 'Corrija os campos destacados para calcular os resultados.' : null,
  }
}
