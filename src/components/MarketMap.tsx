/**
 * The pipeline as a map: every researched company placed on two criteria the
 * visitor picks, with a bubble sized by its weighted total. Plain SVG.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Criterion, CriterionScore } from '../desk/types'

export interface MapCompany {
  id: string
  name: string
  scores: CriterionScore[]
  total: number | null
}

const SIZE = 460
const PAD = 46
const scale = (value: number) => PAD + (value / 10) * (SIZE - 2 * PAD)

export function MarketMap({ companies, criteria }: { companies: MapCompany[]; criteria: Criterion[] }) {
  const [xKey, setXKey] = useState(criteria.find((c) => c.key === 'stickiness')?.key ?? criteria[0]?.key ?? '')
  const [yKey, setYKey] = useState(criteria.find((c) => c.key === 'growth')?.key ?? criteria[1]?.key ?? '')
  const scoreOf = (company: MapCompany, key: string) => company.scores.find((s) => s.key === key)?.score
  const placed = companies.filter((c) => typeof scoreOf(c, xKey) === 'number' && typeof scoreOf(c, yKey) === 'number')
  const label = (key: string) => criteria.find((c) => c.key === key)?.label ?? key

  const axisSelect = (id: string, value: string, onChange: (key: string) => void) => (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-input bg-card px-2 py-1 text-sm">
      {criteria.map((c) => (
        <option key={c.key} value={c.key}>
          {c.label}
        </option>
      ))}
    </select>
  )

  return (
    <div data-testid="market-map">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <label htmlFor="map-x" className="flex items-center gap-2">
          Across {axisSelect('map-x', xKey, setXKey)}
        </label>
        <label htmlFor="map-y" className="flex items-center gap-2">
          Up {axisSelect('map-y', yKey, setYKey)}
        </label>
        <span>Bubble size: weighted total</span>
      </div>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mt-3 w-full max-w-[560px] rounded-md border border-border bg-card"
        role="img"
        aria-label={`Map of ${placed.length} companies. ${placed.map((c) => `${c.name}: ${label(xKey)} ${scoreOf(c, xKey)}, ${label(yKey)} ${scoreOf(c, yKey)}`).join('. ')}`}
      >
        {/* The upper-right quarter is where a company is strong on both axes. */}
        <rect x={scale(5)} y={scale(0)} width={scale(10) - scale(5)} height={scale(5) - scale(0)} fill="var(--color-primary)" fillOpacity="0.06" />
        {[0, 2.5, 5, 7.5, 10].map((v) => (
          <g key={v}>
            <line x1={scale(v)} y1={PAD} x2={scale(v)} y2={SIZE - PAD} stroke="var(--color-border)" strokeWidth={v === 5 ? 1.5 : 0.75} />
            <line x1={PAD} y1={scale(v)} x2={SIZE - PAD} y2={scale(v)} stroke="var(--color-border)" strokeWidth={v === 5 ? 1.5 : 0.75} />
            <text x={scale(v)} y={SIZE - PAD + 16} textAnchor="middle" fontSize="10" fill="var(--color-muted-foreground)">
              {v}
            </text>
            <text x={PAD - 10} y={SIZE - scale(v) + 3} textAnchor="end" fontSize="10" fill="var(--color-muted-foreground)">
              {v}
            </text>
          </g>
        ))}
        <text x={SIZE / 2} y={SIZE - 8} textAnchor="middle" fontSize="11" fill="var(--color-muted-foreground)">
          {label(xKey)} →
        </text>
        <text x={14} y={SIZE / 2} textAnchor="middle" fontSize="11" fill="var(--color-muted-foreground)" transform={`rotate(-90 14 ${SIZE / 2})`}>
          {label(yKey)} →
        </text>
        {/* Bottom corner of the shaded quarter, where no bubble label can sit. */}
        <text x={SIZE - PAD - 6} y={SIZE - scale(5) - 7} textAnchor="end" fontSize="10" fill="var(--color-primary)">
          strong on both
        </text>
        {placed.map((company, i) => {
          // Companies with the same two scores would sit on top of each other: nudge them apart.
          const twins = placed.slice(0, i).filter((o) => scoreOf(o, xKey) === scoreOf(company, xKey) && scoreOf(o, yKey) === scoreOf(company, yKey)).length
          const cx = scale(scoreOf(company, xKey) as number)
          const cy = SIZE - scale(scoreOf(company, yKey) as number) + twins * 26
          const r = 7 + ((company.total ?? 40) / 100) * 15
          return (
            <Link key={company.id} to={`/deal/${company.id}`} data-testid="map-bubble">
              <circle cx={cx} cy={cy} r={r} fill="var(--color-primary)" fillOpacity="0.22" stroke="var(--color-primary)" strokeWidth="1.5" />
              {/* Name beside the bubble, on the side that has room, so stacked companies stay readable. */}
              <text x={cx > SIZE * 0.62 ? cx - r - 5 : cx + r + 5} y={cy + 4} textAnchor={cx > SIZE * 0.62 ? 'end' : 'start'} fontSize="11" fontWeight="600" fill="var(--color-foreground)">
                {company.name.length > 20 ? `${company.name.slice(0, 19)}…` : company.name}
              </text>
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10" fill="var(--color-foreground)">
                {company.total ?? ''}
              </text>
            </Link>
          )
        })}
      </svg>
      {placed.length < companies.length && (
        <p className="mt-2 text-xs text-muted-foreground">
          {companies.length - placed.length} compan{companies.length - placed.length === 1 ? 'y is' : 'ies are'} not on the map: not scored on one of these two criteria.
        </p>
      )}
    </div>
  )
}
