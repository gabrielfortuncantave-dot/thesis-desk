/**
 * Two or three companies side by side: overlaid radar, criterion by criterion,
 * and how each one fits the thesis. Pure reading: it subscribes to the same
 * `deals` rows as the board, so a score that changes updates here too.
 */

import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from 'deepspace'
import { RadarChart, SERIES_STYLE, StageChip, scoreTone } from '../../components/Score'
import { useDesk, usePlaybook } from '../../lib/desk'
import { weightedScore } from '../../desk/score'
import type { Deal } from '../../desk/types'

export default function ComparePage() {
  const [params] = useSearchParams()
  const ids = (params.get('ids') ?? '').split(',').filter(Boolean).slice(0, 3)
  const desk = useDesk()
  const words = usePlaybook()
  const deals = useQuery<Deal>('deals', { limit: 200 })
  // Keep the order the visitor ticked them in.
  const chosen = ids.map((id) => deals.records.find((d) => d.recordId === id)).filter((d) => d !== undefined)

  if (deals.status === 'loading') return <div className="mx-auto max-w-5xl px-6 py-12 text-sm text-muted-foreground">Loading…</div>
  if (chosen.length < 2) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-12 text-sm text-muted-foreground">
        <p>Tick two or three researched targets on the pipeline to compare them.</p>
        <Link to="/desk" className="mt-4 inline-block underline underline-offset-4">
          Back to the pipeline
        </Link>
      </div>
    )
  }

  const totals = chosen.map((d) => weightedScore(d.data.scores ?? [], desk.criteria))
  const scoreOf = (deal: Deal, key: string) => (deal.scores ?? []).find((s) => s.key === key)?.score
  /** The best score on a line is marked, so the eye lands on who wins each criterion. */
  const isBest = (values: (number | null | undefined)[], i: number) => {
    const numbers = values.filter((v): v is number => typeof v === 'number')
    return typeof values[i] === 'number' && numbers.length > 1 && values[i] === Math.max(...numbers) && numbers.filter((v) => v === values[i]).length === 1
  }

  return (
    <div className="min-h-full text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link to="/desk" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Pipeline
        </Link>
        <h1 className="font-display mt-4 text-4xl">Side by side</h1>
        <p className="mt-2 text-sm text-muted-foreground">Scored against “{desk.thesisName}” with the desk’s saved weights.</p>

        <div className="mt-8 grid items-center gap-8 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div className="flex justify-center">
            <RadarChart series={chosen.map((d) => ({ name: d.data.name, scores: d.data.scores ?? [] }))} criteria={desk.criteria} />
          </div>
          <ul className="space-y-4" data-testid="compare-legend">
            {chosen.map((d, n) => (
              <li key={d.recordId} className="flex items-center gap-4">
                <svg width="34" height="10" aria-hidden="true">
                  <line x1="0" y1="5" x2="34" y2="5" stroke={SERIES_STYLE[n].colour} strokeWidth="3" strokeDasharray={SERIES_STYLE[n].dash} />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <Link to={`/deal/${d.recordId}`} className="font-display text-xl underline-offset-4 hover:underline">
                      {d.data.name}
                    </Link>
                    <StageChip stage={d.data.stage} label={words.stageLabels[d.data.stage]} />
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{d.data.profile?.oneLiner}</p>
                </div>
                <p className={`font-display text-3xl tabular-nums ${scoreTone(totals[n], 100)}`}>{totals[n] ?? 'n/a'}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 overflow-x-auto rounded-md border border-border bg-card">
          <table className="w-full min-w-[36rem] text-left text-sm" data-testid="compare-table">
            <thead className="text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Criterion</th>
                <th className="px-4 py-3 font-medium">Weight</th>
                {chosen.map((d) => (
                  <th key={d.recordId} className="px-4 py-3 font-medium text-foreground">
                    {d.data.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {desk.criteria.map((c) => {
                const values = chosen.map((d) => scoreOf(d.data, c.key))
                return (
                  <tr key={c.key} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{c.label}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{c.weight}</td>
                    {values.map((v, i) => (
                      <td key={chosen[i].recordId} className={`px-4 py-3 tabular-nums ${isBest(values, i) ? 'font-semibold' : ''}`}>
                        {typeof v === 'number' ? `${v}/10` : <span className="text-muted-foreground">Not scored</span>}
                        {isBest(values, i) && <span className="ml-2 text-xs text-positive">best</span>}
                      </td>
                    ))}
                  </tr>
                )
              })}
              <tr className="border-t-2 border-border">
                <td className="px-4 py-3 font-medium" colSpan={2}>
                  Weighted total
                </td>
                {totals.map((t, i) => (
                  <td key={chosen[i].recordId} className={`font-display px-4 py-3 text-xl tabular-nums ${scoreTone(t, 100)}`}>
                    {t ?? 'n/a'}
                    {typeof t === 'number' && <span className="text-sm text-muted-foreground">/100</span>}
                  </td>
                ))}
              </tr>
              {(
                [
                  ['Business model', (d: Deal) => d.profile?.businessModel],
                  ['Customers', (d: Deal) => d.profile?.customers],
                  ['Headquarters', (d: Deal) => d.profile?.headquarters],
                  ['Founded', (d: Deal) => d.profile?.founded],
                  ['Fit with the thesis', (d: Deal) => d.memo?.fit],
                  ['First risk', (d: Deal) => d.memo?.risks?.[0]],
                ] as const
              ).map(([label, read]) => (
                <tr key={label} className="border-t border-border align-top">
                  <td className="px-4 py-3 font-medium" colSpan={2}>
                    {label}
                  </td>
                  {chosen.map((d) => (
                    <td key={d.recordId} className="px-4 py-3 text-muted-foreground">
                      {read(d.data) || '–'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
