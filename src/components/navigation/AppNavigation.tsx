import type { AppRoute } from '../../types/navigation'

interface NavigationItem {
  label: string
  route: AppRoute
}

interface AppNavigationProps {
  activeRoute: AppRoute
  items: NavigationItem[]
  onNavigate: (route: AppRoute) => void
}

export function AppNavigation({
  activeRoute,
  items,
  onNavigate,
}: AppNavigationProps) {
  return (
    <nav aria-label="Navegacao principal" className="app-navigation">
      {items.map((item) => (
        <button
          key={item.route}
          className={item.route === activeRoute ? 'nav-item nav-item-active' : 'nav-item'}
          onClick={() => onNavigate(item.route)}
          type="button"
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}
