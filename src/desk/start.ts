/**
 * Queueing research, and the spend limits in front of it.
 *
 * Researching one company spends the app owner's DeepSpace credits (about
 * $0.10), so two limits apply before a job is queued:
 *   - per user:  MAX_USER_RUNS_PER_DAY research runs per rolling 24 hours;
 *   - whole app: MAX_APP_RUNS_PER_DAY, so no crowd can drain the balance.
 * The sample company costs nothing and is not counted.
 */

import { enqueueJob } from 'deepspace/worker'
import type { ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { scoutCompanies } from './providers'
import { DEFAULT_DESK, type Deal, type Desk } from './types'
import { getRow, listRows, must, type Row } from './records'

export const MAX_USER_RUNS_PER_DAY = 3
export const MAX_APP_RUNS_PER_DAY = 12
const DAY_MS = 24 * 60 * 60 * 1000

/** The shared desk lives in one row with a fixed id. */
export const DESK_ID = 'main'

export async function loadDesk(tools: ActionTools): Promise<Desk> {
  const row = await getRow<Desk>(tools, 'desk', DESK_ID)
  return row?.data.criteria?.length ? row.data : DEFAULT_DESK
}

/** Returns a sentence to show the user when a limit is hit, or null when research may start. */
export async function limitReached(tools: ActionTools, userId: string, now = Date.now()): Promise<string | null> {
  const recent = (await listRows<Deal>(tools, 'deals', { orderBy: 'createdAt', orderDir: 'desc', limit: 80 })).filter(
    (d) => !d.data.isSample && now - Date.parse(d.data.startedAt) < DAY_MS,
  )
  if (recent.filter((d) => d.data.addedBy === userId).length >= MAX_USER_RUNS_PER_DAY) {
    return `You have used your ${MAX_USER_RUNS_PER_DAY} research runs for today. The sample company is always free.`
  }
  if (recent.length >= MAX_APP_RUNS_PER_DAY) {
    return 'The desk has reached its daily research budget. Try the sample company, or come back tomorrow.'
  }
  return null
}

/** Mark the deal as queued (everyone on the board sees it at once) and queue the background job. */
export async function queueResearch(env: Env, tools: ActionTools, deal: Row<Deal>): Promise<void> {
  must(
    await tools.update('deals', deal.recordId, {
      status: 'queued',
      step: 'Waiting for an analyst',
      log: ['Research queued'],
      startedAt: new Date().toISOString(),
      error: '',
    }),
    'queue research',
  )
  await enqueueJob(env.JOB_ROOMS, `app:${env.DEEPSPACE_APP_ID}`, 'research-deal', { dealId: deal.recordId }, { enqueuedBy: deal.data.addedBy })
}

/**
 * The scout: search the web for companies that match the thesis and keep the
 * ones that are not on the desk yet. One paid search, shared by every visitor
 * because the result is saved on the desk row.
 */
export async function scoutDesk(tools: ActionTools): Promise<number> {
  const desk = await loadDesk(tools)
  const found = await scoutCompanies(tools, desk)
  const onDesk = new Set((await listRows<Deal>(tools, 'deals', { limit: 200 })).map((d) => hostOf(d.data.websiteUrl)))
  const suggestions = found.value.filter((s) => !onDesk.has(hostOf(s.websiteUrl))).slice(0, 6)
  must(await tools.create('desk', { ...desk, suggestions, scoutedAt: new Date().toISOString() }, DESK_ID), 'save suggestions')
  return suggestions.length
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}
