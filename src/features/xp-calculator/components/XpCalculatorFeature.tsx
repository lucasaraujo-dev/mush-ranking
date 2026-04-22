import { FieldGroup } from '../../../components/forms/FieldGroup'
import { NumberField } from '../../../components/forms/NumberField'
import { SelectField } from '../../../components/forms/SelectField'
import { TextField } from '../../../components/forms/TextField'
import { useXpCalculatorForm } from '../../../store/xpCalculatorStore'

const modeOptions = [
  { label: 'Bedwars', value: 'bedwars' },
  { label: 'Skywars', value: 'skywars' },
  { label: 'Duels', value: 'duels' },
]

export function XpCalculatorFeature() {
  const { formValues, updateField } = useXpCalculatorForm()

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
        <FieldGroup htmlFor="nickname" label="Nick">
          <TextField
            id="nickname"
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

        <FieldGroup htmlFor="currentLevel" label="Level atual">
          <NumberField
            id="currentLevel"
            min={0}
            name="currentLevel"
            onChange={(value) => updateField('currentLevel', value)}
            placeholder="1"
            value={formValues.currentLevel}
          />
        </FieldGroup>

        <FieldGroup htmlFor="currentXp" label="XP atual no level">
          <NumberField
            id="currentXp"
            min={0}
            name="currentXp"
            onChange={(value) => updateField('currentXp', value)}
            placeholder="0"
            value={formValues.currentXp}
          />
        </FieldGroup>

        <FieldGroup htmlFor="targetLevel" label="Level alvo">
          <NumberField
            id="targetLevel"
            min={0}
            name="targetLevel"
            onChange={(value) => updateField('targetLevel', value)}
            placeholder="2"
            value={formValues.targetLevel}
          />
        </FieldGroup>

        <FieldGroup htmlFor="averageXpPerMatch" label="XP media por partida">
          <NumberField
            id="averageXpPerMatch"
            min={1}
            name="averageXpPerMatch"
            onChange={(value) => updateField('averageXpPerMatch', value)}
            placeholder="450"
            value={formValues.averageXpPerMatch}
          />
        </FieldGroup>
      </form>
    </section>
  )
}
