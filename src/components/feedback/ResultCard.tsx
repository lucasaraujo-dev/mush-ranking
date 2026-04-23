interface ResultCardProps {
  className?: string
  description: string
  title: string
  value: string
}

export function ResultCard({ className, description, title, value }: ResultCardProps) {
  return (
    <article className={className ? `result-card ${className}` : 'result-card'}>
      <span className="result-card-label">{title}</span>
      <strong className="result-card-value">{value}</strong>
      <p className="result-card-description">{description}</p>
    </article>
  )
}
