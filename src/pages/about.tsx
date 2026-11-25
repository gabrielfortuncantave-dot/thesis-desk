/**
 * "How it works, and where it stops" — a STATIC page, like the landing.
 * It says in public what the README says to developers: what the desk does,
 * what it deliberately does not do, and what it was built with.
 */

import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { seo } from '../seo'

const FLOW = [
  ['You write the thesis', 'Who you want and the criteria that make a target worth a call, each with a weight.'],
  ['The scout searches', 'One web search built from the thesis text. Its result is saved on the desk, so every visitor reads it for free.'],
  ['The analyst reads', 'The target’s own website and a year of news. If the first website reader is down, a second and a third take over.'],
  ['The server checks every quote', 'A score, an argument or a draft message is kept only if the sentence it cites is found, word for word, in the page it names.'],
  ['The team decides blind', 'A ballot can be read only by its author until the reveal. That is a permission on the data, not something the screen hides.'],
  ['Monday', 'New headlines on targets in play, a digest by email, and a fresh scout.'],
]

const LIMITS = [
  'It reads public pages only. A target’s own website is marketing, so a high score means “what they say about themselves fits”, not “they will say yes”.',
  'The quote check proves a sentence exists in the source. It does not prove the sentence supports the score.',
  'A page written to mislead could still push a score up. The analyst is told to ignore instructions found inside sources; that lowers the risk and does not remove it.',
  'The draft first message is a starting point. The desk never sends anything and never looks up a person’s email address, on purpose.',
  'One shared desk and one thesis. There are no private workspaces or invitations yet.',
  'After a reveal a vote cannot be reopened.',
]

const BUILT_WITH = [
  ['Sign-in', 'Reading is public. Adding a target, voting and scouting need an identity.'],
  ['Collections and permissions', 'Nobody writes from the browser. A ballot is readable by its owner, or by everyone once it is revealed. One vote per member per target.'],
  ['Real-time records', 'The pipeline, the research feed, the vote count and the reveal update on every open screen.'],
  ['Server actions', 'The only way to change data. Each one checks who is asking and the spend limits.'],
  ['A background job', 'Research takes 15 to 60 seconds, longer than a page request should wait.'],
  ['A scheduled task', 'The Monday news watch, digest and scout.'],
  ['Four integrations', 'Website reading (Firecrawl, with Exa as backup), web and news search (Exa), analysis (OpenAI), email (the Monday digest).'],
]

export default function About() {
  return (
    <>
      <Seo {...seo} title="How Thesis Desk works, and where it stops" path="/about" />
      <div className="min-h-screen bg-background text-foreground" data-testid="about-page">
        <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
          <Link to="/" className="font-display text-lg">
            Thesis Desk
          </Link>
          <Link to="/desk" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Open the desk
          </Link>
        </header>
        <main className="mx-auto max-w-3xl px-6 pb-24">
          <h1 className="font-display pt-10 text-4xl sm:text-5xl">How it works, and where it stops</h1>

          <h2 className="font-display mt-12 text-2xl">The flow</h2>
          <ol className="mt-4 space-y-4">
            {FLOW.map(([title, text], i) => (
              <li key={title} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2">
                <span className="font-display text-xl tabular-nums text-primary">{i + 1}</span>
                <span>
                  <span className="font-medium">{title}.</span> <span className="text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ol>

          <h2 className="font-display mt-12 text-2xl">Where it stops</h2>
          <ul className="mt-4 list-disc space-y-3 pl-5 text-muted-foreground">
            {LIMITS.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>

          <h2 className="font-display mt-12 text-2xl">What was cut</h2>
          <p className="mt-4 text-muted-foreground">
            An earlier build also had a market map, a side-by-side comparison, a PDF export and a second playbook for
            investment screening. They worked, and none of them helped answer the one question the desk exists for: who
            do we go after first, and why. They were removed so that everything left can be explained in a minute.
          </p>

          <h2 className="font-display mt-12 text-2xl">Built on DeepSpace</h2>
          <dl className="mt-4 space-y-4">
            {BUILT_WITH.map(([name, why]) => (
              <div key={name}>
                <dt className="font-medium">{name}</dt>
                <dd className="text-muted-foreground">{why}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-12 text-sm text-muted-foreground">
            Scores are a screening aid built from public pages. They are not advice, and the organisations on the desk
            have no link with this project.
          </p>
        </main>
        <footer className="border-t border-border">
          <p className="mx-auto max-w-3xl px-6 py-6 text-sm text-muted-foreground">Built by Gabriel Fortun on DeepSpace.</p>
        </footer>
      </div>
    </>
  )
}
