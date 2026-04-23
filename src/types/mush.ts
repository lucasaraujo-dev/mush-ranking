export type MushGameMode = 'bedwars' | 'skywars' | 'duels'
export type MushLeaderboardMode =
  | 'bedwars'
  | 'bridge'
  | 'ctf'
  | 'gladiator'
  | 'hg'
  | 'minimush'
  | 'murder'
  | 'party'
  | 'pvp'
  | 'quickbuilders'
  | 'skywars'
  | 'soup'
export type MushDuelsSubmode = string

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

export interface MushAccountIdentity {
  profile_id: number
  type: string
  unique_id: string
  username: string
}

export interface MushPlayerProfile {
  account: MushAccountIdentity
  best_tag?: {
    color: string
    name: string
  }
  connected: boolean
  first_login?: number
  skin?: {
    hash: string
    slim: boolean
  }
  stats: Record<string, Record<string, number | string | boolean | object>>
  [key: string]: unknown
}

export type MushXpTableResponse = Record<string, number>

export interface MushXpTable {
  mode: MushGameMode
  levels: number[]
}

export interface MushLeaderboardRecordResponse {
  account: MushAccountIdentity
  avatar_url: string
  color: string
  pos: number
  [key: string]: unknown
}

export interface MushLeaderboardResponse {
  records: MushLeaderboardRecordResponse[]
}

export interface MushLeaderboardMetric {
  key: string
  label: string
}

export interface MushLeaderboardRecord {
  account: MushAccountIdentity
  avatarUrl: string
  color: string
  position: number
  stats: Record<string, number | string>
}

export interface MushLeaderboard {
  metrics: MushLeaderboardMetric[]
  mode: MushLeaderboardMode
  records: MushLeaderboardRecord[]
}
