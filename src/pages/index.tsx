/**
 * Landing page — a STATIC page (top level of src/pages/): no auth call, no
 * realtime connection, prerendered to HTML at build so crawlers read it.
 */

import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { seo } from '../seo'

const STEPS = [
  {
    title: 'Write the thesis once',
    text: 'Who you want, and the criteria that make a target worth a call, each with a weight. Everyone on the team scores against the same grid.',
  },
  {
    title: 'The desk finds targets itself',
    text: 'It searches the web with your thesis and lists organisations that match. One click sends one to the analyst. It looks again every Monday.',
  },
  {
    title: 'No quote, no score',
    text: 'An AI analyst reads the target’s website and a year of news. Every score must rest on a sentence quoted from a real page, and the server checks each quote word for word.',
  },
  {
    title: 'Both sides, then a first line',
    text: 'Why they would say yes, why they would say no, and a draft first message built on a verified fact. A person edits and sends it. The desk never does.',
  },
  {
    title: 'Decide blind, together',
    text: 'Each teammate locks Pursue or Skip with a reason. Nobody sees another ballot until the reveal, which lands on every open screen at the same moment.',
  },
]

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="min-h-screen bg-background text-foreground">
        <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <span className="font-display text-lg">Thesis Desk</span>
          <Link to="/desk" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Open the desk
          </Link>
        </header>

        <main className="mx-auto max-w-5xl px-6 pb-24">
          <section className="max-w-3xl pt-14 pb-14">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">For go-to-market and partnership teams</p>
            <h1 className="font-display mt-4 text-5xl leading-[1.05] sm:text-6xl">Know who to go after, and why, with the proof attached.</h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
              Thesis Desk finds organisations that match your thesis, scores each one on your criteria with quoted
              evidence, drafts the first line of outreach, and lets the team decide blind.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/desk"
                className="inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Open the live desk
              </Link>
              <span className="text-sm text-muted-foreground">Public to read. Sign in to add a target or vote.</span>
            </div>
          </section>

          <section aria-labelledby="live-title" className="mb-16 rounded-md border border-primary bg-card p-6">
            <h2 id="live-title" className="font-display text-xl">
              The live desk runs a real example
            </h2>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Its thesis: the first partners for a developer platform where AI agents ship full-stack apps. The targets
              on the desk are real builder communities, found by the scout and scored from their own public pages.
              Move the weights and the ranking changes.
            </p>
          </section>

          <section aria-labelledby="example-title" className="mb-16 rounded-md border border-border bg-card p-6">
            <h2 id="example-title" className="text-sm font-medium text-muted-foreground">
              What a scorecard line looks like (fictional target)
            </h2>
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="font-medium">Feels the shipping gap</p>
                <p className="font-display mt-1 text-2xl text-positive">
                  7<span className="text-sm text-muted-foreground">/10</span>
                </p>
                <p className="mt-2 text-sm">Deployment is named as the hardest part of the weekend.</p>
                <blockquote className="mt-3 border-l-2 border-primary pl-3 text-sm text-muted-foreground">
                  “getting the app deployed with a login and a database before the demo”
                  <footer className="mt-1 text-xs">
                    <span className="font-medium text-positive">✓ Found in the source</span> · the organiser’s home page
                  </footer>
                </blockquote>
              </div>
              <div>
                <p className="font-medium">The same criterion, second quote</p>
                <p className="mt-2 text-sm">The analyst also claimed that half of all teams fail to deploy anything.</p>
                <p className="mt-3 text-sm text-caution">
                  1 quote the analyst cited was not found in the source and was removed. No quote, no score.
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-x-10 gap-y-10 border-t border-border pt-12 sm:grid-cols-2">
            {STEPS.map((step, i) => (
              <div key={step.title}>
                <p className="font-display text-3xl tabular-nums text-primary">{i + 1}</p>
                <h2 className="mt-2 text-lg font-semibold">{step.title}</h2>
                <p className="mt-2 text-muted-foreground">{step.text}</p>
              </div>
            ))}
          </section>

          <section className="mt-16 max-w-2xl border-t border-border pt-12">
            <h2 className="font-display text-2xl">What it will not do</h2>
            <p className="mt-3 text-muted-foreground">
              It does not send messages, and it does not look up anyone’s email address. It reads public pages, shows
              its evidence, and leaves the outreach to a person.{' '}
              <Link to="/about" className="text-foreground underline underline-offset-4">
                How it works, and where it stops
              </Link>
              .
            </p>
          </section>
        </main>

        <footer className="border-t border-border">
          <p className="mx-auto max-w-5xl px-6 py-6 text-sm text-muted-foreground">Built by Gabriel Fortun on DeepSpace.</p>
        </footer>
      </div>
    </>
  )
}
