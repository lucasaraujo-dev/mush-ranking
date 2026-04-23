interface XpProgressChartSection {
  color: string
  description: string
  label: string
  progressPercent: number
  valueLabel: string
}

interface XpProgressChartSummary {
  description: string
  label: string
  progressPercent: number
  value: string
  valueLabel: string
}

interface XpProgressChartProps {
  heading: string
  sections: XpProgressChartSection[]
  summary?: XpProgressChartSummary
}

export function XpProgressChart({ heading, sections, summary }: XpProgressChartProps) {
  return (
    <section className="xp-chart-card" aria-label="Grafico de progresso de XP">
      <div className="xp-chart-heading">
        <strong>{heading}</strong>
      </div>

      <div className="xp-chart" role="img" aria-label={heading}>
        {sections.map((section) => (
          <article className="xp-chart-row" key={section.label}>
            <div className="xp-chart-row-header">
              <strong>{section.label}</strong>
              <span>{section.valueLabel}</span>
            </div>
            <div className="xp-chart-track">
              <div
                className="xp-chart-fill"
                style={{
                  background: section.color,
                  width: `${Math.min(Math.max(section.progressPercent, 0), 100)}%`,
                }}
              />
            </div>
            <p className="xp-chart-description">{section.description}</p>
          </article>
        ))}
      </div>

      {summary ? (
        <div className="xp-chart-summary">
          <div className="xp-chart-row-header">
            <strong className="xp-chart-summary-label">{summary.label}</strong>
            <span>{summary.valueLabel}</span>
          </div>
          <div className="xp-chart-track">
            <div
              className="xp-chart-fill"
              style={{
                background:
                  'linear-gradient(90deg, rgba(168,168,168,0.82), rgba(255,255,255,0.96))',
                width: `${Math.min(Math.max(summary.progressPercent, 0), 100)}%`,
              }}
            />
          </div>
          <strong className="xp-chart-summary-value">{summary.value}</strong>
          <p className="xp-chart-summary-description">{summary.description}</p>
        </div>
      ) : null}
    </section>
  )
}
