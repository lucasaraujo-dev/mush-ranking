import type { PropsWithChildren } from 'react'

type AppShellProps = PropsWithChildren<{
  title: string
  subtitle: string
}>

export function AppShell({ children, title, subtitle }: AppShellProps) {
  return (
    <main className="app-shell">
      <section className="hero-panel">
        <span className="eyebrow">Mush Ranking Desktop</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {children}
      </section>
    </main>
  )
}
