import type { MushXpTable } from '../types/mush'

function assertValidLevel(table: MushXpTable, level: number) {
  const maximumLevel = table.levels.length - 1

  if (!Number.isInteger(level) || level < 0 || level > maximumLevel) {
    throw new RangeError(`Level invalido. Use um valor entre 0 e ${maximumLevel}.`)
  }
}

function getLevelFloorXp(table: MushXpTable, level: number) {
  assertValidLevel(table, level)
  return table.levels[level] ?? 0
}

function getLevelCapXp(table: MushXpTable, level: number) {
  assertValidLevel(table, level)

  if (level === table.levels.length - 1) {
    return table.levels[level] ?? 0
  }

  return table.levels[level + 1] ?? 0
}

export function xpRequiredForLevel(table: MushXpTable, level: number) {
  return getLevelCapXp(table, level) - getLevelFloorXp(table, level)
}

function assertValidCurrentXp(table: MushXpTable, currentLevel: number, currentXp: number) {
  const requiredXpForLevel = xpRequiredForLevel(table, currentLevel)

  if (!Number.isFinite(currentXp) || currentXp < 0 || currentXp > requiredXpForLevel) {
    throw new RangeError(
      `XP atual invalido. Use um valor entre 0 e ${requiredXpForLevel} para o level ${currentLevel}.`,
    )
  }
}

export function xpToNextLevel(
  table: MushXpTable,
  currentLevel: number,
  currentXp: number,
): number {
  assertValidLevel(table, currentLevel)
  assertValidCurrentXp(table, currentLevel, currentXp)

  return Math.max(xpRequiredForLevel(table, currentLevel) - currentXp, 0)
}

export function xpToTargetLevel(
  table: MushXpTable,
  currentLevel: number,
  currentXp: number,
  targetLevel: number,
): number {
  assertValidLevel(table, currentLevel)
  assertValidLevel(table, targetLevel)
  assertValidCurrentXp(table, currentLevel, currentXp)

  if (targetLevel < currentLevel) {
    throw new RangeError('O level alvo nao pode ser menor que o level atual.')
  }

  if (targetLevel === currentLevel) {
    return 0
  }

  const currentTotalXp = getLevelFloorXp(table, currentLevel) + currentXp
  const targetTotalXp = getLevelFloorXp(table, targetLevel)

  return Math.max(targetTotalXp - currentTotalXp, 0)
}

export function estimateMatches(totalRemainingXp: number, averageXpPerMatch: number): number {
  if (!Number.isFinite(totalRemainingXp) || totalRemainingXp < 0) {
    throw new RangeError('O XP restante deve ser um numero maior ou igual a zero.')
  }

  if (!Number.isFinite(averageXpPerMatch) || averageXpPerMatch <= 0) {
    throw new RangeError('A XP media por partida deve ser maior que zero.')
  }

  if (totalRemainingXp === 0) {
    return 0
  }

  return Math.ceil(totalRemainingXp / averageXpPerMatch)
}

export function calculateProgressPercent(
  table: MushXpTable,
  currentLevel: number,
  currentXp: number,
): number {
  assertValidLevel(table, currentLevel)
  assertValidCurrentXp(table, currentLevel, currentXp)

  const requiredXpForLevel = xpRequiredForLevel(table, currentLevel)

  if (requiredXpForLevel === 0) {
    return 100
  }

  return Math.min((currentXp / requiredXpForLevel) * 100, 100)
}
