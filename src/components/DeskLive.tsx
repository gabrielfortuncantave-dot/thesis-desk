/**
 * The two "someone else is here" pieces of the board: the activity feed and
 * the presence line. Both are realtime and neither needs code on the server
 * beyond the `activity` rows the actions already write.
 */

import { Link } from 'react-router-dom'
import { usePresenceRoom, useQuery } from 'deepspace'
import { SCOPE_ID } from '../constants'
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

/** Who else has the desk open right now. Rendered for signed-in members only. */
export function PresenceLine() {
  const { peers } = usePresenceRoom(SCOPE_ID)
  // First names only, and no anonymous visitors: the line is about colleagues.
  const names = [...new Set(peers.filter((p) => !p.userId.startsWith('anon-')).map((p) => p.userName.split(/[\s@]/)[0]).filter(Boolean))]
  if (names.length === 0) return null
  return (
    <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground" data-testid="presence-line">
      <span className="h-2 w-2 rounded-full bg-positive" aria-hidden="true" />
      Also at the desk now: {names.slice(0, 5).join(', ')}
      {names.length > 5 && ` and ${names.length - 5} more`}
    </p>
  )
}
