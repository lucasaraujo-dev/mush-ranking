export type MushGameMode = 'bedwars' | 'skywars' | 'duels'

export interface MushApiErrorPayload {
  success: false
  error_code: number
  response: {
    status: number
    message: string
    details: Record<string, unknown>
  }
}

export interface MushPlayerProfileResponse {
  success: true
  error_code: number
  response: MushPlayerProfile
}

export interface MushPlayerProfile {
  account: {
    profile_id: number
    type: string
    unique_id: string
    username: string
  }
  connected: boolean
  first_login?: number
  stats: Record<string, Record<string, number | string | boolean | object>>
  [key: string]: unknown
}

export type MushXpTableResponse = Record<string, number>

export interface MushXpTable {
  mode: MushGameMode
  levels: number[]
}
