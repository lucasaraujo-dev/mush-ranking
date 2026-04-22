import { useSyncExternalStore } from 'react'
import type { AppRoute } from '../types/navigation'

const DEFAULT_ROUTE: AppRoute = 'xp-calculator'
const ROUTE_PREFIX = '#/'

function normalizeRoute(value: string): AppRoute {
  return value === 'overview' || value === 'xp-calculator' ? value : DEFAULT_ROUTE
}

function getRouteFromHash(): AppRoute {
  const routeValue = window.location.hash.replace(ROUTE_PREFIX, '')
  return normalizeRoute(routeValue)
}

function setHashRoute(route: AppRoute) {
  const nextHash = `${ROUTE_PREFIX}${route}`

  if (window.location.hash === nextHash) {
    listeners.forEach((listener) => listener())
    return
  }

  window.location.hash = nextHash
}

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)

  const onHashChange = () => listener()

  window.addEventListener('hashchange', onHashChange)

  return () => {
    listeners.delete(listener)
    window.removeEventListener('hashchange', onHashChange)
  }
}

function getSnapshot() {
  return getRouteFromHash()
}

function getServerSnapshot() {
  return DEFAULT_ROUTE
}

export function initializeRouter() {
  if (!window.location.hash) {
    window.location.hash = `${ROUTE_PREFIX}${DEFAULT_ROUTE}`
  }
}

export function navigateTo(route: AppRoute) {
  setHashRoute(route)
}

export function useCurrentRoute() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
