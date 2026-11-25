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

/** A company the desk found on the web by searching for the thesis. Not researched yet. */
export interface Suggestion {
  name: string
  websiteUrl: string
  why: string
}

export interface Desk {
  thesisName: string
  thesisText: string
  criteria: Criterion[]
  /** Filled by the scout (Monday task, or the owner's "Scout now" button). */
  suggestions?: Suggestion[]
  scoutedAt?: string
}

/** A company the desk found on the web by searching for the thesis. Not researched yet. */
export interface Suggestion {
  name: string
  websiteUrl: string
  why: string
}

export type PlaybookId = 'gtm'

export interface Desk {
  /** Which playbook the desk runs: it sets the vocabulary and what the analyst is asked for. */
  playbook?: PlaybookId
  thesisName: string
  thesisText: string
  criteria: Criterion[]
  /** Filled by the scout (Monday task, or the owner's "Scout now" button). */
  suggestions?: Suggestion[]
  scoutedAt?: string
}

/**
 * A playbook holds everything a team would word differently: what the two
 * decisions are called, the stage names, the section titles, what the analyst
 * is asked for, and the thesis a desk starts with. The app ships with one,
 * go-to-market targets. An earlier build also had an investment-screening
 * playbook (git tag `full-v4`); it was cut to keep this submission to one flow.
 */
export interface Playbook {
  id: PlaybookId
  label: string
  /** Heading above the thesis on the board. */
  thesisLabel: string
  /** Who the analyst is, for the model. */
  analyst: string
  /** The two decisions of the blind vote (stored as 'invest' / 'pass' whatever they are called). */
  yes: string
  no: string
  voteTitle: string
  forTitle: string
  againstTitle: string
  briefTitle: string
  risksTitle: string
  questionsTitle: string
  /** Display names of the five pipeline stages. */
  stageLabels: Record<Stage, string>
  /** Whether the analyst also drafts a first outreach message. */
  wantsOpener: boolean
  example: { name: string; websiteUrl: string }
  /** The thesis and criteria a desk starts with under this playbook. */
  desk: Pick<Desk, 'thesisName' | 'thesisText' | 'criteria'>
}

export const PLAYBOOKS: Record<PlaybookId, Playbook> = {
  gtm: {
    id: 'gtm',
    label: 'Go-to-market targets',
    thesisLabel: 'Go-to-market thesis',
    analyst: 'You are a go-to-market analyst deciding which organisations a team should approach first, as partners or as customers.',
    yes: 'Pursue',
    no: 'Skip',
    voteTitle: 'Team call',
    forTitle: 'Why they would say yes',
    againstTitle: 'Why they would say no',
    briefTitle: 'Account brief',
    risksTitle: 'Objections to expect',
    questionsTitle: 'Questions for the first call',
    stageLabels: { sourced: 'Found', screening: 'Qualified', committee: 'Decided', invested: 'Won', passed: 'Dropped' },
    wantsOpener: true,
    example: { name: 'Build Club', websiteUrl: 'https://buildclub.ai' },
    desk: {
      thesisName: 'First partners for a platform where AI agents ship full-stack apps',
      thesisText:
        'We are a developer platform that lets a coding agent build and deploy a full-stack app (sign-in, live data, hosting) without setup. ' +
        'We want the communities, programs and tools whose members build and ship small web apps with AI: hackathon organisers, student builder clubs, bootcamps and AI coding tools. ' +
        'A good target puts our platform in front of people on the day they need to ship something.',
      criteria: [
        { key: 'builders', label: 'Audience of builders', weight: 9, guide: 'Evidence that its members or users build and ship software projects: demos, hackathons, project showcases, cohorts.' },
        { key: 'agents', label: 'AI-agent native', weight: 8, guide: 'Uses, teaches or promotes AI coding tools and agents (Claude, Cursor, Copilot, vibe coding, MCP).' },
        { key: 'gap', label: 'Feels the shipping gap', weight: 8, guide: 'Signs that members struggle with or care about deployment, hosting, sign-in, databases, going from prototype to live app.' },
        { key: 'reach', label: 'Reach', weight: 6, guide: 'Numbers: members, participants, students, events per year, cities, followers.' },
        { key: 'timing', label: 'Timing signal', weight: 6, guide: 'Something dated in the last 12 months that gives a reason to reach out now: an upcoming event, a new cohort, a launch, funding.' },
        { key: 'openness', label: 'Open to partners', weight: 5, guide: 'Sponsors, partner or perks pages, a call for partners, named existing tool partners.' },
      ],
    },
  },
}

export const DEFAULT_PLAYBOOK: PlaybookId = 'gtm'

/** The desk a fresh app starts with. The owner can change it, or load another playbook, on the Owner page. */
export const DEFAULT_DESK: Desk = { playbook: DEFAULT_PLAYBOOK, ...PLAYBOOKS[DEFAULT_PLAYBOOK].desk }

export function playbookOf(desk: Pick<Desk, 'playbook'> | null | undefined): Playbook {
  return PLAYBOOKS[desk?.playbook ?? DEFAULT_PLAYBOOK] ?? PLAYBOOKS[DEFAULT_PLAYBOOK]
}

/** Stage ids are fixed (they are stored on every deal); what each one is called comes from the playbook. */
export const STAGES = [{ id: 'sourced' }, { id: 'screening' }, { id: 'committee' }, { id: 'invested' }, { id: 'passed' }] as const

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

/** One argument for or against investing, resting on a verified quote like every score. */
export interface CasePoint {
  point: string
  quote: string
  url: string
  title: string
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
  /** A draft first message, kept only when the fact it mentions was verified. The app never sends it. */
  opener?: (CasePoint & { text: string }) | null
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
  /** The strongest verified arguments for and against, shown side by side before the vote. */
  bull: CasePoint[]
  bear: CasePoint[]
  news: NewsItem[]
  isSample: number
  costUsd: number
  startedAt: string
  researchedAt: string
  newsCheckedAt: string
  voting: 'open' | 'revealed'
  voteCount: number
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
export const SAMPLE_COMPANY = { name: 'Buildfest (sample)', websiteUrl: 'https://sample-company.example' } as const

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
