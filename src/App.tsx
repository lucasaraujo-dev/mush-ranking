import './App.css'
import { AppShell } from './components/layout/AppShell'
import { XpCalculatorFeature } from './features/xp-calculator'

function App() {
  return (
    <AppShell
      title="Base pronta para a calculadora de XP."
      subtitle="A arquitetura principal do projeto foi separada em UI, feature, servicos, calculos e tipos para permitir crescimento sem acoplamento."
    >
      <XpCalculatorFeature />
    </AppShell>
  )
}

export default App
