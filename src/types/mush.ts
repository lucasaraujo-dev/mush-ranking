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
