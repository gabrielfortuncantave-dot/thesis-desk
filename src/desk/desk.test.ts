import { describe, expect, it } from 'vitest'
import { digestEmailText } from './email'
import { escapeLatex, memoLatex } from './pdf'
import { checkScores, normalise, parseJson, pickUsefulLinks, toNewsItems, verifyQuote, type RawAnalysis, type Source } from './providers'
import { coverage, tally, weightedScore } from './score'
import { DEFAULT_DESK, type CriterionScore, type Deal } from './types'
import { cleanWebsiteUrl } from './validate'

const criteria = DEFAULT_DESK.criteria
const scoreOf = (key: string, score: number | null): CriterionScore => ({ key, score, rationale: '', evidence: [] })

describe('weightedScore', () => {
  it('weights each criterion and returns a score out of 100', () => {
    // weights 9,7,7,8,5 with scores 10,10,10,10,0 → (9+7+7+8)*10 / 36 * 10 = 86
    const scores = [scoreOf('recurring', 10), scoreOf('position', 10), scoreOf('growth', 10), scoreOf('stickiness', 10), scoreOf('risk', 0)]
    expect(weightedScore(scores, criteria)).toBe(86)
  })
  it('leaves unscored criteria out of both the points and the weights', () => {
    expect(weightedScore([scoreOf('recurring', 8), scoreOf('position', null)], criteria)).toBe(80)
  })
  it('returns null when nothing is scored or every weight is zero', () => {
    expect(weightedScore([], criteria)).toBeNull()
    expect(weightedScore([scoreOf('recurring', 8)], criteria.map((c) => ({ ...c, weight: 0 })))).toBeNull()
  })
  it('changes the ranking when the weights change (the what-if sliders)', () => {
    const steady = [scoreOf('recurring', 9), scoreOf('growth', 3)]
    const rocket = [scoreOf('recurring', 3), scoreOf('growth', 9)]
    const favourGrowth = criteria.map((c) => ({ ...c, weight: c.key === 'growth' ? 10 : c.key === 'recurring' ? 1 : 0 }))
    expect(weightedScore(steady, criteria)!).toBeGreaterThan(weightedScore(rocket, criteria)!)
    expect(weightedScore(rocket, favourGrowth)!).toBeGreaterThan(weightedScore(steady, favourGrowth)!)
  })
})

describe('coverage and tally', () => {
  it('counts scored criteria', () => {
    expect(coverage([scoreOf('recurring', 5), scoreOf('risk', null)], criteria)).toEqual({ scored: 1, total: 5 })
  })
  it('tallies revealed votes with conviction', () => {
    expect(tally([{ decision: 'invest', conviction: 4 }, { decision: 'invest', conviction: 2 }, { decision: 'pass', conviction: 5 }])).toEqual({
      invest: 2,
      pass: 1,
      investConviction: 6,
      passConviction: 5,
    })
  })
})

describe('quote verification', () => {
  const source: Source = { id: 'S1', url: 'https://a.com', title: 'A', text: 'More than **4,200 restaurants** in France,\nSpain and Italy run their service on “Tablo” every day.' }
  it('accepts a quote whose words appear in order, ignoring Markdown, quotes and line breaks', () => {
    expect(verifyQuote('More than 4,200 restaurants in France, Spain and Italy run their service on "Tablo" every day.', source)).toBe(true)
  })
  it('rejects a quote that is not in the source, is too short, or cites an unknown source', () => {
    expect(verifyQuote('More than 9,000 restaurants in France, Spain and Italy', source)).toBe(false)
    expect(verifyQuote('4,200 restaurants', source)).toBe(false)
    expect(verifyQuote('More than 4,200 restaurants in France', undefined)).toBe(false)
  })
  it('normalise keeps words and numbers', () => {
    expect(normalise('  **Hello**,  [World](x) ')).toBe('hello , world x')
  })
})

describe('checkScores', () => {
  const sources: Source[] = [{ id: 'S1', url: 'https://a.com', title: 'Home', text: 'Plans start at 89 euros per month, billed monthly, with no commitment.' }]
  const raw: RawAnalysis = {
    profile: null,
    memo: null,
    scores: [
      { key: 'recurring', score: 9, rationale: 'Subscription.', evidence: [{ source: 'S1', quote: 'Plans start at 89 euros per month, billed monthly' }] },
      { key: 'growth', score: 8, rationale: 'Growing fast.', evidence: [{ source: 'S1', quote: 'Revenue tripled last year according to the founders' }] },
      { key: 'risk', score: 14, rationale: 'x', evidence: [{ source: 'S9', quote: 'Plans start at 89 euros per month, billed monthly' }] },
    ],
  }
  const checked = checkScores(raw, criteria, sources)
  it('returns one entry per criterion, in thesis order', () => {
    expect(checked.map((s) => s.key)).toEqual(criteria.map((c) => c.key))
  })
  it('keeps a score backed by a verified quote', () => {
    expect(checked[0]).toMatchObject({ score: 9, evidence: [{ url: 'https://a.com' }] })
  })
  it('removes a score whose quote is invented or cites a source that does not exist', () => {
    expect(checked.find((s) => s.key === 'growth')).toMatchObject({ score: null, evidence: [] })
    expect(checked.find((s) => s.key === 'growth')?.rationale).toContain('Not scored')
    expect(checked.find((s) => s.key === 'risk')?.score).toBeNull()
  })
  it('survives a broken model reply', () => {
    expect(checkScores(null, criteria, sources).every((s) => s.score === null)).toBe(true)
  })
})

describe('small helpers', () => {
  it('cleanWebsiteUrl accepts public sites and refuses local ones', () => {
    expect(cleanWebsiteUrl(' www.company.com/ ')).toBe('https://www.company.com')
    for (const bad of ['', 'localhost', 'http://127.0.0.1', 'javascript:alert(1)']) expect(cleanWebsiteUrl(bad)).toBeNull()
  })
  it('pickUsefulLinks keeps two same-site business pages', () => {
    const links = ['https://c.com/', 'https://c.com/blog/x', 'https://c.com/about', 'https://o.com/pricing', 'https://c.com/pricing', 'https://c.com/customers']
    expect(pickUsefulLinks('https://c.com', links)).toEqual(['https://c.com/about', 'https://c.com/pricing'])
  })
  it('parseJson accepts fenced JSON and returns null on prose', () => {
    expect(parseJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(parseJson('Here you go')).toBeNull()
  })
  it('toNewsItems reads the date carried in the title', () => {
    const [item] = toNewsItems([{ id: 'N1', url: 'https://n.com/1', title: 'Tablo raises a round (2026-06-12)', text: 'Tablo raises a round\nSummary: It raised money.' }])
    expect(item).toEqual({ title: 'Tablo raises a round', url: 'https://n.com/1', date: '2026-06-12', summary: 'It raised money.' })
  })
})

describe('weekly digest email', () => {
  it('lists only companies with new headlines', () => {
    const email = digestEmailText('thesis-desk', [
      { dealId: 'd1', name: 'Tablo', fresh: [{ title: 'Tablo raises a round', url: 'https://n.com/1', date: '2026-06-12', summary: '' }] },
      { dealId: 'd2', name: 'Quiet Co', fresh: [] },
    ])
    expect(email?.subject).toBe('1 new headline on Tablo in your pipeline')
    expect(email?.text).toContain('https://thesis-desk.app.space/deal/d1')
    expect(email?.text).not.toContain('Quiet Co')
  })
  it('sends nothing when nothing is new', () => {
    expect(digestEmailText('thesis-desk', [{ dealId: 'd2', name: 'Quiet Co', fresh: [] }])).toBeNull()
  })
})

describe('PDF memo', () => {
  it('escapes LaTeX special characters and drops what pdflatex cannot print', () => {
    expect(escapeLatex('R&D at 50% for $5_000 {x} 日本')).toBe('R\\&D at 50\\% for \\$5\\_000 \\{x\\} ')
  })
  it('builds a complete document with the weighted score', () => {
    const deal = {
      name: 'Tablo & Co',
      websiteUrl: 'https://tablo.example',
      profile: { sector: 'Software', headquarters: 'Lyon', founded: '2017', size: '140 employees' },
      memo: { summary: 'S', fit: 'F', risks: ['R1'], questions: ['Q1'] },
      scores: [{ key: 'recurring', score: 8, rationale: 'Subscription', evidence: [{ quote: 'Plans start at 89 euros', url: 'u', title: 't' }] }],
    } as unknown as Deal
    const tex = memoLatex(deal, DEFAULT_DESK, '2026-11-23')
    expect(tex).toContain('\\begin{document}')
    expect(tex).toContain('Tablo \\& Co')
    expect(tex).toContain('80/100')
    expect(tex).toContain('\\end{document}')
  })
})
