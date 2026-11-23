# Thesis Desk

Deal screening for a small fund or a student investment club.

A team writes its investment thesis once. Each company added to the desk is
researched by an AI analyst, scored against that thesis with a quoted sentence
behind every score, ranked on a board everyone sees live, and put to a blind
committee vote.

Live app: https://thesis-desk.app.space

Built on [DeepSpace](https://deep.space) for the DeepSpace build exercise.

## What you can do

1. Open the pipeline (public to read). Companies are ranked by a weighted score out of 100.
2. Move the weight sliders: the board re-ranks instantly, in your browser only. "What if growth mattered more than recurring revenue?"
3. Sign in and add a company (name + website), or press **Add the sample company** (fictional, free).
4. Watch the research run live: website read, a year of news searched, each criterion scored.
5. Open the scorecard: profile, radar chart, a rationale and quoted evidence per criterion, a screening memo with risks and questions for management, recent news. Download the memo as a PDF.
6. Vote: Invest or Pass, conviction 1 to 5, one sentence of reasoning. Ballots stay hidden until the member who brought the company closes the vote. Then every ballot appears for everyone at the same moment.
7. Every Monday the desk looks for new headlines on companies in Screening or Committee, flags them on the board and emails each member a digest of the companies they added.

## The rule that makes it trustworthy: no quote, no score

A language model will happily justify any score. So the model is not trusted.
It must cite a source id and copy a sentence from that source. Then plain code
(`verifyQuote` in `src/desk/providers.ts`) checks that the sentence appears
word for word in the page it cites. Quotes that fail are dropped. A score left
with no verified quote is removed and shown as "Not scored", and it is left
out of the total rather than counted as zero.

On the first real run (Zenchef) the model produced 10 quotes and 8 survived.
The sample company deliberately contains one invented quote so the tests prove
it is dropped.

## How research works

```
browser ──POST /api/actions/addDeal──▶ action: validate input, check spend limits,
                                        create the `deals` row, enqueue a job
                                                   │
                                        AppJobRoom (background job)
                                                   │
   1. firecrawl/scrape          read the company site (home + up to 2 business pages)
   2. exa/news-search           the last 12 months of news
   3. openai/chat-completion    score each criterion, citing quotes; write the memo
   4. verifyQuote (no AI)       keep only quotes found word for word in their source
   5. weightedScore             total out of 100 with the desk's weights
                                                   │
              every step writes to the `deals` row (status, live log, scorecard)
                                                   │
browser ◀──────── realtime sync (useQuery) ────────┘   every open board and scorecard updates
```

## DeepSpace features used, and why

| Feature | Where | Why |
| --- | --- | --- |
| Sign-in (Google / GitHub) | `SignInPrompt`, `AuthOverlay` | Reading is public; acting needs an identity (votes, spend limits, ownership). |
| Collections with RBAC | `src/schemas/desk-schemas.ts` | `deals` are public to read and written only by the server. `votes` use `read: 'published'` + `visibilityField`: a ballot is readable by its owner, or by everyone once `revealed` is `'yes'`. The blind vote is a permission, not a UI trick. |
| `uniqueOn` | `votes` schema | One vote per member per company, enforced by the Durable Object. |
| Realtime records (`useQuery`) | `desk.tsx`, `deal/[id].tsx` | Shared board, live research feed, live vote count, live reveal. No polling, no socket code of my own. |
| Server actions | `src/actions/index.ts` | The only write path. Each action checks who is asking, because action tools run with RBAC off. |
| Background jobs (`JobRoom`) | `src/jobs.ts`, `src/desk/research.ts` | Research takes 15 to 60 seconds. |
| Scheduled tasks (`CronRoom`) | `src/cron.ts` | Monday news watch and digest email. |
| `useCronMonitor` | `admin.tsx` | Owner page with **Run now**, to prove the schedule works without waiting for Monday. |
| Integration proxy | `src/desk/providers.ts` | Five integrations, no API key stored in this repo. |

### Integrations

| Integration | Used for | Why this one |
| --- | --- | --- |
| `firecrawl/scrape` | Reading the company website | Clean Markdown plus the page links in one call. |
| `exa/news-search` | A year of news, and the weekly watch | Returns article text and dates, so quotes can be verified against it. |
| `openai/chat-completion` | Scoring and the memo | One JSON call on a small model: about half a cent. |
| `latex-compiler/compile` | The PDF memo | A real document a partner can forward, built from the same data as the page. |
| `email/send` | The Monday digest | Monitoring only works if it comes to you. |

Left out on purpose: `prospeo` and `linkedin` (people data adds privacy
questions and cost for little screening value), `finnhub` (the companies a
small fund screens are private), `exa/findSimilar` (tested: it returned
directory pages about the same company, not competitors), an AI chat (the
scorecard already answers the questions a chat would be asked).

## Spend control

Researching one company costs about $0.05 in credits on the free tier. Measured.

- Research needs sign-in, and jobs can only be queued by the server (`authorizeWrite` in `worker.ts` is admin-only).
- 3 research runs per member per 24 hours, 12 for the whole desk (`src/desk/start.ts`).
- One row per company: adding a company that is already on the desk opens the existing scorecard.
- PDF export is capped at 5 per company.
- The weekly watch checks at most 8 companies, one search each.
- Digest emails go to the address of the member's verified account, never to one typed in a form. No email address is written to public rows.
- The sample company runs the whole pipeline on saved material and costs nothing.

## The main tradeoff

**Strict verification over coverage.**

Dropping every score that lacks a verbatim quote makes the scorecard smaller
and sometimes harsher than a human analyst would be: the model may be right
about "strong retention" and still lose the score because it paraphrased the
source instead of quoting it. I chose that side because a screening tool that
is confidently wrong about a company is worse than one that says "not scored".
The cost shows up as criteria marked "Not scored" and as scores resting on a
thin quote (a pricing page sentence standing in for "recurring revenue").

A second, smaller tradeoff: one shared desk for everyone who signs in, instead
of private workspaces with invitations. It makes the realtime collaboration
visible in two clicks and matches how a small committee works, at the price of
multi-tenancy, which this version does not have.

## Honest limits

- Sources are the company's own site and news. There are no financial statements: revenue, margins and valuation are not screened.
- A company's own website is marketing. "Market position" scored from it should be read as "what the company claims".
- News is kept only when the article names the company as whole words (the first weekly digest listed ShopBack and Backcountry for "Back Market" before this filter existed). A company with a very common name can still collect unrelated articles, and a relevant article can still be low value (a shopping deal page).
- Verification proves a sentence exists in the source. It does not prove the sentence supports the score.
- One desk, one thesis. No private workspaces, no invitations, no comments.
- After the reveal a vote cannot be reopened.
- The PDF uses pdflatex and drops characters outside Latin-1.

What I would build next: private desks with invitations, uploaded documents
(decks, financials) as extra sources, and a view of how each member's past
votes compare with what happened to the company.

## Run it

```bash
npm install
npx deepspace auth login
npx deepspace dev start        # http://localhost:5173
```

## Tests

```bash
npm run test:unit              # 26 unit tests: scoring, quote verification, parsing, email, LaTeX
npx deepspace test run all     # + 15 browser tests
```

The browser tests run on the sample company, so none makes a paid call. They
cover: live research ending with exactly the verified quotes; what-if weights;
a two-account blind vote (each browser receives only its own ballot from the
server until the reveal, then both appear live); and a member being refused
when they try to delete, reveal, re-run or change the thesis on a company they
did not add.

## File map

```
src/desk/types.ts        shared types: thesis, deal, scorecard, vote
src/desk/providers.ts    the integrations behind one interface + quote verification
src/desk/sample.ts       the same interface with saved material (sample + tests)
src/desk/research.ts     the research steps and the weekly news watch
src/desk/start.ts        spend limits, queue the job
src/desk/score.ts        weighted score, coverage, vote tally
src/desk/pdf.ts          the memo as LaTeX
src/desk/email.ts        the Monday digest
src/actions/index.ts     server actions (the only write path)
src/jobs.ts              background job dispatch
src/cron.ts              the Monday task
src/schemas/             collections and permissions (the blind vote lives here)
src/pages/               landing, pipeline board, scorecard, owner page
tests/desk.spec.ts       end-to-end, blind vote and permission tests
```
