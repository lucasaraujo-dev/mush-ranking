import type {
  MushApiErrorPayload,
  MushGameMode,
  MushPlayerProfile,
  MushPlayerProfileResponse,
  MushXpTable,
  MushXpTableResponse,
} from '../../types/mush'
import { MUSH_API_BASE_URL } from './index'

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

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(`${MUSH_API_BASE_URL}${path}`)

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

export async function getPlayer(nameOrUuid: string): Promise<MushPlayerProfile> {
  const normalizedIdentifier = nameOrUuid.trim()

  if (!normalizedIdentifier) {
    throw new MushApiError('Informe um nick ou UUID valido.', 400)
  }

  const response = await requestJson<MushPlayerProfileResponse>(
    `/player/${encodeURIComponent(normalizedIdentifier)}`,
  )

  return response.response
}

export async function getXpTable(mode: MushGameMode): Promise<MushXpTable> {
  const response = await requestJson<MushXpTableResponse>(`/games/${mode}/xptable`)

  return normalizeXpTable(mode, response)
}
