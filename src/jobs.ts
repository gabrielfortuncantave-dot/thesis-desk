/**
 * Background jobs — run by AppJobRoom (worker.ts), outside any HTTP request.
 *
 * Researching a company takes 20 to 60 seconds (website, news, analysis),
 * longer than a request should hang and longer than `waitUntil` allows, so it
 * runs here. Jobs are only ever queued by the server (src/desk/start.ts),
 * after the spend limits have been checked.
 */

import type { Job, JobContext } from 'deepspace/worker'
import type { Env } from '../worker'
import { researchDeal } from './desk/research'

export async function runJob(job: Job, ctx: JobContext, env: Env): Promise<unknown> {
  switch (job.type) {
    case 'research-deal': {
      const { dealId } = (job.payload ?? {}) as { dealId?: string }
      if (!dealId) throw new Error('research-deal is missing its dealId')
      ctx.progress(0.05, 'Research started')
      return await researchDeal(env, dealId)
    }
    default:
      // Fail loudly so an unknown type shows up in the failed list.
      throw new Error(`Unknown job type: ${job.type}`)
  }
}
