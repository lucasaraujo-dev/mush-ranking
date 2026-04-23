import { clearCachedValue, getOrCreateCachedValue } from '../../cache/index.ts'
import type {
  MushApiErrorPayload,
  MushGameMode,
  MushLeaderboard,
  MushLeaderboardMode,
  MushLeaderboardRecordResponse,
  MushLeaderboardResponse,
  MushPlayerProfile,
  MushPlayerProfileResponse,
  MushXpTable,
  MushXpTableResponse,
} from '../../types/mush'
import { MUSH_API_BASE_URL } from './constants.ts'

const LEADERBOARD_CACHE_TTL_MS = 5 * 60 * 1000
const XP_TABLE_CACHE_TTL_MS = 60 * 60 * 1000
const LEADERBOARD_RESERVED_KEYS = new Set(['account', 'avatar_url', 'color', 'pos'])
const LEADERBOARD_TOKEN_LABELS: Record<string, string> = {
  ctf: 'CTF',
  fkdr: 'FKDR',
  hg: 'HG',
  kd: 'K/D',
  pvp: 'PVP',
  uhc: 'UHC',
  xp: 'XP',
}

export class MushApiError extends Error {
  public readonly details?: Record<string, unknown>
  public readonly status: number

  constructor(
    message: string,
    status: number,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'MushApiError'
    this.status = status
    this.details = details
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${MUSH_API_BASE_URL}${path}`, init)

  const payload = (await response.json()) as T | MushApiErrorPayload

  if (!response.ok) {
    const errorPayload = payload as Partial<MushApiErrorPayload>
    throw new MushApiError(
      errorPayload.response?.message ?? 'Falha ao consultar a API do Mush.',
      response.status,
      errorPayload.response?.details,
    )
  }

  if (
    typeof payload === 'object' &&
    payload !== null &&
    'success' in payload &&
    payload.success === false
  ) {
    const errorPayload = payload as MushApiErrorPayload
    throw new MushApiError(
      errorPayload.response.message,
      errorPayload.response.status,
      errorPayload.response.details,
    )
  }

  return payload as T
}

function normalizeXpTable(mode: MushGameMode, response: MushXpTableResponse): MushXpTable {
  const levels = Object.entries(response)
    .map(([level, totalXp]) => [Number(level), totalXp] as const)
    .sort((left, right) => left[0] - right[0])
    .map(([, totalXp]) => totalXp)

  return {
    mode,
    levels,
  }
}

function formatLeaderboardMetricLabel(key: string) {
  const rawMetricKey = key.includes(':') ? key.split(':').at(-1) ?? key : key

  return rawMetricKey
    .split('_')
    .filter(Boolean)
    .map((token) => {
      const normalizedToken = token.toLowerCase()
      const aliasedToken = LEADERBOARD_TOKEN_LABELS[normalizedToken]

      if (aliasedToken) {
        return aliasedToken
      }

      if (/^\d+$/.test(token)) {
        return token
      }

      if (token.length <= 3) {
        return token.toUpperCase()
      }

      return token.charAt(0).toUpperCase() + token.slice(1)
    })
    .join(' ')
}

function normalizeLeaderboard(
  mode: MushLeaderboardMode,
  response: MushLeaderboardResponse,
): MushLeaderboard {
  const metricKeys = response.records.flatMap((record) =>
    Object.keys(record).filter((key) => !LEADERBOARD_RESERVED_KEYS.has(key)),
  )
  const uniqueMetricKeys = Array.from(new Set(metricKeys))

  return {
    metrics: uniqueMetricKeys.map((key) => ({
      key,
      label: formatLeaderboardMetricLabel(key),
    })),
    mode,
    records: response.records.map((record: MushLeaderboardRecordResponse) => {
      const stats: Record<string, number | string> = {}

      uniqueMetricKeys.forEach((metricKey) => {
        const value = record[metricKey]

        if (typeof value === 'number' || typeof value === 'string') {
          stats[metricKey] = value
        }
      })

      return {
        account: record.account,
        avatarUrl: record.avatar_url,
        color: record.color,
        position: record.pos,
        stats,
      }
    }),
  }
}

async function getFreshPlayer(path: string): Promise<MushPlayerProfile> {
  const separator = path.includes('?') ? '&' : '?'
  const cacheBustedPath = `${path}${separator}_=${Date.now()}`
  const response = await requestJson<MushPlayerProfileResponse>(cacheBustedPath, {
    cache: 'no-store',
  })

  return response.response
}

export async function getPlayer(nameOrUuid: string): Promise<MushPlayerProfile> {
  const normalizedIdentifier = nameOrUuid.trim()

  if (!normalizedIdentifier) {
    throw new MushApiError('Informe um nick ou UUID valido.', 400)
  }

  return getFreshPlayer(`/player/${encodeURIComponent(normalizedIdentifier)}`)
}

export function invalidatePlayerCache(nameOrUuid: string) {
  const normalizedIdentifier = nameOrUuid.trim()

  if (!normalizedIdentifier) {
    return
  }

  clearCachedValue(`player:${normalizedIdentifier.toLowerCase()}`)
}

export async function getPlayerByProfileId(profileId: number): Promise<MushPlayerProfile> {
  if (!Number.isInteger(profileId) || profileId <= 0) {
    throw new MushApiError('Informe um profile_id valido.', 400)
  }

  return getFreshPlayer(`/player/profileid/${profileId}`)
}

export async function getXpTable(mode: MushGameMode): Promise<MushXpTable> {
  const cacheKey = `xptable:${mode}`

  return getOrCreateCachedValue(cacheKey, XP_TABLE_CACHE_TTL_MS, async () => {
    const response = await requestJson<MushXpTableResponse>(`/games/${mode}/xptable`)

    return normalizeXpTable(mode, response)
  })
}

export async function getLeaderboard(mode: MushLeaderboardMode): Promise<MushLeaderboard> {
  const cacheKey = `leaderboard:${mode}`

  return getOrCreateCachedValue(cacheKey, LEADERBOARD_CACHE_TTL_MS, async () => {
    const response = await requestJson<MushLeaderboardResponse>(`/leaderboard/${mode}`)

    return normalizeLeaderboard(mode, response)
  })
}
