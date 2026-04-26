import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { PlayerIdentityCard } from '../../../components/feedback/PlayerIdentityCard'
import { ResultCard } from '../../../components/feedback/ResultCard'
import { XpProgressChart } from '../../../components/feedback/XpProgressChart'
import { FieldGroup } from '../../../components/forms/FieldGroup'
import { NumberField } from '../../../components/forms/NumberField'
import { SelectField } from '../../../components/forms/SelectField'
import { TextField } from '../../../components/forms/TextField'
import {
  estimateActionsForXp,
  estimateMatches,
  xpRequiredForLevel,
} from '../../../calculations'
import {
  getPlayer,
  getPlayerByProfileId,
  getXpTable,
  invalidatePlayerCache,
  MushApiError,
} from '../../../services/api'
import { useXpCalculatorForm } from '../../../store/xpCalculatorStore'
import type { MushGameMode, MushPlayerProfile, MushXpTable } from '../../../types/mush'
import {
  getAverageXpPerMatchSnapshot,
  formatNumber,
  formatPercent,
  getAutofillXpSnapshot,
  getAvailableDuelsSubmodes,
  getModeAccent,
  getPlayerAccentColor,
  getPlayerBodyUrl,
  getPlayerHeadUrl,
  getPlayerLevelBadgeMeta,
  getRgbTriplet,
  normalizeAutofillXpSnapshot,
  validateXpCalculatorForm,
} from '../../../utils'

const modeOptions = [
  { label: 'Bedwars', value: 'bedwars' },
  { label: 'Skywars', value: 'skywars' },
  { label: 'Duels', value: 'duels' },
]
const challengeDifficultyOptions = [
  { label: 'Facil', value: 'facil' },
  { label: 'Medio', value: 'medio' },
  { label: 'Dificil', value: 'dificil' },
]
const challengeCadenceOptions = [
  { label: 'Diario', value: 'diario' },
  { label: 'Semanal', value: 'semanal' },
  { label: 'Mensal', value: 'mensal' },
]
const challengeTargetOptions = [
  { label: 'Proximo level', value: 'next-level' },
  { label: 'Level alvo', value: 'target-level' },
]
const CHALLENGE_EXTRA_WINS_BY_CADENCE = {
  diario: 0,
  mensal: 2,
  semanal: 1,
} as const
const CHALLENGE_EXTRA_WINS_BY_DIFFICULTY = {
  dificil: 2,
  facil: 0,
  medio: 1,
} as const
const BEDWARS_BED_BREAK_XP = 100
const BEDWARS_FINAL_KILL_XP = 50
const BEDWARS_KILL_XP = 10
const BEDWARS_BASE_WIN_XP = 250
const BEDWARS_WIN_WITH_BED_BONUS_XP = 50
const BEDWARS_WIN_WITHOUT_DYING_BONUS_XP = 100
const PLAYER_AUTO_REFRESH_INTERVAL_MS = 60_000

const BEDWARS_CHALLENGE_PROFILES = {
  facil: {
    bedBreaksPerWin: 1,
    finalKillsPerWin: 1,
    extraWins: 0,
    killsPerWin: 2,
    winsWithoutDying: false,
    winsWithoutLosingBed: false,
  },
  medio: {
    bedBreaksPerWin: 1,
    extraWins: 1,
    finalKillsPerWin: 2,
    killsPerWin: 3,
    winsWithoutDying: false,
    winsWithoutLosingBed: true,
  },
  dificil: {
    bedBreaksPerWin: 1,
    extraWins: 2,
    finalKillsPerWin: 3,
    killsPerWin: 4,
    winsWithoutDying: true,
    winsWithoutLosingBed: true,
  },
} as const

const PLAYER_PREVIEW_STAT_PRIORITIES: Record<MushGameMode, string[]> = {
  bedwars: ['wins', 'winstreak', 'kills', 'final_kills', 'beds_broken', 'games_played'],
  duels: ['wins', 'winstreak', 'kills', 'deaths', 'beds_broken', 'played', 'points', 'xp'],
  skywars: ['wins', 'winstreak', 'kills', 'deaths', 'souls', 'games_played'],
}
const DUELS_CHALLENGE_EXTRA_ACTIONS: Partial<
  Record<string, Array<{ key: 'beds_broken' | 'kills'; title: string }>>
> = {
  bed_fight: [
    { key: 'kills', title: 'Kills do desafio' },
    { key: 'beds_broken', title: 'Camas do desafio' },
  ],
  bed_rush: [
    { key: 'kills', title: 'Kills do desafio' },
    { key: 'beds_broken', title: 'Camas do desafio' },
  ],
  fireball_fight: [
    { key: 'kills', title: 'Kills do desafio' },
    { key: 'beds_broken', title: 'Camas do desafio' },
  ],
}

function toPreviewLabel(key: string) {
  const aliases: Record<string, string> = {
    beds_broken: 'Camas',
    deaths: 'Mortes',
    final_kills: 'Final kills',
    games_played: 'Partidas',
    kills: 'Kills',
    played: 'Partidas',
    points: 'Pontos',
    souls: 'Souls',
    wins: 'Wins',
    winstreak: 'Winstreak',
    xp: 'XP',
  }

  return aliases[key] ?? key
}

function getScalarModeStats(
  player: MushPlayerProfile | null,
  mode: MushGameMode,
  duelsSubmode: string,
) {
  if (!player) {
    return []
  }

  const statsKey = mode === 'skywars' ? 'skywars_r1' : mode
  const rawModeStats = player.stats[statsKey]

  if (!rawModeStats || typeof rawModeStats !== 'object') {
    return []
  }

  const modeStats = rawModeStats as Record<string, unknown>

  if (mode !== 'duels') {
    return Object.entries(modeStats).filter(([, value]) =>
      typeof value === 'number' || typeof value === 'string',
    )
  }

  const prefixedEntries = Object.entries(modeStats).filter(
    ([key, value]) =>
      key.startsWith(`${duelsSubmode}_`) &&
      (typeof value === 'number' || typeof value === 'string'),
  )

  return prefixedEntries.map(([key, value]) => [
    key.replace(`${duelsSubmode}_`, ''),
    value,
  ] as const)
}

function getPlayerPreviewStats(
  player: MushPlayerProfile | null,
  mode: MushGameMode,
  duelsSubmode: string,
) {
  const scalarStats = getScalarModeStats(player, mode, duelsSubmode)

  if (scalarStats.length === 0) {
    return []
  }

  const scalarStatsMap = new Map(scalarStats)
  const prioritizedStats = PLAYER_PREVIEW_STAT_PRIORITIES[mode]
    .map((key) => {
      const value = scalarStatsMap.get(key)

      if (value === undefined) {
        return null
      }

      return {
        label: toPreviewLabel(key),
        value: typeof value === 'number' ? formatNumber(value) : value,
      }
    })
    .filter((stat): stat is { label: string; value: string } => stat !== null)

  if (prioritizedStats.length >= 4) {
    return prioritizedStats.slice(0, 6)
  }

  const fallbackStats = scalarStats
    .filter(([key]) => !key.includes('badge') && !key.includes('selected_kit'))
    .filter(([key]) => !prioritizedStats.some((stat) => stat.label === toPreviewLabel(key)))
    .slice(0, Math.max(0, 6 - prioritizedStats.length))
    .map(([key, value]) => ({
      label: toPreviewLabel(key),
      value: typeof value === 'number' ? formatNumber(value) : String(value),
    }))

  return [...prioritizedStats, ...fallbackStats]
}

function getScalarModeStatsMap(
  player: MushPlayerProfile | null,
  mode: MushGameMode,
  duelsSubmode: string,
) {
  return new Map<string, number | string>(
    getScalarModeStats(player, mode, duelsSubmode) as Array<[string, number | string]>,
  )
}

function getPerWinActionEstimate(
  statsMap: Map<string, number | string>,
  key: string,
  winsKey = 'wins',
) {
  const rawValue = statsMap.get(key)
  const rawWins = statsMap.get(winsKey)

  if (typeof rawValue !== 'number' || typeof rawWins !== 'number' || rawValue <= 0 || rawWins <= 0) {
    return null
  }

  return rawValue / rawWins
}

function formatXpPerWinValue(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
  }).format(value)
}

function normalizeXpForLevelDisplay(mode: MushGameMode, xpValue: number) {
  if (mode === 'duels') {
    return xpValue / 100
  }

  return xpValue
}

function getDisplayedCurrentXpInLevel(
  mode: MushGameMode,
  currentLevelFloor: number,
  currentXp: number,
  requiredXpForLevel: number,
  winsCount: number | null,
  xpPerWin: number | null,
) {
  const rawDisplayedXp = Math.max(Math.round(normalizeXpForLevelDisplay(mode, currentXp)), 0)
  const displayedLevelCap = Math.max(
    Math.round(normalizeXpForLevelDisplay(mode, requiredXpForLevel)),
    0,
  )

  if (mode === 'duels' && winsCount !== null && xpPerWin !== null) {
    const totalVisibleXp = winsCount * xpPerWin
    const visibleLevelFloor = normalizeXpForLevelDisplay(mode, currentLevelFloor)
    const winsDerivedXp = Math.max(Math.floor(totalVisibleXp - visibleLevelFloor), 0)

    return Math.min(Math.max(rawDisplayedXp, winsDerivedXp), displayedLevelCap)
  }

  return Math.min(rawDisplayedXp, displayedLevelCap)
}

export function XpCalculatorFeature() {
  const { formValues, patchFormValues, updateField } = useXpCalculatorForm()
  const autofillSignatureRef = useRef('')
  const lastAutofilledProfileIdRef = useRef<number | null>(null)
  const [isRefreshingPlayer, setIsRefreshingPlayer] = useState(false)
  const [lastPlayerRefreshAt, setLastPlayerRefreshAt] = useState<number | null>(null)
  const [playerRefreshTick, setPlayerRefreshTick] = useState(0)
  const [showChallenge, setShowChallenge] = useState(false)
  const [showMainSummary, setShowMainSummary] = useState(false)
  const lastModeContextRef = useRef('')
  const [challengeDifficulty, setChallengeDifficulty] = useState<'dificil' | 'facil' | 'medio'>(
    'facil',
  )
  const [challengeCadence, setChallengeCadence] = useState<'diario' | 'mensal' | 'semanal'>(
    'diario',
  )
  const [challengeTarget, setChallengeTarget] = useState<'next-level' | 'target-level'>(
    'next-level',
  )
  const [playerLookup, setPlayerLookup] = useState<{
    error: string
    nickname: string
    player: MushPlayerProfile | null
  }>({
    error: '',
    nickname: '',
    player: null,
  })
  const [tableState, setTableState] = useState<{
    error: string
    mode: MushGameMode | null
    table: MushXpTable | null
  }>({
    error: '',
    mode: null,
    table: null,
  })

  useEffect(() => {
    let isMounted = true

    void getXpTable(formValues.mode)
      .then((table) => {
        if (!isMounted) {
          return
        }

        setTableState({
          error: '',
          mode: formValues.mode,
          table,
        })
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return
        }

        if (error instanceof MushApiError) {
          setTableState({
            error: error.message,
            mode: formValues.mode,
            table: null,
          })
          return
        }

        setTableState({
          error: 'Nao foi possivel carregar a tabela de XP agora.',
          mode: formValues.mode,
          table: null,
        })
      })

    return () => {
      isMounted = false
    }
  }, [formValues.mode])

  const currentLevel = Number(formValues.currentLevel)
  const currentXp = Number(formValues.currentXp)
  const targetLevel = Number(formValues.targetLevel)
  const averageXpPerMatch = Number(formValues.averageXpPerMatch)
  const isDoubleXpEnabled = formValues.doubleXp
  const isLoadingTable = tableState.mode !== formValues.mode
  const xpTable = tableState.mode === formValues.mode ? tableState.table : null
  const apiMessage = isLoadingTable
    ? 'Carregando tabela de XP do modo selecionado...'
    : tableState.error
  const validation = validateXpCalculatorForm(formValues, xpTable)
  const normalizedNickname = formValues.nickname.trim()
  const canLookupPlayer =
    normalizedNickname.length >= 3 && !validation.fieldErrors.nickname
  const isResolvingPlayer =
    canLookupPlayer && playerLookup.nickname !== normalizedNickname
  const activePlayer =
    canLookupPlayer && playerLookup.nickname === normalizedNickname
      ? playerLookup.player
      : null
  const activeProfileId =
    canLookupPlayer && playerLookup.nickname === normalizedNickname
      ? playerLookup.player?.account.profile_id ?? null
      : null
  const activePlayerError =
    canLookupPlayer && playerLookup.nickname === normalizedNickname ? playerLookup.error : ''
  const duelsSubmodeOptions = getAvailableDuelsSubmodes(activePlayer)
  const hasResolvedPlayer = activePlayer !== null
  const autofillSnapshot = activePlayer
    ? getAutofillXpSnapshot(activePlayer, formValues.mode, formValues.duelsSubmode)
    : null
  const normalizedAutofillSnapshot =
    autofillSnapshot && xpTable
      ? normalizeAutofillXpSnapshot(autofillSnapshot, xpTable)
      : autofillSnapshot
  const activeAutofillSourceLabel = normalizedAutofillSnapshot
    ? normalizedAutofillSnapshot.sourceLabel
    : ''
  const averageXpSnapshot = activePlayer
    ? getAverageXpPerMatchSnapshot(activePlayer, formValues.mode, formValues.duelsSubmode)
    : null
  const isFixedVictoryXp = Boolean(averageXpSnapshot)
  const modeAccent = getModeAccent(formValues.mode, formValues.duelsSubmode)
  const playerAccent = activePlayer
    ? getPlayerAccentColor(activePlayer, modeAccent)
    : modeAccent
  const levelBadgeMeta = activePlayer
    ? getPlayerLevelBadgeMeta(activePlayer, formValues.mode, formValues.duelsSubmode)
    : null
  const playerBadges: Array<{ color?: string; label: string }> = []

  if (activePlayer?.best_tag) {
    playerBadges.push({
      color: activePlayer.best_tag.color,
      label: activePlayer.best_tag.name,
    })
  }

  if (levelBadgeMeta) {
    playerBadges.push({
      color: levelBadgeMeta.color ?? undefined,
      label: levelBadgeMeta.label,
    })
  }
  const scalarModeStatsMap = getScalarModeStatsMap(
    activePlayer,
    formValues.mode,
    formValues.duelsSubmode,
  )
  const playerPreviewStats = getPlayerPreviewStats(
    activePlayer,
    formValues.mode,
    formValues.duelsSubmode,
  )
  const activePlayerCardKey = activePlayer
    ? [
        activePlayer.account.profile_id,
        formValues.mode,
        formValues.duelsSubmode,
        lastPlayerRefreshAt ?? 0,
        ...playerPreviewStats.map((stat) => `${stat.label}:${stat.value}`),
      ].join(':')
    : ''

  useEffect(() => {
    void invoke('ensure_log_watcher').catch(() => {
      return null
    })

    let unsubscribe: (() => void) | undefined

    void listen<boolean>('minecraft-refresh-trigger', async () => {
      if (!canLookupPlayer) {
        return
      }

      invalidatePlayerCache(normalizedNickname)
      setIsRefreshingPlayer(true)
      setPlayerRefreshTick((currentValue) => currentValue + 1)
    })
      .then((unlisten) => {
        unsubscribe = unlisten
      })
      .catch(() => {
        return null
      })

    return () => {
      unsubscribe?.()
    }
  }, [canLookupPlayer, normalizedNickname])

  useEffect(() => {
    if (formValues.mode !== 'duels') {
      return
    }

    if (duelsSubmodeOptions.some((option) => option.value === formValues.duelsSubmode)) {
      return
    }

    const firstAvailableSubmode = duelsSubmodeOptions[0]?.value

    if (firstAvailableSubmode) {
      updateField('duelsSubmode', firstAvailableSubmode)
    }
  }, [duelsSubmodeOptions, formValues.duelsSubmode, formValues.mode, updateField])

  useEffect(() => {
    if (!canLookupPlayer) {
      return
    }

    let isMounted = true
    const timeoutId = window.setTimeout(() => {
      const playerRequest = activeProfileId
        ? getPlayerByProfileId(activeProfileId)
        : getPlayer(normalizedNickname)

      void playerRequest
        .then((player) => {
          if (!isMounted) {
            return
          }

          setIsRefreshingPlayer(false)
          setLastPlayerRefreshAt(Date.now())
          setPlayerLookup({
            error: '',
            nickname: normalizedNickname,
            player,
          })
        })
        .catch((error: unknown) => {
          if (!isMounted) {
            return
          }

          setIsRefreshingPlayer(false)
          setPlayerLookup({
            error:
              error instanceof MushApiError
                ? error.message
                : 'Nao foi possivel identificar esse player agora.',
            nickname: normalizedNickname,
            player: null,
          })
        })
    }, 350)

    return () => {
      isMounted = false
      window.clearTimeout(timeoutId)
    }
  }, [activeProfileId, canLookupPlayer, normalizedNickname, playerRefreshTick])

  const lastRefreshLabel = lastPlayerRefreshAt
    ? new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(lastPlayerRefreshAt)
    : 'Aguardando primeira consulta'

  useEffect(() => {
    if (!canLookupPlayer) {
      return
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'hidden') {
        return
      }

      invalidatePlayerCache(normalizedNickname)
      setPlayerRefreshTick((currentValue) => currentValue + 1)
    }, PLAYER_AUTO_REFRESH_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [canLookupPlayer, normalizedNickname])

  function handleRefreshPlayer() {
    if (!canLookupPlayer) {
      return
    }

    invalidatePlayerCache(normalizedNickname)
    setIsRefreshingPlayer(true)
    setPlayerRefreshTick((currentValue) => currentValue + 1)
  }

  useEffect(() => {
    const nextModeContext = `${normalizedNickname}:${formValues.mode}:${formValues.duelsSubmode}`

    if (!normalizedNickname) {
      lastModeContextRef.current = ''
      return
    }

    if (!lastModeContextRef.current) {
      lastModeContextRef.current = nextModeContext
      return
    }

    if (lastModeContextRef.current === nextModeContext) {
      return
    }

    lastModeContextRef.current = nextModeContext
    autofillSignatureRef.current = ''

    patchFormValues({
      currentLevel: '0',
      currentXp: '0',
    })
  }, [normalizedNickname, formValues.mode, formValues.duelsSubmode, patchFormValues])

  useEffect(() => {
    if (!activePlayer || !normalizedAutofillSnapshot) {
      autofillSignatureRef.current = ''
      lastAutofilledProfileIdRef.current = null
      return
    }

    const nextSignature = `${activePlayer.account.profile_id}:${formValues.mode}:${formValues.duelsSubmode}:${normalizedAutofillSnapshot.sourceLabel}:${normalizedAutofillSnapshot.currentLevel}:${normalizedAutofillSnapshot.currentXp}:${averageXpSnapshot?.value ?? 'manual'}`

    if (autofillSignatureRef.current === nextSignature) {
      return
    }

    autofillSignatureRef.current = nextSignature
    const maximumTargetLevel = xpTable ? xpTable.levels.length - 1 : normalizedAutofillSnapshot.currentLevel + 1
    const defaultTargetLevel = String(
      Math.min(normalizedAutofillSnapshot.currentLevel + 1, maximumTargetLevel),
    )
    const hasProfileChanged = lastAutofilledProfileIdRef.current !== activePlayer.account.profile_id

    patchFormValues({
      averageXpPerMatch: averageXpSnapshot
        ? String(averageXpSnapshot.value)
        : formValues.averageXpPerMatch,
      currentLevel: String(normalizedAutofillSnapshot.currentLevel),
      currentXp: String(normalizedAutofillSnapshot.currentXp),
      targetLevel:
        hasProfileChanged || Number(formValues.targetLevel) <= normalizedAutofillSnapshot.currentLevel
          ? defaultTargetLevel
          : formValues.targetLevel,
    })
    lastAutofilledProfileIdRef.current = activePlayer.account.profile_id
  }, [
    activePlayer,
    xpTable,
    normalizedAutofillSnapshot,
    formValues.duelsSubmode,
    formValues.mode,
    formValues.averageXpPerMatch,
    formValues.targetLevel,
    averageXpSnapshot,
    patchFormValues,
  ])

  const canCalculate =
    hasResolvedPlayer &&
    xpTable !== null &&
    validation.parsedValues !== null &&
    Number.isFinite(currentLevel) &&
    Number.isFinite(currentXp) &&
    Number.isFinite(targetLevel) &&
    Number.isFinite(averageXpPerMatch)

  let nextLevelValue = 'Aguardando dados'
  let targetLevelValue = 'Aguardando dados'
  let estimatedWinsValue = 'Aguardando dados'
  let remainingLevelsSummary = {
    description: 'Aguardando um perfil valido para calcular quantos levels faltam ate o alvo.',
    label: 'Level faltante',
    progressPercent: 0,
    value: 'Aguardando dados',
    valueLabel: '0%',
  }
  let progressPercentValue = 'Aguardando dados'
  let challengeSummaryValue = 'Aguardando dados'
  let challengeWinsValue = 'Aguardando dados'
  let challengeKillsValue = 'Aguardando dados'
  let challengeFinalKillsValue = 'Aguardando dados'
  let challengeBedsValue = 'Aguardando dados'
  let challengePerfectBedValue = 'Aguardando dados'
  let challengeNoDeathValue = 'Aguardando dados'
  let challengeProgressCurrentLabel = 'Aguardando dados'
  let challengeProgressProjectedLabel = 'Aguardando dados'
  let challengeProgressOverflowLabel = ''
  let challengeProgressCurrentPercent = 0
  let challengeProgressProjectedPercent = 0
  let challengeCards: Array<{ description: string; title: string; value: string }> = []
  let chartSections = [
    {
      color: `linear-gradient(90deg, ${modeAccent}, rgba(255,255,255,0.92))`,
      description: 'Aguardando um perfil valido para medir o preenchimento do level atual.',
      label: 'Level atual',
      progressPercent: 0,
      valueLabel: '0%',
    },
  ]

  if (canCalculate && xpTable) {
    try {
      const parsedValues = validation.parsedValues

      if (!parsedValues) {
        throw new Error('Invalid form data.')
      }

      const requiredXpForCurrentLevel = xpRequiredForLevel(
        xpTable,
        parsedValues.currentLevel,
      )
      const currentLevelFloor = xpTable.levels[parsedValues.currentLevel] ?? 0
      const targetLevelFloor = xpTable.levels[parsedValues.targetLevel] ?? currentLevelFloor
      const targetJourneyTotalXp = Math.max(targetLevelFloor - currentLevelFloor, 0)
      const winsCount =
        typeof scalarModeStatsMap.get('wins') === 'number'
          ? (scalarModeStatsMap.get('wins') as number)
          : null
      const levelDisplayRequiredXp = Math.max(
        Math.round(normalizeXpForLevelDisplay(formValues.mode, requiredXpForCurrentLevel)),
        0,
      )
      const levelDisplayCurrentXp = getDisplayedCurrentXpInLevel(
        formValues.mode,
        currentLevelFloor,
        parsedValues.currentXp,
        requiredXpForCurrentLevel,
        winsCount,
        averageXpSnapshot?.value ?? null,
      )
      const levelDisplayJourneyCurrentXp = levelDisplayCurrentXp
      const levelDisplayJourneyTotalXp = Math.max(
        Math.round(normalizeXpForLevelDisplay(formValues.mode, targetJourneyTotalXp)),
        0,
      )
      const targetJourneyPercent =
        parsedValues.targetLevel <= parsedValues.currentLevel
          ? 100
          : levelDisplayJourneyTotalXp <= 0
            ? 0
            : Math.min((levelDisplayJourneyCurrentXp / levelDisplayJourneyTotalXp) * 100, 100)
      const displayProgressPercent =
        levelDisplayRequiredXp <= 0
          ? 100
          : Math.min((levelDisplayCurrentXp / levelDisplayRequiredXp) * 100, 100)
      const levelDisplayRemainingXp = Math.max(levelDisplayRequiredXp - levelDisplayCurrentXp, 0)
      const levelDisplayRemainingToTargetXp = Math.max(
        levelDisplayJourneyTotalXp - levelDisplayJourneyCurrentXp,
        0,
      )
      const effectiveXpPerMatch = parsedValues.averageXpPerMatch * (isDoubleXpEnabled ? 2 : 1)

      nextLevelValue = `${formatNumber(levelDisplayRemainingXp)} XP`
      targetLevelValue = `${formatNumber(levelDisplayRemainingToTargetXp)} XP`
      estimatedWinsValue = `${formatNumber(
        estimateMatches(levelDisplayRemainingToTargetXp, effectiveXpPerMatch),
      )} wins`
      progressPercentValue = `${formatPercent(Math.round(displayProgressPercent))}%`
      const remainingLevels = Math.max(parsedValues.targetLevel - parsedValues.currentLevel, 0)
      remainingLevelsSummary = {
        description:
          remainingLevels === 0
            ? `Meta concluida no level ${parsedValues.targetLevel}.`
            : `${formatNumber(levelDisplayJourneyCurrentXp)} de ${formatNumber(levelDisplayJourneyTotalXp)} XP no caminho ate o level ${parsedValues.targetLevel}.`,
        label: 'Level faltante',
        progressPercent: targetJourneyPercent,
        value: remainingLevels === 1 ? '1 level' : `${formatNumber(remainingLevels)} levels`,
        valueLabel: `${formatPercent(Math.round(targetJourneyPercent))}%`,
      }

      const challengeBaseXp =
        challengeTarget === 'target-level'
          ? levelDisplayRemainingToTargetXp
          : levelDisplayRemainingXp
      const genericChallengeWins =
        estimateActionsForXp(challengeBaseXp, effectiveXpPerMatch) +
        CHALLENGE_EXTRA_WINS_BY_DIFFICULTY[challengeDifficulty] +
        CHALLENGE_EXTRA_WINS_BY_CADENCE[challengeCadence]
      const genericChallengeXp = genericChallengeWins * effectiveXpPerMatch
      const genericProjectedChallengeTotalXp = levelDisplayCurrentXp + genericChallengeXp
      const genericChallengeOverflowXp =
        challengeTarget === 'target-level'
          ? Math.max(genericChallengeXp - challengeBaseXp, 0)
          : Math.max(levelDisplayCurrentXp + genericChallengeXp - levelDisplayRequiredXp, 0)

      challengeSummaryValue = `${formatNumber(Math.round(genericChallengeXp))} XP`
      challengeWinsValue = `${formatNumber(genericChallengeWins)} wins`
      challengeProgressCurrentPercent = displayProgressPercent
      challengeProgressProjectedPercent =
        challengeTarget === 'target-level'
          ? levelDisplayJourneyTotalXp <= 0
            ? 0
            : Math.min((genericProjectedChallengeTotalXp / levelDisplayJourneyTotalXp) * 100, 100)
          : levelDisplayRequiredXp <= 0
            ? 0
            : Math.min((genericProjectedChallengeTotalXp / levelDisplayRequiredXp) * 100, 100)
      challengeProgressCurrentLabel = `${formatNumber(levelDisplayCurrentXp)} de ${formatNumber(levelDisplayRequiredXp)} XP agora`
      challengeProgressProjectedLabel =
        challengeTarget === 'target-level'
          ? genericChallengeOverflowXp > 0
            ? `${formatNumber(levelDisplayJourneyTotalXp)} de ${formatNumber(levelDisplayJourneyTotalXp)} XP acumulada ao concluir`
            : `${formatNumber(Math.round(genericProjectedChallengeTotalXp))} de ${formatNumber(levelDisplayJourneyTotalXp)} XP acumulada ao concluir`
          : genericChallengeOverflowXp > 0
            ? `${formatNumber(levelDisplayRequiredXp)} de ${formatNumber(levelDisplayRequiredXp)} XP ao concluir`
            : `${formatNumber(Math.round(genericProjectedChallengeTotalXp))} de ${formatNumber(levelDisplayRequiredXp)} XP ao concluir`
      challengeProgressOverflowLabel =
        genericChallengeOverflowXp > 0
          ? challengeTarget === 'target-level'
            ? `${formatNumber(Math.round(genericChallengeOverflowXp))} XP de sobra depois de bater o level alvo`
            : `${formatNumber(Math.round(genericChallengeOverflowXp))} XP de sobra depois de subir o level`
          : ''
      challengeCards = [
        {
          description:
            challengeTarget === 'target-level'
              ? 'Pacote total para sair do level atual e bater o alvo.'
              : 'Pacote total para fechar o level atual.',
          title: 'XP do desafio',
          value: challengeSummaryValue,
        },
        {
          description:
            challengeTarget === 'target-level'
              ? 'Quantidade de partidas vencidas para buscar o alvo.'
              : 'Quantidade de partidas vencidas para buscar o proximo level.',
          title: 'Wins do desafio',
          value: challengeWinsValue,
        },
      ]

      if (formValues.mode === 'bedwars') {
        const challengeProfile = BEDWARS_CHALLENGE_PROFILES[challengeDifficulty]
        const challengeXpPerWin =
          BEDWARS_BASE_WIN_XP +
          challengeProfile.killsPerWin * BEDWARS_KILL_XP +
          challengeProfile.finalKillsPerWin * BEDWARS_FINAL_KILL_XP +
          challengeProfile.bedBreaksPerWin * BEDWARS_BED_BREAK_XP +
          (challengeProfile.winsWithoutLosingBed ? BEDWARS_WIN_WITH_BED_BONUS_XP : 0) +
          (challengeProfile.winsWithoutDying ? BEDWARS_WIN_WITHOUT_DYING_BONUS_XP : 0)
        const challengeWins =
          estimateActionsForXp(challengeBaseXp, challengeXpPerWin) +
          challengeProfile.extraWins +
          CHALLENGE_EXTRA_WINS_BY_CADENCE[challengeCadence]
        const challengeTargetXp = challengeWins * challengeXpPerWin
        const challengeReferenceXp =
          challengeTarget === 'target-level'
            ? levelDisplayRemainingToTargetXp
            : levelDisplayRemainingXp
        const projectedChallengeXp = levelDisplayCurrentXp + challengeTargetXp
        const challengeOverflowXp =
          challengeTarget === 'target-level'
            ? Math.max(challengeTargetXp - challengeReferenceXp, 0)
            : Math.max(projectedChallengeXp - levelDisplayRequiredXp, 0)

        challengeSummaryValue = `${formatNumber(Math.round(challengeTargetXp))} XP`
        challengeWinsValue = `${formatNumber(challengeWins)} wins`
        challengeKillsValue = `${formatNumber(challengeWins * challengeProfile.killsPerWin)} kills`
        challengeFinalKillsValue = `${formatNumber(challengeWins * challengeProfile.finalKillsPerWin)} final kills`
        challengeBedsValue = `${formatNumber(challengeWins * challengeProfile.bedBreaksPerWin)} camas`
        challengePerfectBedValue = challengeProfile.winsWithoutLosingBed
          ? `${formatNumber(challengeWins)} partidas`
          : 'Nao exigido'
        challengeNoDeathValue = challengeProfile.winsWithoutDying
          ? `${formatNumber(challengeWins)} partidas`
          : 'Nao exigido'
        challengeProgressCurrentPercent = displayProgressPercent
        challengeProgressProjectedPercent =
          challengeTarget === 'target-level'
            ? levelDisplayJourneyTotalXp <= 0
              ? 0
              : Math.min((projectedChallengeXp / levelDisplayJourneyTotalXp) * 100, 100)
            : levelDisplayRequiredXp <= 0
              ? 0
              : Math.min((projectedChallengeXp / levelDisplayRequiredXp) * 100, 100)
        challengeProgressCurrentLabel = `${formatNumber(levelDisplayCurrentXp)} de ${formatNumber(levelDisplayRequiredXp)} XP agora`
        challengeProgressProjectedLabel =
          challengeTarget === 'target-level'
            ? challengeOverflowXp > 0
              ? `${formatNumber(levelDisplayJourneyTotalXp)} de ${formatNumber(levelDisplayJourneyTotalXp)} XP acumulada ao concluir`
              : `${formatNumber(Math.round(projectedChallengeXp))} de ${formatNumber(levelDisplayJourneyTotalXp)} XP acumulada ao concluir`
            : challengeOverflowXp > 0
              ? `${formatNumber(levelDisplayRequiredXp)} de ${formatNumber(levelDisplayRequiredXp)} XP ao concluir`
              : `${formatNumber(Math.round(projectedChallengeXp))} de ${formatNumber(levelDisplayRequiredXp)} XP ao concluir`
        challengeProgressOverflowLabel =
          challengeOverflowXp > 0
            ? challengeTarget === 'target-level'
              ? `${formatNumber(Math.round(challengeOverflowXp))} XP de sobra depois de bater o level alvo`
              : `${formatNumber(Math.round(challengeOverflowXp))} XP de sobra depois de subir o level`
            : ''
        challengeCards = [
          {
            description:
              challengeTarget === 'target-level'
                ? 'Pacote total para sair do level atual e bater o alvo.'
                : 'Pacote total para fechar o level atual.',
            title: 'XP do desafio',
            value: challengeSummaryValue,
          },
          {
            description:
              challengeTarget === 'target-level'
                ? 'Quantidade de partidas vencidas para buscar o alvo.'
                : 'Quantidade de partidas vencidas para buscar o proximo level.',
            title: 'Wins sem perder',
            value: challengeWinsValue,
          },
          {
            description: 'Volume total de kills dentro desse pacote.',
            title: 'Kills do desafio',
            value: challengeKillsValue,
          },
          {
            description: 'Volume total de final kills dentro desse pacote.',
            title: 'Final kills do desafio',
            value: challengeFinalKillsValue,
          },
          {
            description: 'Total de camas quebradas previsto nesse caminho.',
            title: 'Camas do desafio',
            value: challengeBedsValue,
          },
          {
            description: 'Partidas que pedem vitoria sem perder a cama.',
            title: 'Sem perder a cama',
            value: challengePerfectBedValue,
          },
          {
            description: 'Partidas que pedem vitoria sem morrer.',
            title: 'Sem morrer',
            value: challengeNoDeathValue,
          },
        ]
      } else if (formValues.mode === 'skywars') {
        const killsPerWin = getPerWinActionEstimate(scalarModeStatsMap, 'kills')

        if (killsPerWin !== null) {
          challengeCards.push({
            description: 'Estimativa de kills com base no seu historico de wins no modo.',
            title: 'Kills estimadas',
            value: `${formatNumber(Math.ceil(genericChallengeWins * killsPerWin))} kills`,
          })
        }
      } else if (formValues.mode === 'duels') {
        const duelsExtraActions = DUELS_CHALLENGE_EXTRA_ACTIONS[formValues.duelsSubmode] ?? []

        duelsExtraActions.forEach((action) => {
          const actionPerWin = getPerWinActionEstimate(scalarModeStatsMap, action.key)

          if (actionPerWin === null) {
            return
          }

          challengeCards.push({
            description: `Estimativa de ${action.title.toLowerCase()} com base no seu historico no submodo.`,
            title: action.title,
            value: `${formatNumber(Math.ceil(genericChallengeWins * actionPerWin))} ${action.key === 'kills' ? 'kills' : 'camas'}`,
          })
        })
      }

      chartSections = [
        {
          color: `linear-gradient(90deg, ${modeAccent}, rgba(255,255,255,0.92))`,
          description: `${formatNumber(levelDisplayCurrentXp)} de ${formatNumber(levelDisplayRequiredXp)} XP dentro do level ${parsedValues.currentLevel}.`,
          label: 'Level atual',
          progressPercent: displayProgressPercent,
          valueLabel: `${formatPercent(Math.round(displayProgressPercent))}%`,
        },
      ]
    } catch {
      nextLevelValue = 'Valores fora da faixa'
      targetLevelValue = 'Valores fora da faixa'
      estimatedWinsValue = 'Valores fora da faixa'
      progressPercentValue = 'Valores fora da faixa'
      challengeSummaryValue = 'Valores fora da faixa'
      challengeWinsValue = 'Valores fora da faixa'
      challengeKillsValue = 'Valores fora da faixa'
      challengeFinalKillsValue = 'Valores fora da faixa'
      challengeBedsValue = 'Valores fora da faixa'
      challengePerfectBedValue = 'Valores fora da faixa'
      challengeNoDeathValue = 'Valores fora da faixa'
      challengeProgressCurrentLabel = 'Valores fora da faixa'
      challengeProgressProjectedLabel = 'Valores fora da faixa'
      challengeProgressOverflowLabel = ''
      challengeProgressCurrentPercent = 0
      challengeProgressProjectedPercent = 0
    }
  }

  return (
    <section
      aria-label="Calculadora de XP"
      className="calculator-panel"
      style={
        {
          '--mode-accent': modeAccent,
          '--mode-accent-rgb': getRgbTriplet(modeAccent),
          '--player-accent': playerAccent,
          '--player-accent-rgb': getRgbTriplet(playerAccent),
        } as CSSProperties
      }
    >
      <div className="panel-heading">
        <h2>Calculadora de XP</h2>
        <p>
          Busque o nick, confira o autofill e ajuste apenas o que precisar para simular a meta.
        </p>
      </div>

      <div className="calculator-side">
        <form className="calculator-form">
          <FieldGroup
            htmlFor="nickname"
            invalid={Boolean(validation.fieldErrors.nickname)}
            label="Nick"
            message={validation.fieldErrors.nickname}
          >
            <TextField
              id="nickname"
              invalid={Boolean(validation.fieldErrors.nickname)}
              name="nickname"
              onChange={(value) => updateField('nickname', value)}
              placeholder="Ex.: Satturnni"
              value={formValues.nickname}
            />
          </FieldGroup>

          <FieldGroup htmlFor="mode" label="Modo">
            <SelectField
              id="mode"
              name="mode"
              onChange={(value) => updateField('mode', value as typeof formValues.mode)}
              options={modeOptions}
              value={formValues.mode}
            />
          </FieldGroup>
          
          {formValues.mode === 'duels' ? (
            <FieldGroup htmlFor="duelsSubmode" label="Submodo de Duels">
              <SelectField
                id="duelsSubmode"
                name="duelsSubmode"
                onChange={(value) => updateField('duelsSubmode', value)}
                options={duelsSubmodeOptions}
                value={formValues.duelsSubmode}
              />
            </FieldGroup>
          ) : null}

          {normalizedNickname ? (
            <div className="player-card-slot">
              <div className="player-card-slot-toolbar">
                <span className="player-refresh-meta">
                  API publica pode atrasar. Auto refresh em 60s. Ultima consulta: {lastRefreshLabel}
                </span>
                <button
                  className="player-refresh-button"
                  onClick={handleRefreshPlayer}
                  type="button"
                >
                  {isRefreshingPlayer ? 'Atualizando...' : 'Atualizar perfil'}
                </button>
              </div>
              {isResolvingPlayer ? (
                <PlayerIdentityCard
                  key={`loading:${normalizedNickname}:${playerRefreshTick}`}
                  message={
                    isRefreshingPlayer
                      ? 'Atualizando os dados mais recentes do perfil...'
                      : 'Consultando a API publica do Mush...'
                  }
                  status="loading"
                  subtitle={`Nick digitado: ${normalizedNickname}`}
                  title="Identificando player"
                />
              ) : activePlayer ? (
                <PlayerIdentityCard
                  key={activePlayerCardKey}
                  accentColor={playerAccent}
                  avatarUrl={getPlayerHeadUrl(activePlayer, 96)}
                  badges={playerBadges}
                  message={
                    autofillSnapshot
                      ? `Level e XP preenchidos automaticamente de ${activeAutofillSourceLabel}.`
                      : activePlayer.connected
                        ? 'Online agora'
                        : 'Perfil encontrado, mas esse modo nao trouxe level e XP.'
                  }
                  previewDescription={`Passe o mouse e espere 1 segundo para ver a skin completa e os principais stats de ${activeAutofillSourceLabel || 'este modo'}.`}
                  previewSkinUrl={getPlayerBodyUrl(activePlayer)}
                  previewStats={playerPreviewStats}
                  status="success"
                  subtitle={
                    activePlayer.best_tag
                      ? `${activePlayer.account.username} - ${activePlayer.best_tag.name}`
                      : activePlayer.account.username
                  }
                  title="Player identificado"
                />
              ) : activePlayerError ? (
                <PlayerIdentityCard
                  key={`error:${normalizedNickname}:${playerRefreshTick}`}
                  message={activePlayerError}
                  status="error"
                  subtitle={`Nick consultado: ${normalizedNickname}`}
                  title="Player nao encontrado"
                />
              ) : (
                <PlayerIdentityCard
                  key="idle-player-card"
                  message="Continue digitando um nick valido para buscar o perfil."
                  status="idle"
                  subtitle="A busca comeca automaticamente"
                  title="Aguardando identificacao"
                />
              )}
            </div>
          ) : null}

          <FieldGroup
            htmlFor="currentLevel"
            invalid={Boolean(validation.fieldErrors.currentLevel)}
            label="Level atual"
            message={validation.fieldErrors.currentLevel}
          >
            <NumberField
              id="currentLevel"
              invalid={Boolean(validation.fieldErrors.currentLevel)}
              min={0}
              name="currentLevel"
              onChange={(value) => updateField('currentLevel', value)}
              placeholder="1"
              readOnly
              value={formValues.currentLevel}
            />
          </FieldGroup>

          <FieldGroup
            htmlFor="currentXp"
            invalid={Boolean(validation.fieldErrors.currentXp)}
            label="XP atual no level"
            message={validation.fieldErrors.currentXp}
          >
            <NumberField
              id="currentXp"
              invalid={Boolean(validation.fieldErrors.currentXp)}
              min={0}
              name="currentXp"
              onChange={(value) => updateField('currentXp', value)}
              placeholder="0"
              readOnly
              value={formValues.currentXp}
            />
          </FieldGroup>

          <FieldGroup
            htmlFor="targetLevel"
            invalid={Boolean(validation.fieldErrors.targetLevel)}
            label="Level alvo"
            message={validation.fieldErrors.targetLevel}
          >
            <NumberField
              id="targetLevel"
              invalid={Boolean(validation.fieldErrors.targetLevel)}
              min={0}
              name="targetLevel"
              onChange={(value) => updateField('targetLevel', value)}
              placeholder="2"
              value={formValues.targetLevel}
            />
          </FieldGroup>

          <FieldGroup
            htmlFor="averageXpPerMatch"
            hint={
              averageXpSnapshot
                ? formValues.mode === 'bedwars'
                  ? `XP base por vitoria em Bedwars: ${formatXpPerWinValue(averageXpSnapshot.value)} XP.${isDoubleXpEnabled ? ` Com Double XP: ${formatXpPerWinValue(averageXpSnapshot.value * 2)} XP.` : ''} O desafio soma kills, final kills, camas e bonus quando for preciso.`
                  : formValues.mode === 'duels'
                    ? `Em ${averageXpSnapshot.sourceLabel}, as vitorias sao a base do calculo. Valor usado: ${formatXpPerWinValue(averageXpSnapshot.value)} XP por vitoria.${isDoubleXpEnabled ? ` Com Double XP: ${formatXpPerWinValue(averageXpSnapshot.value * 2)} XP.` : ''}`
                    : `XP base por vitoria em ${averageXpSnapshot.sourceLabel}: ${formatXpPerWinValue(averageXpSnapshot.value)} XP.${isDoubleXpEnabled ? ` Com Double XP: ${formatXpPerWinValue(averageXpSnapshot.value * 2)} XP.` : ''}`
                : 'Ainda nao ha um valor oficial fixo cadastrado para esse modo. Informe manualmente o XP por vitoria.'
            }
            invalid={Boolean(validation.fieldErrors.averageXpPerMatch)}
            label="XP por vitoria"
            message={validation.fieldErrors.averageXpPerMatch}
          >
            <NumberField
              id="averageXpPerMatch"
              invalid={Boolean(validation.fieldErrors.averageXpPerMatch)}
              min={1}
              name="averageXpPerMatch"
              onChange={(value) => updateField('averageXpPerMatch', value)}
              placeholder={
                averageXpSnapshot
                  ? String(averageXpSnapshot.value)
                  : formValues.mode === 'bedwars'
                    ? '250'
                    : formValues.mode === 'duels'
                      ? '2.5'
                      : 'Ex.: 100'
              }
              readOnly={isFixedVictoryXp}
              step={0.1}
              value={formValues.averageXpPerMatch}
            />
          </FieldGroup>

          <div className="toggle-field">
            <label className="toggle-field-label">
              <input
                checked={formValues.doubleXp}
                className="toggle-field-input"
                name="doubleXp"
                onChange={(event) => updateField('doubleXp', event.target.checked)}
                type="checkbox"
              />
              <span className="toggle-field-copy">
                <strong>Double XP ativado</strong>
                <small>
                  Dobra automaticamente o XP por vitoria usado no dashboard e no desafio.
                </small>
              </span>
            </label>
          </div>
        </form>

        {hasResolvedPlayer ? (
          <section className="challenge-builder-card" aria-label="Configuracao de desafio">
            <div className="challenge-toggle-row">
              <button
                className={showChallenge ? 'challenge-button challenge-button-active' : 'challenge-button'}
                onClick={() => setShowChallenge((currentValue) => !currentValue)}
                type="button"
              >
                Desafio
              </button>
              <p>
                Monte um pacote para subir usando XP fixa por vitoria como base e acoes extras quando o modo permitir.
              </p>
            </div>

            {showChallenge ? (
              <div className="challenge-panel">
                <div className="challenge-panel-heading">
                  <span className="challenge-panel-badge">Modo desafio</span>
                  <p>
                    Um plano fechado para o salto que voce escolher, sem misturar com o resumo principal.
                  </p>
                </div>

                <div className="challenge-controls">
                  <FieldGroup htmlFor="challengeTarget" label="Objetivo">
                    <SelectField
                      id="challengeTarget"
                      name="challengeTarget"
                      onChange={(value) =>
                        setChallengeTarget(value as 'next-level' | 'target-level')
                      }
                      options={challengeTargetOptions}
                      value={challengeTarget}
                    />
                  </FieldGroup>

                  <FieldGroup htmlFor="challengeDifficulty" label="Dificuldade">
                    <SelectField
                      id="challengeDifficulty"
                      name="challengeDifficulty"
                      onChange={(value) =>
                        setChallengeDifficulty(value as 'dificil' | 'facil' | 'medio')
                      }
                      options={challengeDifficultyOptions}
                      value={challengeDifficulty}
                    />
                  </FieldGroup>

                  <FieldGroup htmlFor="challengeCadence" label="Periodo">
                    <SelectField
                      id="challengeCadence"
                      name="challengeCadence"
                      onChange={(value) =>
                        setChallengeCadence(value as 'diario' | 'mensal' | 'semanal')
                      }
                      options={challengeCadenceOptions}
                      value={challengeCadence}
                    />
                  </FieldGroup>
                </div>

                <div className="challenge-results-grid">
                  {challengeCards.map((card) => (
                    <ResultCard
                      key={card.title}
                      className="result-card-challenge"
                      description={card.description}
                      title={card.title}
                      value={card.value}
                    />
                  ))}
                </div>

                <div className="challenge-progress-card">
                  <div className="results-section-heading">
                    <strong>Resumo do desafio</strong>
                    <p>Veja onde voce esta agora e onde termina ao fechar esse pacote.</p>
                  </div>

                  <div className="challenge-progress-block">
                    <div className="challenge-progress-header">
                      <strong>Agora</strong>
                      <span>{formatPercent(Math.round(challengeProgressCurrentPercent))}%</span>
                    </div>
                    <div className="challenge-progress-track">
                      <div
                        className="challenge-progress-fill challenge-progress-fill-current"
                        style={{ width: `${Math.min(Math.max(challengeProgressCurrentPercent, 0), 100)}%` }}
                      />
                    </div>
                    <p className="challenge-progress-label">{challengeProgressCurrentLabel}</p>
                  </div>

                  <div className="challenge-progress-block">
                    <div className="challenge-progress-header">
                      <strong>Ao concluir o desafio</strong>
                      <span>{formatPercent(Math.round(challengeProgressProjectedPercent))}%</span>
                    </div>
                    <div className="challenge-progress-track">
                      <div
                        className="challenge-progress-fill challenge-progress-fill-future"
                        style={{ width: `${Math.min(Math.max(challengeProgressProjectedPercent, 0), 100)}%` }}
                      />
                    </div>
                    <p className="challenge-progress-label">{challengeProgressProjectedLabel}</p>
                    {challengeProgressOverflowLabel ? (
                      <p className="challenge-progress-note">{challengeProgressOverflowLabel}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      <section className="results-panel" aria-label="Resultados da simulacao">
        <div className="panel-heading">
          <h2>Resultados</h2>
          <p>
            {apiMessage ||
              validation.summary ||
              (!hasResolvedPlayer
                ? 'Digite um nick válido para liberar o resumo e o desafio.'
                : null) ||
              (activeAutofillSourceLabel
                ? `Campos atuais preenchidos a partir de ${activeAutofillSourceLabel}.`
                : 'Os valores sao recalculados automaticamente conforme voce altera os campos.')}
          </p>
        </div>

        {hasResolvedPlayer ? (
          <XpProgressChart
            heading="Leitura rapida do level atual"
            sections={chartSections}
            summary={remainingLevelsSummary}
          />
        ) : (
          <article className="results-empty-state" aria-live="polite">
            <strong>Nenhum perfil carregado</strong>
            <p>O painel de resultado aparece assim que o app identificar um nick válido.</p>
          </article>
        )}

        {hasResolvedPlayer ? (
          <>
            <button
              className={showMainSummary ? 'results-more-button results-more-button-active' : 'results-more-button'}
              onClick={() => setShowMainSummary((currentValue) => !currentValue)}
              type="button"
            >
              {showMainSummary ? 'Mostrar menos' : 'Mostrar mais'}
            </button>

            {showMainSummary ? (
              <section className="results-section">
                <div className="results-section-heading">
                  <strong>Resumo principal</strong>
                  <p>Quatro números para bater o olho e entender o que falta.</p>
                </div>

                <div className="results-grid">
                  <ResultCard
                    description="XP restante para concluir o level atual."
                    title="XP ate o proximo level"
                    value={nextLevelValue}
                  />
                  <ResultCard
                    description="XP que ainda falta para chegar ao level alvo informado."
                    title="XP restante ate o alvo"
                    value={targetLevelValue}
                  />
                  <ResultCard
                    description="Estimativa geral com base no XP fixo por vitoria configurado para esse modo."
                    title="Vitorias estimadas"
                    value={estimatedWinsValue}
                  />
                  <ResultCard
                    description="Percentual ja preenchido dentro do level atual."
                    title="Progresso do level atual"
                    value={progressPercentValue}
                  />
                </div>
              </section>
            ) : null}
          </>
        ) : null}

      </section>
    </section>
  )
}

