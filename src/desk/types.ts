/**
 * Shared definitions for the deal desk — imported by the worker AND the React
 * pages, so the two can never disagree on a shape.
 */

/** One line of the investment thesis: what we look for, and how much it counts. */
export interface Criterion {
  key: string
  label: string
  /** Relative weight, 0 to 10. Only the proportions matter. */
  weight: number
  /** What the analyst should look for; given to the model as scoring guidance. */
  guide: string
}

export interface Desk {
  thesisName: string
  thesisText: string
  criteria: Criterion[]
}

/** The desk a fresh app starts with. The owner can change it on the Owner page. */
export const DEFAULT_DESK: Desk = {
  thesisName: 'European vertical software',
  thesisText:
    'Founder-led B2B software companies in Europe that serve one industry deeply (restaurants, hotels, clinics, construction, logistics…), ' +
    'sell on subscription, and are the system their customers run the business on.',
  criteria: [
    { key: 'recurring', label: 'Recurring revenue', weight: 9, guide: 'Subscription or usage pricing, contracts, payments or other revenue that repeats without a new sale.' },
    { key: 'position', label: 'Market position', weight: 7, guide: 'Customer count, named customers, countries served, leadership claims backed by numbers.' },
    { key: 'growth', label: 'Growth signals', weight: 7, guide: 'Funding rounds, hiring, new markets, acquisitions, product launches in the last 12 months.' },
    { key: 'stickiness', label: 'Product stickiness', weight: 8, guide: 'Is the product the system of record? Integrations, breadth of modules, switching cost.' },
    { key: 'risk', label: 'Low risk profile', weight: 5, guide: '10 = no visible red flag. Lower for layoffs, litigation, regulatory exposure, dependence on one platform or customer.' },
  ],
}

export const STAGES = [
  { id: 'sourced', label: 'Sourced' },
  { id: 'screening', label: 'Screening' },
  { id: 'committee', label: 'Committee' },
  { id: 'invested', label: 'Invested' },
  { id: 'passed', label: 'Passed' },
] as const

export type Stage = (typeof STAGES)[number]['id']

export type ResearchStatus = 'queued' | 'reading' | 'searching' | 'scoring' | 'done' | 'failed'

/** A sentence copied word for word from a page, with the page it came from. */
export interface Evidence {
  quote: string
  url: string
  title: string
}

export interface CriterionScore {
  key: string
  /** 0 to 10, or null when no quote that we could verify supports a score. */
  score: number | null
  rationale: string
  evidence: Evidence[]
  /** How many quotes the analyst cited for this criterion that were NOT found in their source, and were removed. */
  dropped?: number
}

export interface Profile {
  oneLiner: string
  sector: string
  businessModel: string
  customers: string
  headquarters: string
  founded: string
  size: string
}

export interface Memo {
  summary: string
  fit: string
  risks: string[]
  questions: string[]
}

export interface NewsItem {
  title: string
  url: string
  date: string
  summary: string
  /** Set by the weekly watch on headlines found since the last check. */
  isNew?: boolean
}

export interface Deal {
  addedBy: string
  addedByName: string
  name: string
  websiteUrl: string
  stage: Stage
  status: ResearchStatus
  step: string
  log: string[]
  profile: Profile | null
  scores: CriterionScore[]
  /** Weighted score out of 100 with the desk's saved weights; null until researched. */
  totalScore: number | null
  /** The total before the latest research run, to show how the picture moved. */
  previousScore: number | null
  memo: Memo | null
  news: NewsItem[]
  isSample: number
  costUsd: number
  startedAt: string
  researchedAt: string
  newsCheckedAt: string
  voting: 'open' | 'revealed'
  voteCount: number
  pdfExports: number
  error: string
}

export interface Vote {
  dealId: string
  voterId: string
  voterName: string
  decision: 'invest' | 'pass'
  /** 1 (weak) to 5 (strong). */
  conviction: number
  reason: string
  /** 'no' while the committee is still voting; flipped to 'yes' for every vote at reveal. */
  revealed: 'no' | 'yes'
}

/** Reserved website address of the sample company: its research is canned and free. */
export const SAMPLE_COMPANY = { name: 'Tablo (sample)', websiteUrl: 'https://sample-company.example' } as const

export function isSampleUrl(url: string): boolean {
  return url === SAMPLE_COMPANY.websiteUrl
}

/** One line of the desk's public activity feed. Never contains how anyone voted before a reveal. */
export interface Activity {
  actorName: string
  kind: 'added' | 'scored' | 'failed' | 'stage' | 'voted' | 'revealed' | 'thesis' | 'removed'
  dealId: string
  dealName: string
  detail: string
  at: string
}
