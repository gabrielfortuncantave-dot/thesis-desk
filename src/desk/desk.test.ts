import { describe, expect, it } from 'vitest'
import { digestEmailText } from './email'
import { escapeLatex, memoLatex } from './pdf'
import { checkCase, checkScores, extractLinks, htmlToText, mentionsCompany, normalise, parseJson, pickUsefulLinks, toNewsItems, toSuggestions, verifyQuote, type RawAnalysis, type Source } from './providers'
import { coverage, tally, verdict, weightedScore } from './score'
import { DEFAULT_DESK, type CriterionScore, type Deal } from './types'
import { cleanWebsiteUrl, safeHref } from './validate'
import { timeAgo } from '../components/DeskLive'

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

describe('verdict', () => {
  it('follows the votes, then conviction, then calls a split', () => {
    expect(verdict({ invest: 2, pass: 1, investConviction: 3, passConviction: 5 })).toBe('Invest')
    expect(verdict({ invest: 1, pass: 2, investConviction: 5, passConviction: 2 })).toBe('Pass')
    expect(verdict({ invest: 1, pass: 1, investConviction: 4, passConviction: 2 })).toBe('Invest')
    expect(verdict({ invest: 1, pass: 1, investConviction: 3, passConviction: 3 })).toBe('Split')
  })
})

describe('bull and bear case', () => {
  const sources: Source[] = [{ id: 'S1', url: 'https://a.com', title: 'Home', text: 'Our customers stay with us for 5 years on average.' }]
  it('keeps an argument only when its quote is in the source', () => {
    const kept = checkCase(
      [
        { point: 'Customers stay for years.', source: 'S1', quote: 'Our customers stay with us for 5 years on average.' },
        { point: 'Rivals are coming.', source: 'S1', quote: 'Two well-funded rivals announced their launch for next quarter.' },
        { point: 'No proof at all.' },
      ],
      sources,
    )
    expect(kept).toEqual([{ point: 'Customers stay for years.', quote: 'Our customers stay with us for 5 years on average.', url: 'https://a.com', title: 'Home' }])
  })
  it('survives a missing or broken list', () => {
    expect(checkCase(undefined, sources)).toEqual([])
  })
})

describe('scout suggestions', () => {
  it('keeps one clean entry per website, with the sentence that says what the company does', () => {
    const found = toSuggestions([
      { title: 'Thaïs PMS', url: 'https://thais-pms.com/', text: '# Thaïs PMS Thaïs PMS is a Software Development company. Thaïs PMS is a French hotel management software that runs bookings and billing.' },
      { title: 'Celery - Helping Hospitality Hustle Harder', url: 'https://celeryhq.eu/en/', text: '# Celery Celery is an IT Services company. Celery is a workforce planning tool for restaurants and hotels in Europe.' },
      { title: 'Thaïs again', url: 'https://thais-pms.com/pricing', text: 'duplicate site' },
      { title: 'Bad', url: 'javascript:alert(1)', text: 'x' },
    ])
    expect(found).toEqual([
      { name: 'Thaïs PMS', websiteUrl: 'https://thais-pms.com', why: 'Thaïs PMS is a French hotel management software that runs bookings and billing.' },
      { name: 'Celery', websiteUrl: 'https://celeryhq.eu', why: 'Celery is a workforce planning tool for restaurants and hotels in Europe.' },
    ])
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
  it('accepts a quote shortened with an ellipsis when each part is in the source, in order', () => {
    expect(verifyQuote('More than 4,200 restaurants … run their service on Tablo every day', source)).toBe(true)
    expect(verifyQuote('More than 4,200 restaurants [...] run their service on Tablo every day.', source)).toBe(true)
  })
  it('rejects parts glued in the wrong order, and parts too short to mean anything', () => {
    expect(verifyQuote('run their service on Tablo every day … More than 4,200 restaurants', source)).toBe(false)
    expect(verifyQuote('More than 4,200 restaurants in France … Tablo', source)).toBe(false)
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
    expect(checked[0]).toMatchObject({ score: 9, evidence: [{ url: 'https://a.com' }], dropped: 0 })
  })
  it('records how many quotes were removed per criterion', () => {
    expect(checked.find((s) => s.key === 'growth')?.dropped).toBe(1)
    expect(checked.find((s) => s.key === 'risk')?.dropped).toBe(1)
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
  it('safeHref lets web links through and nothing else', () => {
    expect(safeHref('https://example.com/a?b=1')).toBe('https://example.com/a?b=1')
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'not a url', '']) expect(safeHref(bad)).toBeNull()
  })
  it('timeAgo reads like a feed', () => {
    const now = Date.parse('2026-11-23T12:00:00Z')
    expect(timeAgo('2026-11-23T11:59:50Z', now)).toBe('just now')
    expect(timeAgo('2026-11-23T11:20:00Z', now)).toBe('40 min ago')
    expect(timeAgo('2026-11-23T07:00:00Z', now)).toBe('5 h ago')
    expect(timeAgo('2026-11-22T10:00:00Z', now)).toBe('yesterday')
  })
  it('extractLinks resolves relative links and skips anchors', () => {
    const html = '<a href="/about">About</a> <a class="x" href=\'pricing\'>Pricing</a> <a href="#top">Top</a> <a href="https://other.com/x">Other</a>'
    expect(extractLinks(html, 'https://c.com/en/')).toEqual(['https://c.com/about', 'https://c.com/en/pricing', 'https://other.com/x'])
  })
  it('htmlToText drops scripts, styles and tags and decodes entities', () => {
    const html = '<html><head><style>p{color:red}</style><script>var a = "<b>";</script></head><body><h1>Tablo &amp; Co</h1><p>4,200&nbsp;restaurants</p><!-- note --></body></html>'
    expect(htmlToText(html)).toBe('Tablo & Co\n4,200 restaurants')
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

describe('mentionsCompany', () => {
  it('matches the name as whole words, with or without the space', () => {
    expect(mentionsCompany('Back Market', 'Refurbished leader Back Market raises a new round')).toBe(true)
    expect(mentionsCompany('Back Market', 'BackMarket ouvre un bureau à Berlin')).toBe(true)
    expect(mentionsCompany('Mews', 'Hotel software company Mews, founded in Prague')).toBe(true)
  })
  it('rejects look-alike companies', () => {
    expect(mentionsCompany('Back Market', 'ShopBack raises US$45 mil in latest funding round')).toBe(false)
    expect(mentionsCompany('Back Market', 'Backcountry selects a new payment partner for its market')).toBe(false)
    expect(mentionsCompany('Mews', 'Newsbreak: fund seeks RM1 bil')).toBe(false)
    expect(mentionsCompany('', 'anything')).toBe(false)
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
