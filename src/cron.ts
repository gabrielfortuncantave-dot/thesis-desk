/**
 * Scheduled tasks — registered into AppCronRoom (worker.ts).
 *
 * `weekly-news-watch`: every Monday at 08:00 Paris time, look for new
 * headlines on the companies in Screening or Committee, flag them on the
 * board, and email each member a digest of the companies they added.
 * A scorecard is a snapshot; a funding round or a lawsuit the week after
 * changes the picture, and nobody re-reads a pipeline by hand.
 */

import type { CronTask } from 'deepspace/worker'
import { buildCronContext } from 'deepspace/worker'
import type { Env } from '../worker'
import { digestEmailText, sendEmail, type WatchedDeal } from './desk/email'
import { getRow, type Row } from './desk/records'
import { watchDealNews } from './desk/research'
import type { Deal } from './desk/types'
import { createActionTools } from './server/action-routes'

/** Hard cap per run: each company watched is one paid news search. */
const MAX_WATCHED = 8

export const tasks: CronTask[] = [{ name: 'weekly-news-watch', schedule: '0 8 * * 1', timezone: 'Europe/Paris' }]

export async function runTask(name: string, env: Env): Promise<void> {
  if (name !== 'weekly-news-watch') return

  // Runs as the app owner, RBAC off. Scope by the immutable app id.
  const ctx = buildCronContext(env, env.OWNER_USER_ID, `app:${env.DEEPSPACE_APP_ID}`)
  const deals = (await ctx.records.query('deals', { limit: 200 })) as Row<Deal>[]
  const watched = deals
    .filter((d) => d.data.status === 'done' && !d.data.isSample && ['screening', 'committee'].includes(d.data.stage))
    .slice(0, MAX_WATCHED)

  // Group what is new by the member who added the company.
  const byMember = new Map<string, WatchedDeal[]>()
  for (const deal of watched) {
    try {
      const fresh = await watchDealNews(env, deal.recordId)
      const list = byMember.get(deal.data.addedBy) ?? []
      list.push({ dealId: deal.recordId, name: deal.data.name, fresh })
      byMember.set(deal.data.addedBy, list)
    } catch (error) {
      // One company failing must not stop the others.
      console.warn(`[cron] news watch failed for ${deal.data.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  let sent = 0
  const tools = createActionTools(env, env.OWNER_USER_ID, '')
  for (const [memberId, list] of byMember) {
    const email = digestEmailText(env.APP_NAME, list)
    // The address comes from the member's verified account, never from user input.
    const user = await getRow<{ email?: string }>(tools, 'users', memberId)
    if (!email || !user?.data.email) continue
    await sendEmail(tools, user.data.email, email.subject, email.text)
    sent += 1
  }
  console.info(`[cron] weekly-news-watch checked ${watched.length} companies, sent ${sent} digests`)
}
