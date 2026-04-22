import type { MushGameMode } from './mush'

export interface XpSimulationInput {
  mode: MushGameMode
  currentLevel: number
  currentXp: number
  targetLevel: number
  averageXpPerMatch: number
}
