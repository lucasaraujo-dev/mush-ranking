interface XpProgressChartBar {
  color: string
  label: string
  value: number
}

interface XpProgressChartProps {
  bars: XpProgressChartBar[]
  heading: string
}

export function XpProgressChart({ bars, heading }: XpProgressChartProps) {
  const maxValue = Math.max(...bars.map((bar) => bar.value), 1)

  return (
    <section className="xp-chart-card" aria-label="Grafico de progresso de XP">
      <div className="xp-chart-heading">
        <strong>{heading}</strong>
      </div>

      <svg className="xp-chart" viewBox="0 0 360 132" role="img" aria-label={heading}>
        {bars.map((bar, index) => {
          const y = 16 + index * 38
          const width = Math.max((bar.value / maxValue) * 236, 6)

          return (
            <g key={bar.label}>
              <text className="xp-chart-label" x="0" y={y + 10}>
                {bar.label}
              </text>
              <rect
                className="xp-chart-track"
                height="14"
                rx="7"
                width="236"
                x="116"
                y={y}
              />
              <rect
                fill={bar.color}
                height="14"
                rx="7"
                width={width}
                x="116"
                y={y}
              />
            </g>
          )
        })}
      </svg>
    </section>
  )
}
