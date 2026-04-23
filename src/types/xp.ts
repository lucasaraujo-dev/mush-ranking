import type { MushDuelsSubmode, MushGameMode } from './mush'

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
  duelsSubmode: MushDuelsSubmode
  mode: MushGameMode
  nickname: string
  targetLevel: string
}

export interface AutofillXpSnapshot {
  currentLevel: number
  currentXp: number
  sourceLabel: string
}
