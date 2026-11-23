/**
 * Researching one company — runs inside the background job (src/jobs.ts).
 *
 *   1. read the company's website        (firecrawl/scrape)
 *   2. search the last 12 months of news (exa/news-search)
 *   3. score it against the thesis       (openai/chat-completion)
 *   4. verify every quote the model cited (plain code, no AI)
 *   5. save the scorecard and the memo
 *
 * Each step writes to the deal row. The board and the deal page subscribe to
 * it with `useQuery`, so everyone at the desk watches the research happen
 * live — no polling, no custom WebSocket code.
 */

import type { ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { createActionTools } from '../server/action-routes'
import { checkScores, liveProviders, toMemo, toNewsItems, toProfile, type Providers } from './providers'
import { getRow, must, type Row } from './records'
import { sampleProviders } from './sample'
import { weightedScore } from './score'
import { loadDesk } from './start'
import type { Deal, NewsItem } from './types'

const YEAR_MS = 365 * 24 * 60 * 60 * 1000

async function load(env: Env, dealId: string): Promise<{ tools: ActionTools; deal: Row<Deal>; providers: Providers }> {
  // Tools run with RBAC off; the user id only decides who a write is attributed to.
  const deal = await getRow<Deal>(createActionTools(env, env.OWNER_USER_ID, ''), 'deals', dealId)
  if (!deal) throw new Error(`Deal ${dealId} not found`)
  const tools = createActionTools(env, deal.data.addedBy, '')
  return { tools, deal, providers: deal.data.isSample ? sampleProviders : liveProviders(tools) }
}

export async function researchDeal(env: Env, dealId: string): Promise<{ totalScore: number | null; costUsd: number }> {
  const { tools, deal, providers } = await load(env, dealId)
  const log: string[] = ['Research started']
  let costUsd = 0

  /** Update the status line and append to the feed everyone sees. */
  const say = async (status: Deal['status'], step: string) => {
    log.push(step)
    must(await tools.update('deals', dealId, { status, step, log }), 'update deal')
  }

  try {
    await say('reading', `Reading ${deal.data.websiteUrl}`)
    const site = await providers.readWebsite(deal.data.websiteUrl)
    costUsd += site.costUsd

    await say('searching', `Read ${site.value.length} page${site.value.length === 1 ? '' : 's'}. Searching the last 12 months of news`)
    // News is useful but optional: a failed search must not sink the run.
    const since = new Date(Date.now() - YEAR_MS).toISOString()
    const news = await providers.searchNews(deal.data.name, since).catch(() => ({ value: [], costUsd: 0 }))
    costUsd += news.costUsd

    const desk = await loadDesk(tools)
    const sources = [...site.value, ...news.value]
    await say('scoring', `Found ${news.value.length} news item${news.value.length === 1 ? '' : 's'}. Scoring against "${desk.thesisName}"`)
    const analysis = await providers.analyse(deal.data.name, desk, sources)
    costUsd += analysis.costUsd
    if (!analysis.value) throw new Error('The analyst returned an unreadable answer. Run the research again')

    // The model proposes; this code decides what is shown. Quotes that are not
    // word for word in the cited page are dropped, and a score left without a
    // verified quote is removed.
    const scores = checkScores(analysis.value, desk.criteria, sources)
    const claimed = analysis.value.scores?.reduce((n, s) => n + (s.evidence?.length ?? 0), 0) ?? 0
    const kept = scores.reduce((n, s) => n + s.evidence.length, 0)
    log.push(`Verified ${kept} of ${claimed} quotes against their source`)

    const totalScore = weightedScore(scores, desk.criteria)
    const now = new Date().toISOString()
    must(
      await tools.update('deals', dealId, {
        status: 'done',
        step: 'Scorecard ready',
        log,
        profile: toProfile(analysis.value),
        memo: toMemo(analysis.value),
        scores,
        totalScore,
        news: toNewsItems(news.value),
        costUsd,
        researchedAt: now,
        newsCheckedAt: now,
        // A fresh scorecard moves a newly sourced company into screening.
        stage: deal.data.stage === 'sourced' ? 'screening' : deal.data.stage,
        error: '',
      }),
      'save scorecard',
    )
    return { totalScore, costUsd }
  } catch (error) {
    // Leave an honest trace on the board instead of a spinner that never ends.
    const message = error instanceof Error ? error.message : String(error)
    await tools.update('deals', dealId, { status: 'failed', step: 'Research failed', log: [...log, `Failed: ${message}`], error: message, costUsd })
    throw error
  }
}

/**
 * Weekly watch for one deal: fetch headlines published since the last check
 * and put the ones we have not seen at the top, flagged as new.
 * Returns the new headlines (empty when nothing changed).
 */
export async function watchDealNews(env: Env, dealId: string): Promise<NewsItem[]> {
  const { tools, deal, providers } = await load(env, dealId)
  const since = deal.data.newsCheckedAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const found = toNewsItems((await providers.searchNews(deal.data.name, since)).value)
  const known = new Set((deal.data.news ?? []).map((n) => n.url))
  const fresh = found.filter((n) => !known.has(n.url)).map((n) => ({ ...n, isNew: true }))
  const older = (deal.data.news ?? []).map((n) => ({ ...n, isNew: false }))
  must(
    await tools.update('deals', dealId, { news: [...fresh, ...older].slice(0, 12), newsCheckedAt: new Date().toISOString() }),
    'save news',
  )
  return fresh
}
