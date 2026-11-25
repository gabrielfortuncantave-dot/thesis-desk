/**
 * Server actions — the only way anyone changes data on the desk.
 *
 * Action tools run with per-record RBAC OFF (see src/server/action-routes.ts),
 * so each action below decides for itself who may do what:
 *   - any signed-in member: add a target, move a stage, vote;
 *   - the member who added a company, or an admin: re-run research, reveal votes, delete;
 *   - an admin only: change the thesis.
 */

import { resolveAppRole } from 'deepspace/worker'
import type { ActionHandler, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { logActivity } from '../desk/activity'
import { createRow, getRow, listRows, must, type Row } from '../desk/records'
import { tally, weightedScore } from '../desk/score'
import { DESK_ID, limitReached, loadDesk, queueResearch, scoutDesk } from '../desk/start'
import { SAMPLE_COMPANY, STAGES, isSampleUrl, playbookOf, type Criterion, type Deal, type Desk, type Stage, type Vote } from '../desk/types'
import { cleanText, cleanWebsiteUrl } from '../desk/validate'

const fail = (error: string) => ({ success: false as const, error })

async function findDeal(tools: ActionTools, dealId: unknown): Promise<Row<Deal> | null> {
  return typeof dealId === 'string' && dealId ? getRow<Deal>(tools, 'deals', dealId) : null
}

/** The member who added the company, or an admin. */
async function mayManage(env: Env, userId: string, deal: Row<Deal>): Promise<boolean> {
  return deal.data.addedBy === userId || (await resolveAppRole(env, userId)) === 'admin'
}

/** First name only: the board is public, so no email address is ever written to a deal or a vote. */
async function displayName(tools: ActionTools, userId: string): Promise<string> {
  const user = await getRow<{ name?: string }>(tools, 'users', userId)
  const first = cleanText(user?.data.name, 40).split(' ')[0]
  return first ? first[0].toUpperCase() + first.slice(1) : 'Member'
}

export const actions: Record<string, ActionHandler<Env>> = {
  /** Add a company to the pipeline and research it. */
  addDeal: async ({ userId, params, tools, env }) => {
    const sample = params.sample === true
    const who = await displayName(tools, userId)
    const name = sample ? SAMPLE_COMPANY.name : cleanText(params.name, 80)
    const websiteUrl = sample ? SAMPLE_COMPANY.websiteUrl : cleanWebsiteUrl(params.websiteUrl)
    if (!name) return fail('Enter the company name.')
    if (!websiteUrl) return fail('Enter the address of the company website, for example https://www.company.com')

    const all = await listRows<Deal>(tools, 'deals', { limit: 200 })
    // One row per company on a shared board; the sample is one per member.
    const existing = all.find((d) => d.data.websiteUrl === websiteUrl && (!sample || d.data.addedBy === userId))
    if (existing && !sample) return { success: true, data: { dealId: existing.recordId, alreadyOnDesk: true } }
    if (existing) {
      await queueResearch(env, tools, existing)
      return { success: true, data: { dealId: existing.recordId, alreadyOnDesk: false } }
    }

    if (!sample) {
      const refusal = await limitReached(tools, userId)
      if (refusal) return fail(refusal)
    }

    const deal: Deal = {
      addedBy: userId,
      addedByName: who,
      name,
      websiteUrl,
      stage: 'sourced',
      status: 'queued',
      step: 'Waiting for an analyst',
      log: [],
      profile: null,
      scores: [],
      totalScore: null,
      previousScore: null,
      memo: null,
      bull: [],
      bear: [],
      news: [],
      isSample: sample ? 1 : 0,
      costUsd: 0,
      startedAt: new Date().toISOString(),
      researchedAt: '',
      newsCheckedAt: '',
      voting: 'open',
      voteCount: 0,
      error: '',
    }
    const dealId = await createRow(tools, 'deals', deal as unknown as Record<string, unknown>)
    await queueResearch(env, tools, { recordId: dealId, data: deal })
    await logActivity(tools, { actorName: who, kind: 'added', dealId, dealName: name, detail: '' })
    return { success: true, data: { dealId, alreadyOnDesk: false } }
  },

  /** Research a company again (new website content, new news). */
  rerunResearch: async ({ userId, params, tools, env }) => {
    const deal = await findDeal(tools, params.dealId)
    if (!deal) return fail('Company not found.')
    if (!(await mayManage(env, userId, deal))) return fail('Only the member who added this company, or an admin, can re-run its research.')
    if (!['done', 'failed'].includes(deal.data.status)) return fail('Research is already running.')
    if (!deal.data.isSample) {
      const refusal = await limitReached(tools, userId)
      if (refusal) return fail(refusal)
    }
    await queueResearch(env, tools, deal)
    return { success: true, data: { dealId: deal.recordId } }
  },

  /** Move a company along the pipeline. */
  setStage: async ({ userId, params, tools }) => {
    const deal = await findDeal(tools, params.dealId)
    if (!deal) return fail('Company not found.')
    const target = STAGES.find((s) => s.id === params.stage)
    if (!target) return fail('Unknown stage.')
    const stage: Stage = target.id
    const words = playbookOf(await loadDesk(tools))
    if (stage === deal.data.stage) return { success: true, data: { stage } }
    must(await tools.update('deals', deal.recordId, { stage }), 'set stage')
    await logActivity(tools, { actorName: await displayName(tools, userId), kind: 'stage', dealId: deal.recordId, dealName: deal.data.name, detail: words.stageLabels[stage] })
    return { success: true, data: { stage } }
  },

  /** Lock in (or change) your vote. It stays hidden from everyone else until the reveal. */
  castVote: async ({ userId, params, tools }) => {
    const deal = await findDeal(tools, params.dealId)
    if (!deal) return fail('Company not found.')
    if (deal.data.status !== 'done') return fail('Wait for the scorecard before voting.')
    if (deal.data.voting === 'revealed') return fail('Votes are already revealed. The vote is closed.')

    const decision = params.decision === 'invest' || params.decision === 'pass' ? params.decision : null
    const conviction = Math.round(Number(params.conviction))
    const reason = cleanText(params.reason, 400)
    if (!decision) return fail('Choose one of the two decisions.')
    if (!(conviction >= 1 && conviction <= 5)) return fail('Conviction goes from 1 to 5.')
    if (reason.length < 10) return fail('Give your reason in a sentence. A vote without a reason is not counted.')

    const who = await displayName(tools, userId)
    const before = await listRows<Vote>(tools, 'votes', { where: { dealId: deal.recordId }, limit: 200 })
    const mine = before.find((v) => v.data.voterId === userId)
    if (mine) {
      must(await tools.update('votes', mine.recordId, { decision, conviction, reason }), 'update vote')
    } else {
      const vote: Vote = { dealId: deal.recordId, voterId: userId, voterName: who, decision, conviction, reason, revealed: 'no' }
      await createRow(tools, 'votes', vote as unknown as Record<string, unknown>)
    }
    // Count again AFTER the write: two members voting in the same second must not both write "1".
    const after = await listRows<Vote>(tools, 'votes', { where: { dealId: deal.recordId }, limit: 200 })
    must(await tools.update('deals', deal.recordId, { voteCount: after.length }), 'update vote count')
    // The feed says THAT someone voted, never HOW.
    if (!mine) await logActivity(tools, { actorName: who, kind: 'voted', dealId: deal.recordId, dealName: deal.data.name, detail: '' })
    return { success: true, data: { changed: Boolean(mine) } }
  },

  /** Close the vote and show every ballot to everyone, all at once. */
  revealVotes: async ({ userId, params, tools, env }) => {
    const deal = await findDeal(tools, params.dealId)
    if (!deal) return fail('Company not found.')
    if (!(await mayManage(env, userId, deal))) return fail('Only the member who added this company, or an admin, can reveal the votes.')
    if (deal.data.voting === 'revealed') return fail('Votes are already revealed.')
    const votes = await listRows<Vote>(tools, 'votes', { where: { dealId: deal.recordId }, limit: 200 })
    if (votes.length === 0) return fail('Nobody has voted yet.')
    // Close first, so a vote cast during the reveal is refused rather than half-counted.
    must(await tools.update('deals', deal.recordId, { voting: 'revealed', stage: 'committee' }), 'close vote')
    for (const vote of votes) must(await tools.update('votes', vote.recordId, { revealed: 'yes' }), 'reveal vote')
    const result = tally(votes.map((v) => v.data))
    const words = playbookOf(await loadDesk(tools))
    await logActivity(tools, {
      actorName: await displayName(tools, userId),
      kind: 'revealed',
      dealId: deal.recordId,
      dealName: deal.data.name,
      detail: `${words.yes} ${result.invest}, ${words.no} ${result.pass}`,
    })
    return { success: true, data: { revealed: votes.length } }
  },

  /** Remove a company and its votes from the desk. */
  deleteDeal: async ({ userId, params, tools, env }) => {
    const deal = await findDeal(tools, params.dealId)
    if (!deal) return fail('Company not found.')
    if (!(await mayManage(env, userId, deal))) return fail('Only the member who added this company, or an admin, can remove it.')
    must(await tools.deleteWhere('votes', { dealId: deal.recordId }, 500), 'delete votes')
    must(await tools.remove('deals', deal.recordId), 'delete deal')
    await logActivity(tools, { actorName: await displayName(tools, userId), kind: 'removed', dealId: '', dealName: deal.data.name, detail: '' })
    return { success: true, data: { deleted: true } }
  },

  /** Change the thesis for everyone and re-rank the whole pipeline with the new weights. Admin only. */
  saveThesis: async ({ userId, params, tools, env }) => {
    if ((await resolveAppRole(env, userId)) !== 'admin') return fail('Only an admin can change the desk thesis.')
    const current = await loadDesk(tools)
    const input = Array.isArray(params.criteria) ? (params.criteria as Record<string, unknown>[]) : []
    // Keys are fixed: scores already stored are tied to them. Labels, guides and weights may change.
    const criteria: Criterion[] = current.criteria.map((c) => {
      const next = input.find((i) => i.key === c.key)
      const weight = Math.round(Number(next?.weight))
      return {
        key: c.key,
        label: cleanText(next?.label, 40) || c.label,
        guide: cleanText(next?.guide, 240) || c.guide,
        weight: weight >= 0 && weight <= 10 ? weight : c.weight,
      }
    })
    if (criteria.every((c) => c.weight === 0)) return fail('At least one criterion needs a weight above zero.')
    const desk: Desk = {
      ...current,
      thesisName: cleanText(params.thesisName, 60) || current.thesisName,
      thesisText: cleanText(params.thesisText, 600) || current.thesisText,
      scoutQuery: cleanText(params.scoutQuery, 400) || current.scoutQuery,
      criteria,
    }
    must(await tools.create('desk', desk as unknown as Record<string, unknown>, DESK_ID), 'save thesis')
    const deals = await listRows<Deal>(tools, 'deals', { limit: 200 })
    for (const deal of deals) {
      if (!deal.data.scores?.length) continue
      must(await tools.update('deals', deal.recordId, { totalScore: weightedScore(deal.data.scores, criteria) }), 're-rank deal')
    }
    await logActivity(tools, { actorName: await displayName(tools, userId), kind: 'thesis', dealId: '', dealName: '', detail: '' })
    return { success: true, data: { reranked: deals.length } }
  },

  /** Search the web for companies matching the thesis and show them on the board. Admin only: it is a paid search. */
  scoutNow: async ({ userId, tools, env }) => {
    if ((await resolveAppRole(env, userId)) !== 'admin') return fail('Only an admin can run the scout. It also runs by itself every Monday.')
    try {
      return { success: true, data: { found: await scoutDesk(tools) } }
    } catch (error) {
      return fail(`The scout could not search: ${error instanceof Error ? error.message : String(error)}`)
    }
  },
}
