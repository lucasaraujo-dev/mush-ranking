import type { MushDuelsSubmode, MushGameMode, MushPlayerProfile } from '../types/mush'

const LEGACY_MINECRAFT_COLOR_MAP: Record<string, string> = {
  '0': '#000000',
  '1': '#0000aa',
  '2': '#00aa00',
  '3': '#00aaaa',
  '4': '#aa0000',
  '5': '#aa00aa',
  '6': '#ffaa00',
  '7': '#aaaaaa',
  '8': '#555555',
  '9': '#5555ff',
  a: '#55ff55',
  b: '#55ffff',
  c: '#ff5555',
  d: '#ff55ff',
  e: '#ffff55',
  f: '#ffffff',
}

const MODE_ACCENTS: Record<MushGameMode, string> = {
  bedwars: '#ff8a3d',
  duels: '#74f2ce',
  skywars: '#72b6ff',
}

const DUELS_SUBMODE_ACCENTS: Partial<Record<MushDuelsSubmode, string>> = {
  bed_fight: '#ff9f43',
  bed_rush: '#f87171',
  bridge: '#8b5cf6',
  fireball_fight: '#fb7185',
  pearl_fight: '#67e8f9',
  sumo: '#facc15',
}

function getPlayerSkinIdentifier(player: MushPlayerProfile) {
  return player.skin?.hash || player.account.unique_id
}

function getModeStatsKey(mode: MushGameMode) {
  return mode === 'skywars' ? 'skywars_r1' : mode
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}

function stripLegacyFormatting(value: string) {
  return value.replace(/&./g, '').trim()
}

function humanizeIdentifier(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ')
}

function getLevelBadgeRawValue(
  player: MushPlayerProfile,
  mode: MushGameMode,
  duelsSubmode: MushDuelsSubmode,
) {
  if (mode === 'duels') {
    const duelsStats = player.stats.duels

    if (!duelsStats || typeof duelsStats !== 'object') {
      return null
    }

    return (duelsStats as Record<string, unknown>)[`${duelsSubmode}_level_badge`] ?? null
  }

  const modeStats = player.stats[getModeStatsKey(mode)]

  if (!modeStats || typeof modeStats !== 'object') {
    return null
  }

  return (modeStats as Record<string, unknown>).level_badge ?? null
}

export function getModeAccent(mode: MushGameMode, duelsSubmode: MushDuelsSubmode) {
  if (mode === 'duels') {
    return DUELS_SUBMODE_ACCENTS[duelsSubmode] ?? MODE_ACCENTS.duels
  }

  return MODE_ACCENTS[mode]
}

export function getRgbTriplet(hexColor: string) {
  const sanitizedColor = hexColor.replace('#', '')
  const red = Number.parseInt(sanitizedColor.slice(0, 2), 16)
  const green = Number.parseInt(sanitizedColor.slice(2, 4), 16)
  const blue = Number.parseInt(sanitizedColor.slice(4, 6), 16)

  return `${red}, ${green}, ${blue}`
}

export function getPlayerAccentColor(
  player: MushPlayerProfile,
  fallbackColor: string,
) {
  const bestTagColor = player.best_tag?.color

  return isHexColor(bestTagColor) ? bestTagColor : fallbackColor
}

export function getPlayerMedalMeta(player: MushPlayerProfile) {
  const rawMedal = 'medal' in player && typeof player.medal === 'string' ? player.medal : null

  if (!rawMedal) {
    return null
  }

  return {
    label: humanizeIdentifier(rawMedal),
  }
}

export function getPlayerLevelBadgeMeta(
  player: MushPlayerProfile,
  mode: MushGameMode,
  duelsSubmode: MushDuelsSubmode,
) {
  const rawLevelBadge = getLevelBadgeRawValue(player, mode, duelsSubmode)

  if (!rawLevelBadge || typeof rawLevelBadge !== 'object') {
    return null
  }

  const format =
    'format' in rawLevelBadge && typeof rawLevelBadge.format === 'string'
      ? rawLevelBadge.format
      : null
  const apiHexColor =
    'hex_color' in rawLevelBadge && typeof rawLevelBadge.hex_color === 'string'
      ? rawLevelBadge.hex_color
      : null
  const symbol =
    'symbol' in rawLevelBadge && typeof rawLevelBadge.symbol === 'string'
      ? rawLevelBadge.symbol
      : null
  const minLevel =
    'min_level' in rawLevelBadge && typeof rawLevelBadge.min_level === 'number'
      ? rawLevelBadge.min_level
      : null

  if (!format && !symbol && minLevel === null) {
    return null
  }

  const colorMatch = format?.match(/&([0-9a-f])/i)
  const accentColor =
    apiHexColor && isHexColor(apiHexColor)
      ? apiHexColor
      : colorMatch
        ? LEGACY_MINECRAFT_COLOR_MAP[colorMatch[1].toLowerCase()]
        : null
  const label =
    format && stripLegacyFormatting(format)
      ? stripLegacyFormatting(format)
      : symbol && minLevel !== null
        ? `${minLevel}${symbol}`
        : symbol || (minLevel !== null ? `Level ${minLevel}` : '')

  if (!label) {
    return null
  }

  return {
    color: accentColor,
    label,
  }
}

export function getPlayerHeadUrl(player: MushPlayerProfile, size = 64) {
  const avatarIdentifier = getPlayerSkinIdentifier(player)

  return `https://mc-heads.net/avatar/${avatarIdentifier}/${size}`
}

export function getPlayerBodyUrl(player: MushPlayerProfile) {
  const avatarIdentifier = getPlayerSkinIdentifier(player)

  return `https://mc-heads.net/body/${avatarIdentifier}/right`
}
