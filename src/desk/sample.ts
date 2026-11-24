/**
 * Canned research for the sample company (a fictional company).
 * It lets anyone see a full scorecard without spending the owner's credits,
 * and lets the tests run the real pipeline, quote verification included, with
 * no network call.
 */

import type { Providers, RawAnalysis, Source } from './providers'

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const SITE: Source[] = [
  {
    id: 'S1',
    url: 'https://sample-company.example',
    title: 'Tablo, the operating system for independent restaurants (sample)',
    text:
      'Tablo is the operating system for independent restaurants. Reservations, table management, online ordering and payments in one subscription. ' +
      'More than 4,200 restaurants in France, Spain and Italy run their service on Tablo every day. ' +
      'Plans start at 89 euros per month, billed monthly, with no commitment. ' +
      'Tablo connects to 60 point-of-sale systems and accounting tools, so the booking, the bill and the books stay in sync.',
  },
  {
    id: 'S2',
    url: 'https://sample-company.example/about',
    title: 'About Tablo (sample)',
    text:
      'Founded in Lyon in 2017 by two former restaurant managers, Tablo employs 140 people across Lyon, Madrid and Milan. ' +
      'The founders still lead the company. Our customers stay with us for 5 years on average.',
  },
]

const NEWS: Source[] = [
  {
    id: 'N1',
    url: 'https://example.com/news/tablo-series-b',
    title: 'Tablo raises a 30 million euro Series B to expand in Southern Europe (2026-06-12)',
    text:
      'Tablo raises a 30 million euro Series B to expand in Southern Europe\n' +
      'The Lyon-based restaurant software company closed a 30 million euro round to open offices in Lisbon and Athens and to double its engineering team within a year.',
  },
  {
    id: 'N2',
    url: 'https://example.com/news/tablo-payments-dispute',
    title: 'Restaurant owners contest new Tablo payment fees (2026-09-03)',
    text:
      'Restaurant owners contest new Tablo payment fees\n' +
      'A group of 200 restaurant owners publicly contested the 1.2 percent fee Tablo introduced on card payments, and some threatened to move to a competitor.',
  },
]

const ANALYSIS: RawAnalysis = {
  profile: {
    oneLiner: 'Reservation, ordering and payment software for independent restaurants',
    sector: 'Restaurant software',
    businessModel: 'Monthly subscription from 89 euros, plus a fee on card payments',
    customers: 'More than 4,200 independent restaurants in France, Spain and Italy',
    headquarters: 'Lyon, France',
    founded: '2017',
    size: '140 employees',
  },
  scores: [
    {
      key: 'recurring',
      score: 9,
      rationale: 'Revenue comes from a monthly subscription, with payments adding a usage-based layer.',
      evidence: [{ source: 'S1', quote: 'Plans start at 89 euros per month, billed monthly, with no commitment.' }],
    },
    {
      key: 'position',
      score: 7,
      rationale: 'A meaningful installed base in three countries, though no market share figure is given.',
      evidence: [{ source: 'S1', quote: 'More than 4,200 restaurants in France, Spain and Italy run their service on Tablo every day.' }],
    },
    {
      key: 'growth',
      score: 8,
      rationale: 'A recent funding round is explicitly aimed at new countries and a larger engineering team.',
      // A shortened quote: each part around the ellipsis must be found in the source, in order.
      evidence: [{ source: 'N1', quote: 'closed a 30 million euro round to open offices in Lisbon and Athens … double its engineering team within a year' }],
    },
    {
      key: 'stickiness',
      score: 8,
      rationale: 'The product sits between bookings, the till and accounting, and customers stay for years.',
      evidence: [
        { source: 'S1', quote: 'Tablo connects to 60 point-of-sale systems and accounting tools, so the booking, the bill and the books stay in sync.' },
        // This quote is NOT in the sources. The server must drop it; the first one is enough to keep the score.
        { source: 'S2', quote: 'Churn is below one percent per year across all customer segments and countries.' },
      ],
    },
    {
      key: 'risk',
      score: 5,
      rationale: 'A public dispute over a new payment fee points to pricing friction with part of the customer base.',
      evidence: [{ source: 'N2', quote: 'A group of 200 restaurant owners publicly contested the 1.2 percent fee Tablo introduced on card payments' }],
    },
  ],
  memo: {
    summary:
      'Tablo sells reservation, ordering and payment software to independent restaurants on a monthly subscription. It reports more than 4,200 restaurants in France, Spain and Italy and employs 140 people. It raised a 30 million euro Series B in June 2026 to enter Portugal and Greece.',
    fit: 'Tablo matches the thesis closely: founder-led, one industry, subscription revenue, and the system restaurants run their service on. The open point is how much of the revenue now depends on the contested payment fee.',
    risks: [
      'Customer pushback on the new 1.2 percent payment fee could raise churn.',
      'Independent restaurants close often, which caps customer lifetime.',
      'Expansion into two new countries at once stretches a 140-person team.',
    ],
    questions: [
      'What share of revenue comes from payments versus subscriptions?',
      'What was net revenue retention over the last two years?',
      'How many of the 4,200 restaurants are on the full suite rather than reservations only?',
    ],
  },
}

export const sampleProviders: Providers = {
  async readWebsite() {
    await pause(800)
    return { value: SITE, costUsd: 0, via: 'firecrawl' as const }
  },
  async searchNews() {
    await pause(800)
    return { value: NEWS, costUsd: 0 }
  },
  async analyse() {
    await pause(900)
    return { value: ANALYSIS, costUsd: 0 }
  },
}
