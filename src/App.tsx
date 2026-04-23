import './App.css'
import { OverviewPanel } from './components/layout/OverviewPanel'
import { AppShell } from './components/layout/AppShell'
import { XpCalculatorFeature } from './features/xp-calculator'
import { initializeRouter, navigateTo, useCurrentRoute } from './store/routerStore'

initializeRouter()

function App() {
  const route = useCurrentRoute()

  const titleByRoute = {
    overview: 'Painel base do aplicativo desktop.',
    'xp-calculator': 'Calculadora de XP com autofill.',
  } as const

  const subtitleByRoute = {
    overview:
      'Layout principal, servicos da API e estrutura modular prontos para sustentar as proximas features do app.',
    'xp-calculator':
      'A calculadora usa tabela de XP oficial e pode preencher level e XP automaticamente a partir do nick informado.',
  } as const

  return (
    <AppShell
      activeRoute={route}
      onNavigate={navigateTo}
      title={titleByRoute[route]}
      subtitle={subtitleByRoute[route]}
    >
      {route === 'overview' ? <OverviewPanel /> : null}
      {route === 'xp-calculator' ? <XpCalculatorFeature /> : null}
    </AppShell>
  )
}

export default App
