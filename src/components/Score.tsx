import type { Criterion, CriterionScore, Stage } from '../desk/types'
import { STAGES } from '../desk/types'

/** Colour follows the score, but the number is always printed: never colour alone. */
export function scoreTone(score: number | null | undefined, outOf: 10 | 100): string {
  if (typeof score !== 'number') return 'text-muted-foreground'
  const ratio = score / outOf
  return ratio >= 0.7 ? 'text-positive' : ratio >= 0.45 ? 'text-caution' : 'text-negative'
}

export function TotalScore({ score, size = 'md' }: { score: number | null | undefined; size?: 'md' | 'lg' }) {
  const big = size === 'lg' ? 'text-6xl' : 'text-3xl'
  if (typeof score !== 'number') return <span className="text-sm text-muted-foreground">Not scored</span>
  return (
    <span data-testid="total-score" className={`font-display tabular-nums ${big} ${scoreTone(score, 100)}`}>
      {score}
      <span className="text-base text-muted-foreground">/100</span>
    </span>
  )
}

/** One thin bar per criterion: a company's shape at a glance on the board. */
export function CriteriaBars({ scores, criteria }: { scores: CriterionScore[]; criteria: Criterion[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Score per criterion">
      {criteria.map((c) => {
        const score = scores.find((s) => s.key === c.key)?.score
        const has = typeof score === 'number'
        return (
          <li key={c.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{c.label}</span>
            <span className="relative h-1.5 w-12 overflow-hidden rounded-full bg-accent" aria-hidden="true">
              {has && <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${score * 10}%` }} />}
            </span>
            <span className="tabular-nums text-foreground">{has ? score : 'n/a'}</span>
          </li>
        )
      })}
    </ul>
  )
}

/** Radar chart drawn as plain SVG: one axis per criterion, 0 at the centre, 10 at the rim. */
export function RadarChart({ scores, criteria }: { scores: CriterionScore[]; criteria: Criterion[] }) {
  const size = 280
  const centre = size / 2
  const radius = 92
  const point = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / criteria.length - Math.PI / 2
    return [centre + Math.cos(angle) * radius * (value / 10), centre + Math.sin(angle) * radius * (value / 10)] as const
  }
  const ring = (value: number) => criteria.map((_, i) => point(i, value).join(',')).join(' ')
  const values = criteria.map((c) => scores.find((s) => s.key === c.key)?.score)
  const shape = values.map((v, i) => point(i, typeof v === 'number' ? v : 0).join(',')).join(' ')
  const summary = criteria.map((c, i) => `${c.label} ${typeof values[i] === 'number' ? `${values[i]} out of 10` : 'not scored'}`).join(', ')

  return (
    // The viewBox is wider than the chart so the side labels are never clipped.
    <svg viewBox={`-50 0 ${size + 100} ${size}`} className="w-full max-w-[340px]" role="img" aria-label={`Radar chart. ${summary}`}>
      {[2.5, 5, 7.5, 10].map((v) => (
        <polygon key={v} points={ring(v)} fill="none" stroke="var(--color-border)" strokeWidth="1" />
      ))}
      {criteria.map((c, i) => {
        const [x, y] = point(i, 10)
        const [lx, ly] = point(i, 11.6)
        return (
          <g key={c.key}>
            <line x1={centre} y1={centre} x2={x} y2={y} stroke="var(--color-border)" strokeWidth="1" />
            <text
              x={lx}
              y={ly}
              // Labels on the right start at the axis, labels on the left end at it.
              textAnchor={Math.abs(lx - centre) < 8 ? 'middle' : lx > centre ? 'start' : 'end'}
              dominantBaseline="middle"
              fontSize="11"
              fill="var(--color-muted-foreground)"
            >
              {c.label}
            </text>
          </g>
        )
      })}
      <polygon points={shape} fill="var(--color-primary)" fillOpacity="0.18" stroke="var(--color-primary)" strokeWidth="2" />
      {values.map((v, i) => {
        const [x, y] = point(i, typeof v === 'number' ? v : 0)
        // A hollow dot at the centre marks a criterion that could not be scored.
        return <circle key={criteria[i].key} cx={x} cy={y} r="3.5" fill={typeof v === 'number' ? 'var(--color-primary)' : 'var(--color-card)'} stroke="var(--color-primary)" strokeWidth="1.5" />
      })}
    </svg>
  )
}

export function StageChip({ stage }: { stage: Stage }) {
  const label = STAGES.find((s) => s.id === stage)?.label ?? stage
  const tone = stage === 'invested' ? 'bg-positive/15 text-positive' : stage === 'passed' ? 'bg-muted text-muted-foreground' : 'bg-accent text-accent-foreground'
  return (
    <span data-testid="stage-chip" className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {label}
    </span>
  )
}
