import './App.css'
import { OverviewPanel } from './components/layout/OverviewPanel'
import { AppShell } from './components/layout/AppShell'
import { XpCalculatorFeature } from './features/xp-calculator'
import { initializeRouter, navigateTo, useCurrentRoute } from './store/routerStore'

initializeRouter()

function App() {
  const route = useCurrentRoute()

  const title =
    route === 'overview' ? 'Painel base do aplicativo desktop.' : 'Base pronta para a calculadora de XP.'

  const subtitle =
    route === 'overview'
      ? 'Layout principal e navegacao basica configurados para sustentar as proximas features do MVP.'
      : 'A arquitetura principal do projeto foi separada em UI, feature, servicos, calculos e tipos para permitir crescimento sem acoplamento.'

  return (
    <AppShell
      activeRoute={route}
      onNavigate={navigateTo}
      title={title}
      subtitle={subtitle}
    >
      {route === 'overview' ? <OverviewPanel /> : <XpCalculatorFeature />}
    </AppShell>
  )
}

export default App
