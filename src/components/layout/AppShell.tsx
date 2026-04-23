import type { PropsWithChildren } from 'react'
import type { AppRoute } from '../../types/navigation'
import { AppNavigation } from '../navigation/AppNavigation'

type AppShellProps = PropsWithChildren<{
  activeRoute: AppRoute
  onNavigate: (route: AppRoute) => void
  title: string
  subtitle: string
}>

const navigationItems = [
  { label: 'Visao Geral', route: 'overview' },
  { label: 'Calculadora XP', route: 'xp-calculator' },
] satisfies Array<{ label: string; route: AppRoute }>

export function AppShell({
  activeRoute,
  children,
  onNavigate,
  title,
  subtitle,
}: AppShellProps) {
  return (
    <main className="app-shell">
      <section className="hero-panel">
        <header className="app-header">
          <div className="app-header-copy">
            <span className="eyebrow">Mush Ranking Desktop</span>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <AppNavigation
            activeRoute={activeRoute}
            items={navigationItems}
            onNavigate={onNavigate}
          />
        </header>
        <section className="app-content">{children}</section>
      </section>
    </main>
  )
}
