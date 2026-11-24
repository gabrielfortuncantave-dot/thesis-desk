/**
 * Canned research for the sample target (a fictional hackathon community),
 * written for the default go-to-market playbook.
 * It lets anyone see a full scorecard without spending the owner's credits,
 * and lets the tests run the real pipeline, quote verification included, with
 * no network call. Three things in it are invented ON PURPOSE and must be
 * dropped by the server: one evidence quote, one "say no" argument.
 */

import type { Providers, RawAnalysis, Source } from './providers'

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const SITE: Source[] = [
  {
    id: 'S1',
    url: 'https://sample-company.example',
    title: 'Buildfest, weekend hackathons for student builders (sample)',
    text:
      'Buildfest runs weekend hackathons where student teams ship a working web app in 48 hours. ' +
      'Last year 3,200 students from 41 universities took part in 12 events across Europe. ' +
      'Most teams now build with AI coding agents such as Claude Code and Cursor from the first hour. ' +
      'The hardest part of every weekend is the last one: getting the app deployed with a login and a database before the demo.',
  },
  {
    id: 'S2',
    url: 'https://sample-company.example/partners',
    title: 'Partner with Buildfest (sample)',
    text:
      'We are looking for tool partners for the 2027 season. Partners give every team free credits and run a 20-minute workshop on Friday night. ' +
      'Past partners include two cloud providers and a design tool.',
  },
]

const NEWS: Source[] = [
  {
    id: 'N1',
    url: 'https://example.com/news/buildfest-2027-season',
    title: 'Buildfest announces its 2027 season with 18 cities (2026-10-06)',
    text:
      'Buildfest announces its 2027 season with 18 cities\n' +
      'The student hackathon series will open registration in January and add Lisbon, Warsaw and Vienna to its calendar for the 2027 season.',
  },
  {
    id: 'N2',
    url: 'https://example.com/news/buildfest-sponsor-fatigue',
    title: 'Hackathon organisers push back on sponsor pitches (2026-08-19)',
    text:
      'Hackathon organisers push back on sponsor pitches\n' +
      'Several organisers, Buildfest among them, said they now refuse partners whose workshop is only a sales pitch and ask for tools students can use the same night.',
  },
]

const ANALYSIS: RawAnalysis = {
  profile: {
    oneLiner: 'Weekend hackathon series where student teams ship a web app in 48 hours',
    sector: 'Student hackathons',
    businessModel: 'Free for students, funded by tool partners',
    customers: '3,200 students from 41 universities',
    headquarters: 'Europe',
    founded: '',
    size: '12 events last year, 18 cities announced for 2027',
  },
  scores: [
    {
      key: 'builders',
      score: 9,
      rationale: 'Every participant is there to ship a working app in a weekend.',
      evidence: [{ source: 'S1', quote: 'Buildfest runs weekend hackathons where student teams ship a working web app in 48 hours.' }],
    },
    {
      key: 'agents',
      score: 8,
      rationale: 'The organisers say most teams start with an AI coding agent.',
      evidence: [{ source: 'S1', quote: 'Most teams now build with AI coding agents such as Claude Code and Cursor from the first hour.' }],
    },
    {
      key: 'gap',
      score: 7,
      rationale: 'Deployment with a login and a database is named as the hardest part of the weekend.',
      evidence: [
        { source: 'S1', quote: 'getting the app deployed with a login and a database before the demo' },
        // This quote is NOT in the sources. The server must drop it; the first one is enough to keep the score.
        { source: 'S2', quote: 'Half of all teams fail to deploy anything at all by Sunday evening.' },
      ],
    },
    {
      key: 'reach',
      score: 6,
      rationale: 'A few thousand students a year: meaningful for a first partnership, small against national programmes.',
      evidence: [{ source: 'S1', quote: 'Last year 3,200 students from 41 universities took part in 12 events across Europe.' }],
    },
    {
      key: 'timing',
      score: 8,
      rationale: 'Registration for a larger season opens in January, so partner slots are being decided now.',
      // A shortened quote: each part around the ellipsis must be found in the source, in order.
      evidence: [{ source: 'N1', quote: 'will open registration in January … for the 2027 season' }],
    },
    {
      key: 'openness',
      score: 9,
      rationale: 'There is an open call for tool partners with a defined format.',
      evidence: [{ source: 'S2', quote: 'We are looking for tool partners for the 2027 season.' }],
    },
  ],
  bull: [
    { point: 'They are actively recruiting tool partners and already know what they want from one.', source: 'S2', quote: 'Partners give every team free credits and run a 20-minute workshop on Friday night.' },
    { point: 'Their stated pain is exactly the last step before a demo.', source: 'S1', quote: 'getting the app deployed with a login and a database before the demo' },
  ],
  bear: [
    { point: 'They turn away partners who only pitch, so a weak workshop closes the door.', source: 'N2', quote: 'they now refuse partners whose workshop is only a sales pitch' },
    // No such sentence exists in the sources: the server must drop this argument.
    { point: 'They have just signed an exclusive hosting partner.', source: 'S2', quote: 'Buildfest signed a three-year exclusive agreement with a hosting provider last month.' },
  ],
  memo: {
    summary:
      'Buildfest runs weekend hackathons for student teams who ship a web app in 48 hours. It reports 3,200 students from 41 universities last year and has announced 18 cities for 2027. It funds itself through tool partners who give credits and run a short workshop.',
    fit: 'Buildfest matches the thesis closely: its members build with AI coding agents and say deployment is their hardest step. The sources do not say how many teams keep their app live after the weekend.',
    risks: [
      'They refuse partners whose workshop is only a sales pitch.',
      'Students may drop the tool once the weekend is over.',
      'Two cloud providers are already past partners.',
    ],
    questions: [
      'How many teams deploy a live app by the Sunday demo today?',
      'What did past tool partners get in sign-ups after an event?',
      'Is a partner slot still open for the first 2027 events?',
    ],
    opener: {
      text: 'We read that for your teams the hardest part of the weekend is getting the app deployed with a login and a database before the demo. Our platform lets a coding agent do that step in one command, with free credits for every team. Would a 20-minute Friday workshop where each team deploys its first page be useful for the 2027 season?',
      source: 'S1',
      quote: 'getting the app deployed with a login and a database before the demo',
    },
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
