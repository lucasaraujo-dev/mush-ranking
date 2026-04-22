import { useEffect, useState } from 'react'
import { ResultCard } from '../../../components/feedback/ResultCard'
import { FieldGroup } from '../../../components/forms/FieldGroup'
import { NumberField } from '../../../components/forms/NumberField'
import { SelectField } from '../../../components/forms/SelectField'
import { TextField } from '../../../components/forms/TextField'
import {
  calculateProgressPercent,
  estimateMatches,
  xpToNextLevel,
  xpToTargetLevel,
} from '../../../calculations'
import { getXpTable, MushApiError } from '../../../services/api'
import { useXpCalculatorForm } from '../../../store/xpCalculatorStore'
import type { MushGameMode, MushXpTable } from '../../../types/mush'
import { formatNumber, formatPercent, validateXpCalculatorForm } from '../../../utils'

const modeOptions = [
  { label: 'Bedwars', value: 'bedwars' },
  { label: 'Skywars', value: 'skywars' },
  { label: 'Duels', value: 'duels' },
]

export function XpCalculatorFeature() {
  const { formValues, updateField } = useXpCalculatorForm()
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
  const isLoadingTable = tableState.mode !== formValues.mode
  const xpTable = tableState.mode === formValues.mode ? tableState.table : null
  const apiMessage = isLoadingTable
    ? 'Carregando tabela de XP do modo selecionado...'
    : tableState.error
  const validation = validateXpCalculatorForm(formValues, xpTable)

  const canCalculate =
    xpTable !== null &&
    validation.parsedValues !== null &&
    Number.isFinite(currentLevel) &&
    Number.isFinite(currentXp) &&
    Number.isFinite(targetLevel) &&
    Number.isFinite(averageXpPerMatch)

  let nextLevelValue = 'Aguardando dados'
  let targetLevelValue = 'Aguardando dados'
  let estimatedMatchesValue = 'Aguardando dados'
  let progressPercentValue = 'Aguardando dados'

  if (canCalculate && xpTable) {
    try {
      const parsedValues = validation.parsedValues

      if (!parsedValues) {
        throw new Error('Invalid form data.')
      }

      const remainingToNextLevel = xpToNextLevel(xpTable, currentLevel, currentXp)
      const remainingToTargetLevel = xpToTargetLevel(
        xpTable,
        parsedValues.currentLevel,
        parsedValues.currentXp,
        parsedValues.targetLevel,
      )
      const estimatedMatches = estimateMatches(
        remainingToTargetLevel,
        parsedValues.averageXpPerMatch,
      )
      const progressPercent = calculateProgressPercent(
        xpTable,
        parsedValues.currentLevel,
        parsedValues.currentXp,
      )

      nextLevelValue = `${formatNumber(remainingToNextLevel)} XP`
      targetLevelValue = `${formatNumber(remainingToTargetLevel)} XP`
      estimatedMatchesValue = `${formatNumber(estimatedMatches)} partidas`
      progressPercentValue = `${formatPercent(progressPercent)}%`
    } catch {
      nextLevelValue = 'Valores fora da faixa'
      targetLevelValue = 'Valores fora da faixa'
      estimatedMatchesValue = 'Valores fora da faixa'
      progressPercentValue = 'Valores fora da faixa'
    }
  }

  return (
    <section className="calculator-panel" aria-label="Calculadora de XP">
      <div className="panel-heading">
        <h2>Calculadora de XP</h2>
        <p>
          Informe o nick, selecione o modo e preencha os dados da sua progressao para
          simular o grind restante.
        </p>
      </div>

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
          invalid={Boolean(validation.fieldErrors.averageXpPerMatch)}
          label="XP media por partida"
          message={validation.fieldErrors.averageXpPerMatch}
        >
          <NumberField
            id="averageXpPerMatch"
            invalid={Boolean(validation.fieldErrors.averageXpPerMatch)}
            min={1}
            name="averageXpPerMatch"
            onChange={(value) => updateField('averageXpPerMatch', value)}
            placeholder="450"
            value={formValues.averageXpPerMatch}
          />
        </FieldGroup>
      </form>

      <section className="results-panel" aria-label="Resultados da simulacao">
        <div className="panel-heading">
          <h2>Resultados</h2>
          <p>{apiMessage || validation.summary || 'Os valores sao recalculados automaticamente conforme voce altera os campos.'}</p>
        </div>

        <div className="results-grid">
          <ResultCard
            description="XP restante para concluir o level atual."
            title="XP ate o proximo level"
            value={nextLevelValue}
          />
          <ResultCard
            description="XP total necessario para alcancar o level alvo informado."
            title="XP total ate o alvo"
            value={targetLevelValue}
          />
          <ResultCard
            description="Estimativa com base na sua media de XP por partida."
            title="Partidas restantes"
            value={estimatedMatchesValue}
          />
          <ResultCard
            description="Percentual ja preenchido dentro do level atual."
            title="Progresso percentual"
            value={progressPercentValue}
          />
        </div>
      </section>
    </section>
  )
}
