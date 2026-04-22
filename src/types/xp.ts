import type { MushGameMode } from './mush'

export interface XpSimulationInput {
  mode: MushGameMode
  currentLevel: number
  currentXp: number
  targetLevel: number
  averageXpPerMatch: number
}

export interface XpCalculatorFormValues {
  averageXpPerMatch: string
  currentLevel: string
  currentXp: string
  mode: MushGameMode
  nickname: string
  targetLevel: string
}
