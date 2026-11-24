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
    text: 'Five criteria with weights. Every company is read against the same grid, so two analysts cannot score the same company two ways.',
  },
  {
    title: 'Add a company, get a scorecard',
    text: 'An AI analyst reads the company website and a year of news, scores each criterion, and writes a one-page memo with risks and questions for management.',
  },
  {
    title: 'No quote, no score',
    text: 'Every score must rest on a sentence quoted from a public page. The server checks each quote word for word against its source and removes any score it cannot verify.',
  },
  {
    title: 'Compare, re-weight, decide',
    text: 'Put two or three companies side by side on one radar. Move the weights and watch the ranking change. View the pipeline ranked or by stage, with a live feed of what the team is doing.',
  },
  {
    title: 'Vote blind, then reveal',
    text: 'Committee members lock Invest or Pass with a reason. Nobody sees another ballot until the reveal, so the first opinion does not steer the room.',
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
          <section className="max-w-3xl pt-14 pb-16">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Deal screening for small funds and student investment clubs</p>
            <h1 className="font-display mt-4 text-5xl leading-[1.05] sm:text-6xl">Screen a company against your thesis in a minute, with the evidence attached.</h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
              Thesis Desk scores each company on your own criteria, shows the sentence behind every score, ranks the
              pipeline live for the whole team, and runs the committee vote blind.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/desk"
                className="inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Open the live desk
              </Link>
              <span className="text-sm text-muted-foreground">The pipeline is public to read. Sign in to add a company or vote.</span>
            </div>
          </section>

          <section aria-labelledby="example-title" className="mb-16 rounded-md border border-border bg-card p-6">
            <h2 id="example-title" className="text-sm font-medium text-muted-foreground">
              What a scorecard line looks like (fictional company)
            </h2>
            <div className="mt-5 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="font-medium">Recurring revenue</p>
                <p className="font-display mt-1 text-2xl text-positive">
                  9<span className="text-sm text-muted-foreground">/10</span>
                </p>
                <p className="mt-2 text-sm">Revenue comes from a monthly subscription.</p>
                <blockquote className="mt-3 border-l-2 border-primary pl-3 text-sm text-muted-foreground">
                  “Plans start at 89 euros per month, billed monthly, with no commitment.”
                  <footer className="mt-1 text-xs">
                    <span className="font-medium text-positive">✓ Found in the source</span> · the company’s pricing page
                  </footer>
                </blockquote>
              </div>
              <div>
                <p className="font-medium">Customer retention</p>
                <p className="font-display mt-1 text-base text-muted-foreground">Not scored</p>
                <p className="mt-2 text-sm">The analyst claimed very low churn.</p>
                <p className="mt-3 text-sm text-caution">
                  1 quote the analyst cited was not found in the source and was removed. No quote, no score.
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-x-10 gap-y-10 border-t border-border pt-12 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title}>
                <p className="font-display text-3xl tabular-nums text-primary">{i + 1}</p>
                <h2 className="mt-2 text-lg font-semibold">{step.title}</h2>
                <p className="mt-2 text-muted-foreground">{step.text}</p>
              </div>
            ))}
          </section>

          <section className="mt-16 max-w-2xl border-t border-border pt-12">
            <h2 className="font-display text-2xl">And it keeps reading</h2>
            <p className="mt-3 text-muted-foreground">
              Every Monday the desk looks for new headlines on the companies under review, flags them on the board and
              emails each member what changed on the companies they brought in.
            </p>
            <p className="mt-6 text-sm text-muted-foreground">
              Scores are a screening aid built from public pages. They are not investment advice.
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
