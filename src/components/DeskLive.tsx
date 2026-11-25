/**
 * The desk's activity feed. It is a realtime subscription to the `activity`
 * rows the server actions write, so it needs no code of its own on the server.
 */

import { Link } from 'react-router-dom'
import { useQuery } from 'deepspace'
import type { Activity } from '../desk/types'

/** "3 min ago", "2 h ago", "yesterday"… good enough for a feed. */
export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

export function ActivityFeed() {
  const feed = useQuery<Activity>('activity', { orderBy: 'createdAt', orderDir: 'desc', limit: 8 })
  if (feed.records.length === 0) return null
  return (
    <section aria-labelledby="activity-title" className="rounded-md border border-border bg-card p-5" data-testid="activity-feed">
      <h2 id="activity-title" className="font-display text-lg">
        Desk activity
      </h2>
      <ol className="mt-3 space-y-2.5 text-sm">
        {feed.records.map((row) => {
          const a = row.data
          return (
            <li key={row.recordId} data-testid="activity-row" data-kind={a.kind}>
              <span className="font-medium">{a.actorName}</span> <Sentence activity={a} />
              <span className="text-muted-foreground"> · {timeAgo(a.at)}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** One plain sentence per kind of event. `detail` only carries the variable part. */
function Sentence({ activity: a }: { activity: Activity }) {
  const deal = <DealName activity={a} />
  switch (a.kind) {
    case 'added':
      return <>added {deal}</>
    case 'scored':
      return (
        <>
          scored {deal} {a.detail}
        </>
      )
    case 'failed':
      return <>could not finish the research on {deal}</>
    case 'stage':
      return (
        <>
          moved {deal} to {a.detail}
        </>
      )
    case 'voted':
      return <>locked a vote on {deal}</>
    case 'revealed':
      return (
        <>
          revealed the vote on {deal}: {a.detail}
        </>
      )
    case 'removed':
      return <>removed {deal}</>
    case 'thesis':
      return <>changed the thesis, and the pipeline was re-ranked</>
    default:
      return <>{a.detail}</>
  }
}

function DealName({ activity }: { activity: Activity }) {
  // A removed company has no page to link to.
  return activity.dealId ? (
    <Link to={`/deal/${activity.dealId}`} className="underline underline-offset-2">
      {activity.dealName}
    </Link>
  ) : (
    <span>{activity.dealName}</span>
  )
}
