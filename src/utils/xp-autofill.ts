import type { MushDuelsSubmode, MushGameMode, MushPlayerProfile } from '../types/mush'
import type { AutofillXpSnapshot } from '../types/xp'

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getModeStats(player: MushPlayerProfile, key: string) {
  const stats = player.stats[key]

  if (!stats || typeof stats !== 'object') {
    return null
  }

  return stats as Record<string, unknown>
}

function getDirectAutofillSnapshot(
  player: MushPlayerProfile,
  statsKey: string,
  sourceLabel: string,
): AutofillXpSnapshot | null {
  const modeStats = getModeStats(player, statsKey)

  if (!modeStats) {
    return null
  }

  const currentLevel = asNumber(modeStats.level)
  const currentXp = asNumber(modeStats.xp)

  if (currentLevel === null || currentXp === null) {
    return null
  }

  return {
    currentLevel,
    currentXp,
    sourceLabel,
  }
}

function humanizeDuelsModeLabel(modePrefix: string) {
  return modePrefix
    .split('_')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ')
}

function getDuelsAutofillSnapshot(
  player: MushPlayerProfile,
  duelsSubmode: MushDuelsSubmode,
): AutofillXpSnapshot | null {
  const duelsStats = getModeStats(player, 'duels')

  if (!duelsStats) {
    return null
  }

  const currentLevel = asNumber(duelsStats[`${duelsSubmode}_level`])
  const currentXp = asNumber(duelsStats[`${duelsSubmode}_xp`])

  if (currentLevel === null || currentXp === null) {
    return null
  }

  return {
    currentLevel,
    currentXp,
    sourceLabel: `Duels - ${humanizeDuelsModeLabel(duelsSubmode)}`,
  }
}

export function getAutofillXpSnapshot(
  player: MushPlayerProfile,
  mode: MushGameMode,
  duelsSubmode: MushDuelsSubmode,
): AutofillXpSnapshot | null {
  if (mode === 'bedwars') {
    return getDirectAutofillSnapshot(player, 'bedwars', 'Bedwars')
  }

  if (mode === 'skywars') {
    return getDirectAutofillSnapshot(player, 'skywars_r1', 'Skywars')
  }

  return getDuelsAutofillSnapshot(player, duelsSubmode)
}
