import type {
  MushDuelsSubmode,
  MushGameMode,
  MushPlayerProfile,
  MushXpTable,
} from '../types/mush'
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

const DEFAULT_DUELS_SUBMODES: MushDuelsSubmode[] = [
  'bed_fight',
  'bed_rush',
  'boxing',
  'bridge',
  'combo',
  'fireball_fight',
  'gladiator',
  'hgsim',
  'pearl_fight',
  'soup',
  'sumo',
  'uhc',
]

const DUELS_MODE_LABELS: Record<string, string> = {
  bed_fight: 'Bed Fight',
  bed_rush: 'Bed Rush',
  boxing: 'Boxing',
  bridge: 'Bridge',
  combo: 'Combo',
  fireball_fight: 'Fireball Fight',
  gladiator: 'Gladiator',
  hgsim: 'HG Sim',
  pearl_fight: 'Pearl Fight',
  soup: 'Soup',
  sumo: 'Sumo',
  uhc: 'UHC',
}

const DUELS_FIXED_XP_PER_WIN: Partial<Record<MushDuelsSubmode, number>> = {
  fireball_fight: 4,
  pearl_fight: 2.5,
  sumo: 1,
}

const MODE_FIXED_XP_PER_WIN: Partial<Record<MushGameMode, number>> = {
  bedwars: 250,
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
  const customLabel = DUELS_MODE_LABELS[modePrefix]

  if (customLabel) {
    return customLabel
  }

  return modePrefix
    .split('_')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ')
}

function parseLevelFromBadge(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null
  }

  const format = 'format' in value && typeof value.format === 'string' ? value.format : null

  if (!format) {
    return null
  }

  const sanitizedFormat = format.replace(/&./g, '')
  const levelMatch = sanitizedFormat.match(/\[(\d+)/)

  if (!levelMatch) {
    return null
  }

  const parsedLevel = Number(levelMatch[1])

  return Number.isInteger(parsedLevel) ? parsedLevel : null
}

function getDuelsLevel(modeStats: Record<string, unknown>, duelsSubmode: MushDuelsSubmode) {
  const directLevel = asNumber(modeStats[`${duelsSubmode}_level`])

  if (directLevel !== null) {
    return directLevel
  }

  return parseLevelFromBadge(modeStats[`${duelsSubmode}_level_badge`])
}

function getDuelsAutofillSnapshot(
  player: MushPlayerProfile,
  duelsSubmode: MushDuelsSubmode,
): AutofillXpSnapshot | null {
  const duelsStats = getModeStats(player, 'duels')

  if (!duelsStats) {
    return null
  }

  const currentLevel = getDuelsLevel(duelsStats, duelsSubmode)
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

export function getAvailableDuelsSubmodes(
  player: MushPlayerProfile | null,
): Array<{ label: string; value: MushDuelsSubmode }> {
  const duelsStats = player ? getModeStats(player, 'duels') : null
  const discoveredModes = duelsStats
    ? Object.keys(duelsStats)
        .filter((key) => key.endsWith('_xp'))
        .map((key) => key.slice(0, -3))
        .filter((mode) => mode !== 'free')
    : []

  const modes = Array.from(new Set([...DEFAULT_DUELS_SUBMODES, ...discoveredModes]))

  return modes.map((mode) => ({
    label: humanizeDuelsModeLabel(mode),
    value: mode,
  }))
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

export function getAverageXpPerMatchSnapshot(
  _player: MushPlayerProfile,
  mode: MushGameMode,
  duelsSubmode: MushDuelsSubmode,
) {
  if (mode === 'duels') {
    const fixedXpPerWin = DUELS_FIXED_XP_PER_WIN[duelsSubmode]

    return fixedXpPerWin === undefined
      ? null
      : {
          sourceLabel: `Duels - ${humanizeDuelsModeLabel(duelsSubmode)}`,
          value: fixedXpPerWin,
        }
  }

  const fixedXpPerWin = MODE_FIXED_XP_PER_WIN[mode]

  return fixedXpPerWin === undefined
    ? null
    : {
        sourceLabel: mode === 'skywars' ? 'Skywars' : 'Bedwars',
        value: fixedXpPerWin,
      }
}

export function normalizeAutofillXpSnapshot(
  snapshot: AutofillXpSnapshot,
  xpTable: MushXpTable,
): AutofillXpSnapshot {
  const currentLevelFloor = xpTable.levels[snapshot.currentLevel] ?? 0
  const nextLevelFloor = xpTable.levels[snapshot.currentLevel + 1] ?? currentLevelFloor
  const levelRequirement = Math.max(nextLevelFloor - currentLevelFloor, 0)

  if (snapshot.currentXp <= levelRequirement) {
    return snapshot
  }

  if (snapshot.currentXp < currentLevelFloor) {
    return snapshot
  }

  return {
    ...snapshot,
    currentXp: Math.min(Math.max(snapshot.currentXp - currentLevelFloor, 0), levelRequirement),
  }
}
