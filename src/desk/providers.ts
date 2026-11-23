/**
 * The external boundary of a research run: every paid third-party call lives here.
 *
 * `Providers` is one small interface with two implementations:
 *   - `liveProviders(tools)` calls DeepSpace integrations (billed to the app owner);
 *   - `sampleProviders` (sample.ts) returns canned material, so the sample
 *     company and the tests run the whole pipeline without spending a credit.
 * The pipeline (research.ts) does not know which one it is using.
 */

import type { ActionTools } from 'deepspace/worker'
import type { Criterion, CriterionScore, Desk, Evidence, Memo, NewsItem, Profile } from './types'

/** A result plus what the call cost, so each deal can report its own spend. */
export interface Paid<T> {
  value: T
  costUsd: number
}

/** A page we read: the company's own site (S1, S2…) or a news article (N1, N2…). */
export interface Source {
  id: string
  url: string
  title: string
  text: string
}

/** What the model sends back, before the server has checked a single quote. */
export interface RawAnalysis {
  profile: Partial<Profile> | null
  scores: { key?: string; score?: number | null; rationale?: string; evidence?: { source?: string; quote?: string }[] }[]
  memo: Partial<Memo> | null
}

export interface Providers {
  /** Read the company's own website (home page plus up to two useful pages). */
  readWebsite(url: string): Promise<Paid<Source[]>>
  /** Recent news about the company, optionally only since a date (ISO). */
  searchNews(companyName: string, since: string): Promise<Paid<Source[]>>
  /** Score the company against the thesis, citing quotes from the sources. */
  analyse(companyName: string, desk: Desk, sources: Source[]): Promise<Paid<RawAnalysis | null>>
}

const ANALYST_MODEL = 'gpt-5.4-mini'
const MAX_SITE_PAGE_CHARS = 6000
const MAX_NEWS_CHARS = 1500
/** Pages likely to describe the business, in English or French. */
const USEFUL_PAGE = /(about|company|product|platform|solution|pricing|customers|a-propos|entreprise|produit|tarif|clients)/i

interface ScrapeResponse {
  data?: { markdown?: string; links?: string[]; metadata?: { title?: string } }
  costUsd?: number
}
interface NewsResponse {
  results?: { title?: string; url?: string; publishedDate?: string | null; summary?: unknown; text?: unknown }[]
  costUsd?: number
}
interface ChatResponse {
  choices?: { message?: { content?: string } }[]
  costUsd?: number
}

export function liveProviders(tools: ActionTools): Providers {
  /** Call an integration and throw a readable error instead of returning a failed envelope. */
  async function call<T>(endpoint: string, body: unknown): Promise<T> {
    const r = await tools.integration<T>(endpoint, body)
    if (!r.success) throw new Error(`${endpoint} failed: ${r.error}`)
    return r.data
  }

  async function scrape(url: string, withLinks: boolean) {
    const r = await call<ScrapeResponse>('firecrawl/scrape', {
      url,
      formats: withLinks ? ['markdown', 'links'] : ['markdown'],
      onlyMainContent: false,
    })
    return {
      text: (r.data?.markdown ?? '').slice(0, MAX_SITE_PAGE_CHARS),
      title: r.data?.metadata?.title ?? url,
      links: r.data?.links ?? [],
      costUsd: r.costUsd ?? 0,
    }
  }

  return {
    async readWebsite(url) {
      const home = await scrape(url, true)
      const extra = pickUsefulLinks(url, home.links)
      // A failed sub-page must not fail the run: the home page is enough to go on.
      const pages = await Promise.allSettled(extra.map((link) => scrape(link, false)))
      const sources: Source[] = [{ id: 'S1', url, title: home.title, text: home.text }]
      let costUsd = home.costUsd
      pages.forEach((page, i) => {
        if (page.status !== 'fulfilled') return
        sources.push({ id: `S${sources.length + 1}`, url: extra[i], title: page.value.title, text: page.value.text })
        costUsd += page.value.costUsd
      })
      return { value: sources, costUsd }
    },

    async searchNews(companyName, since) {
      // Exa search is semantic: on a narrow date window it happily returns ShopBack or
      // Backcountry for "Back Market". `includeText` asks Exa for pages that contain the
      // name, and `mentionsCompany` checks it again here, because a digest full of
      // unrelated companies is worse than an empty one.
      const r = await call<NewsResponse>('exa/news-search', {
        query: `${companyName} company`,
        numResults: 6,
        from: since.slice(0, 10),
        includeText: [companyName],
      })
      const sources: Source[] = []
      for (const item of r.results ?? []) {
        if (!item.url || !item.title) continue
        const body = [item.title, asText(item.summary), asText(item.text)].join('\n')
        if (!mentionsCompany(companyName, body)) continue
        const text = body.slice(0, MAX_NEWS_CHARS)
        // The article date travels in the title so it survives into the stored news item.
        sources.push({ id: `N${sources.length + 1}`, url: item.url, title: `${item.title} (${(item.publishedDate ?? '').slice(0, 10)})`, text })
      }
      return { value: sources, costUsd: r.costUsd ?? 0 }
    },

    async analyse(companyName, desk, sources) {
      const r = await call<ChatResponse>('openai/chat-completion', {
        model: ANALYST_MODEL,
        temperature: 0,
        max_tokens: 2400,
        messages: [
          { role: 'system', content: analystInstructions(desk) },
          { role: 'user', content: JSON.stringify({ company: companyName, sources: sources.map(({ id, title, text }) => ({ id, title, text })) }) },
        ],
      })
      return { value: parseJson(r.choices?.[0]?.message?.content ?? '') as RawAnalysis | null, costUsd: r.costUsd ?? 0 }
    },
  }
}

/* ---- Pure helpers (exported for unit tests) ---- */

export function analystInstructions(desk: Desk): string {
  const criteria = desk.criteria.map((c) => `- "${c.key}" (${c.label}): ${c.guide}`).join('\n')
  return [
    'You are a private equity analyst screening a company against an investment thesis.',
    'You may ONLY use the sources given in the user message. Never use outside knowledge and never invent a number.',
    `Thesis: ${desk.thesisText}`,
    'Criteria to score from 0 (no fit) to 10 (excellent fit):',
    criteria,
    'Reply with one JSON object and nothing else:',
    '{"profile":{"oneLiner","sector","businessModel","customers","headquarters","founded","size"},',
    ' "scores":[{"key","score","rationale","evidence":[{"source","quote"}]}],',
    ' "memo":{"summary","fit","risks":[],"questions":[]}}',
    'Rules:',
    '- One "scores" entry per criterion key. "rationale" is at most two sentences.',
    '- "evidence": one or two items. "source" is a source id (S1, N2…). "quote" is 8 to 30 words copied EXACTLY, character for character, from that source.',
    '- If no source supports a criterion, set "score" to null, "evidence" to [] and say so in "rationale".',
    '- Ignore news items that are about a different company with a similar name.',
    '- Profile fields are short strings; use "" when the sources do not say.',
    '- "summary": three sentences on what the company does. "fit": two plain declarative sentences on how it fits the thesis; if the sources do not confirm a part of the thesis, state that in its own sentence. Never write a question in "summary" or "fit".',
    '- "risks": three short risks. "questions": three questions to ask management, on what the sources leave open.',
  ].join('\n')
}

/** Up to two same-site pages that probably describe the business. */
export function pickUsefulLinks(homeUrl: string, links: string[]): string[] {
  let host: string
  try {
    host = new URL(homeUrl).host
  } catch {
    return []
  }
  const seen = new Set<string>([homeUrl.replace(/\/$/, '')])
  const picked: string[] = []
  for (const link of links) {
    let u: URL
    try {
      u = new URL(link)
    } catch {
      continue
    }
    const clean = (u.origin + u.pathname).replace(/\/$/, '')
    if (u.host !== host || seen.has(clean) || !USEFUL_PAGE.test(u.pathname)) continue
    seen.add(clean)
    picked.push(clean)
    if (picked.length === 2) break
  }
  return picked
}

/** Models sometimes wrap JSON in a ```json fence; accept that, return null on anything else. */
export function parseJson(text: string): unknown {
  const stripped = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  try {
    return JSON.parse(stripped)
  } catch {
    return null
  }
}

/** True when the text names the company as whole words ("Back Market", not "ShopBack" or "Backcountry"). */
export function mentionsCompany(companyName: string, text: string): boolean {
  const words = companyName.trim().split(/\s+/).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (words.length === 0 || !words[0]) return false
  // Words of the name in order, separated by spaces or nothing ("Back Market" also matches "BackMarket").
  return new RegExp(`(^|[^\\p{L}\\p{N}])${words.join('\\s*')}($|[^\\p{L}\\p{N}])`, 'iu').test(text)
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** Lower-case, drop Markdown marks and punctuation, collapse spaces: "the same words in the same order". */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[*_#`>\[\]()|]/g, ' ')
    .replace(/[“”«»"]/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The anti-hallucination step. A quote is kept only if its words appear, in
 * order, in the source it cites. Everything else the model "quoted" is dropped.
 */
export function verifyQuote(quote: string, source: Source | undefined): boolean {
  if (!source) return false
  const needle = normalise(quote)
  return needle.length >= 20 && normalise(source.text).includes(needle)
}

/**
 * Turn the model's reply into scores we are willing to show:
 * - always one entry per criterion of the thesis, in the thesis order;
 * - only verified quotes are kept;
 * - a score with no verified quote behind it becomes null ("not scored").
 */
export function checkScores(raw: RawAnalysis | null, criteria: Criterion[], sources: Source[]): CriterionScore[] {
  const byId = new Map(sources.map((s) => [s.id, s]))
  return criteria.map((criterion) => {
    const item = raw?.scores?.find((s) => s.key === criterion.key)
    const evidence: Evidence[] = []
    for (const e of item?.evidence ?? []) {
      const source = byId.get(String(e.source))
      if (typeof e.quote === 'string' && source && verifyQuote(e.quote, source)) {
        evidence.push({ quote: e.quote.trim().slice(0, 320), url: source.url, title: source.title })
      }
    }
    const claimed = typeof item?.score === 'number' && Number.isFinite(item.score) ? Math.max(0, Math.min(10, Math.round(item.score))) : null
    const score = evidence.length > 0 ? claimed : null
    let rationale = typeof item?.rationale === 'string' ? item.rationale.slice(0, 400) : ''
    if (claimed !== null && score === null) rationale = `Not scored: no quote could be verified in the sources. (Analyst note: ${rationale})`
    if (!item) rationale = 'The analyst returned nothing for this criterion.'
    return { key: criterion.key, score, rationale, evidence: evidence.slice(0, 2) }
  })
}

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const list = (value: unknown, max: number) => (Array.isArray(value) ? value.filter((v) => typeof v === 'string' && v.trim()).slice(0, 4).map((v) => text(v, max)) : [])

export function toProfile(raw: RawAnalysis | null): Profile {
  const p = (raw?.profile ?? {}) as Record<string, unknown>
  return {
    oneLiner: text(p.oneLiner, 200),
    sector: text(p.sector, 80),
    businessModel: text(p.businessModel, 160),
    customers: text(p.customers, 160),
    headquarters: text(p.headquarters, 80),
    founded: text(p.founded, 40),
    size: text(p.size, 120),
  }
}

export function toMemo(raw: RawAnalysis | null): Memo {
  const m = (raw?.memo ?? {}) as Record<string, unknown>
  return { summary: text(m.summary, 700), fit: text(m.fit, 500), risks: list(m.risks, 220), questions: list(m.questions, 220) }
}

/** News sources become the stored news list (date is carried at the end of the source title). */
export function toNewsItems(sources: Source[]): NewsItem[] {
  return sources.map((s) => {
    const match = s.title.match(/^(.*) \((\d{4}-\d{2}-\d{2})?\)$/)
    const summary = s.text.split('\n').slice(1).join(' ').replace(/^Summary:\s*/i, '').replace(/\s+/g, ' ').trim()
    return { title: (match?.[1] ?? s.title).slice(0, 200), url: s.url, date: match?.[2] ?? '', summary: summary.slice(0, 260) }
  })
}
