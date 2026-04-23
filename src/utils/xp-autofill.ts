import type { MushGameMode, MushPlayerProfile } from '../types/mush'
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

function getDuelsAutofillSnapshot(player: MushPlayerProfile): AutofillXpSnapshot | null {
  const duelsStats = getModeStats(player, 'duels')

  if (!duelsStats) {
    return null
  }

  const duelCandidates = new Map<
    string,
    {
      currentLevel: number
      currentXp: number
    }
  >()

  for (const [statKey, rawValue] of Object.entries(duelsStats)) {
    if (statKey.endsWith('_level')) {
      const prefix = statKey.slice(0, -'_level'.length)
      const currentLevel = asNumber(rawValue)

      if (currentLevel !== null) {
        const currentValue = duelCandidates.get(prefix)
        duelCandidates.set(prefix, {
          currentLevel,
          currentXp: currentValue?.currentXp ?? 0,
        })
      }
    }

    if (statKey.endsWith('_xp')) {
      const prefix = statKey.slice(0, -'_xp'.length)
      const currentXp = asNumber(rawValue)

      if (currentXp !== null) {
        const currentValue = duelCandidates.get(prefix)
        duelCandidates.set(prefix, {
          currentLevel: currentValue?.currentLevel ?? 0,
          currentXp,
        })
      }
    }
  }

  const bestCandidate = [...duelCandidates.entries()]
    .filter(([, value]) => value.currentLevel > 0 || value.currentXp > 0)
    .sort((left, right) => {
      if (right[1].currentLevel !== left[1].currentLevel) {
        return right[1].currentLevel - left[1].currentLevel
      }

      return right[1].currentXp - left[1].currentXp
    })[0]

  if (!bestCandidate) {
    return null
  }

  return {
    currentLevel: bestCandidate[1].currentLevel,
    currentXp: bestCandidate[1].currentXp,
    sourceLabel: `Duels - ${humanizeDuelsModeLabel(bestCandidate[0])}`,
  }
}

export function getAutofillXpSnapshot(
  player: MushPlayerProfile,
  mode: MushGameMode,
): AutofillXpSnapshot | null {
  if (mode === 'bedwars') {
    return getDirectAutofillSnapshot(player, 'bedwars', 'Bedwars')
  }

  if (mode === 'skywars') {
    return getDirectAutofillSnapshot(player, 'skywars_r1', 'Skywars')
  }

  return getDuelsAutofillSnapshot(player)
}
