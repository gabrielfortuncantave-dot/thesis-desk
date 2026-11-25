# Thesis Desk

Know who to go after, and why, with the proof attached.

A go-to-market team writes its thesis once: who it wants, and the weighted
criteria that make a target worth a call. The desk then finds matching
organisations on the web, has an AI analyst research and score each one with a
quoted sentence behind every score, argues both sides, drafts a first message,
ranks everything on a board the whole team sees live, and runs a blind vote.

- Live app: https://thesis-desk.app.space
- How it works, and where it stops: https://thesis-desk.app.space/about

The live desk runs a real example: finding the first partners for a developer
platform where AI agents ship full-stack apps. The targets are real builder
communities, scored from their own public pages. They have no link with this
project.

Built on [DeepSpace](https://deep.space) for the DeepSpace build exercise.

## The one flow

1. **Thesis.** Six weighted criteria. Move a weight and the pipeline re-ranks at once, in your browser only.
2. **Scout.** Under the pipeline, "Scouted for this thesis" lists organisations a web search matched to the thesis. One click researches one.
3. **Research, live.** Website read, a year of news searched, each criterion scored. Everyone watching sees each step land.
4. **Scorecard.** A rationale and quoted evidence per criterion, why they would say yes, why they would say no, objections to expect, and a draft first message for a person to edit and send.
5. **Blind vote.** Pursue or Skip, conviction 1 to 5, one sentence of reasoning. Ballots stay hidden until the member who brought the target closes the vote. The result is then announced on every open screen.
6. **Monday.** New headlines on targets in play, a digest by email, and a fresh scout.

## The rule that makes it trustworthy: no quote, no score

A language model will justify any score. So the model is not trusted. It must
cite a source id and copy a sentence from that source. Then plain code
(`verifyQuote` in `src/desk/providers.ts`) checks that the sentence appears
word for word in the page it cites. A quote shortened with "…" passes only if
each part is in the source, in order.

- A score left with no verified quote is removed, shown as "Not scored", and left out of the total rather than counted as zero.
- A "say yes" or "say no" argument without a verified quote is not shown.
- The draft first message is shown only if the fact it mentions is a verified quote, and only for a target scoring 60 or more.
- The scorecard says how many quotes were removed per criterion. Their text goes to the server log only: an unverified claim about a real organisation should not sit on a public page.

On real runs the check removed between 0 and 5 quotes out of 10 to 12. The
sample target contains invented quotes on purpose, so the tests prove they are
dropped.

Web pages are untrusted input. The analyst is told to treat source text as data
and to ignore instructions inside it, and every link rendered from a source
goes through `safeHref` (http and https only). This reduces prompt injection;
it does not eliminate it.

## How research works

```
browser ──POST /api/actions/addDeal──▶ action: validate input, check spend limits,
                                        create the `deals` row, enqueue a job
                                                   │
                                        AppJobRoom (background job)
                                                   │
   1. read the website         firecrawl/scrape → exa/contents → plain fetch (first that works)
   2. exa/news-search          the last 12 months, kept only if the article names the target
   3. openai/chat-completion   scores, both sides, brief, draft message, all citing quotes
   4. verifyQuote (no AI)      keep only what is found word for word in its source
   5. weightedScore            total out of 100 with the desk's weights
                                                   │
              every step writes to the `deals` row (status, live log, scorecard)
                                                   │
browser ◀──────── realtime sync (useQuery) ────────┘   every open board and scorecard updates
```

## DeepSpace features used, and why

| Feature | Where | Why |
| --- | --- | --- |
| Sign-in (Google / GitHub) | `SignInPrompt`, `AuthOverlay` | Reading is public; acting needs an identity (votes, spend limits, ownership). |
| Collections with RBAC | `src/schemas/desk-schemas.ts` | Nobody writes from the browser. `votes` use `read: 'published'` + `visibilityField`: a ballot is readable by its owner, or by everyone once `revealed` is `'yes'`. The blind vote is a permission, not a UI trick. |
| `uniqueOn` | `votes` schema | One vote per member per target, enforced by the Durable Object. |
| Realtime records (`useQuery`) | `desk.tsx`, `deal/[id].tsx`, `DeskLive.tsx` | Shared board, live research feed, live vote count, live reveal, activity feed. No polling, no socket code of my own. |
| Server actions | `src/actions/index.ts` | The only write path. Each action checks who is asking, because action tools run with RBAC off. |
| Background jobs (`JobRoom`) | `src/jobs.ts`, `src/desk/research.ts` | Research takes 15 to 60 seconds. |
| Scheduled tasks (`CronRoom`) | `src/cron.ts` | Monday news watch, digest email, scout. |
| `useCronMonitor` | `admin.tsx` | Owner page with **Run now**, to prove the schedule works without waiting for Monday. |
| Integration proxy | `src/desk/providers.ts` | Four integrations, no API key stored in this repo. |

### Integrations

| Integration | Used for | Why this one |
| --- | --- | --- |
| `firecrawl/scrape` | Reading the target's website | Clean Markdown plus the page links in one call. |
| `exa/contents`, `exa/news-search`, `exa/search` | Backup website reader, a year of news, the scout | News comes with article text and dates, so quotes can be verified against it. With `category: 'company'` and the thesis as the query, search returns real organisations. |
| `openai/chat-completion` | Scoring, both sides, the brief, the draft message | One JSON call on a small model: about half a cent. |
| `email/send` | The Monday digest | Monitoring only works if it comes to you. |

Why three website readers: during the build the platform's Firecrawl account
ran out of credits and every scrape answered 402, so research failed for
everyone. The job now tries each reader in turn and says in the live feed
which one it used.

Left out on purpose: `prospeo`, `anymailfinder` and `linkedin` (looking up
people's emails turns a targeting tool into a spam tool; the desk stops at
organisations), `latex-compiler` (see below), an AI chat (the scorecard already
answers what a chat would be asked).

## What I cut, and why

An earlier build (git tag `full-v4`) also had a market map, a side-by-side
comparison, a by-stage board, a PDF export through `latex-compiler`, a presence
line and a second playbook for investment screening. All of them worked and
were tested. None of them helped answer the one question the desk exists for,
and each was one more thing between a visitor and the main flow. They were
removed so that everything left can be explained in a minute.

## Spend control

Researching one target costs about $0.05 in credits on the free tier. Measured.

- Research needs sign-in, and jobs can only be queued by the server (`authorizeWrite` in `worker.ts` is admin-only).
- 5 research runs per member per 24 hours, 15 for the whole desk (`src/desk/start.ts`).
- One row per organisation: adding one that is already on the desk opens the existing scorecard.
- The scout is one search, run on Mondays or by an admin. Visitors only read its saved result.
- The weekly watch checks at most 8 targets, one search each.
- Digest emails go to the address of the member's verified account, never to one typed in a form. No email address is written to public rows.
- The sample target runs the whole pipeline on saved material and costs nothing.

## The main tradeoff

**Strict verification over coverage.**

Dropping every score that lacks a verbatim quote makes the scorecard smaller
and sometimes harsher than a human would be: the model may be right and still
lose the score because it paraphrased instead of quoting. I chose that side
because a targeting tool that is confidently wrong about an organisation is
worse than one that says "not scored". The cost shows up as criteria marked
"Not scored" and as scores resting on a thin quote.

A second, smaller tradeoff: one shared desk for everyone who signs in, instead
of private workspaces with invitations. It makes the realtime collaboration
visible in two clicks, at the price of multi-tenancy, which this version does
not have.

## Honest limits

- Sources are the target's own site and news. A website is marketing: a high score means "what they say about themselves fits", not "they will say yes".
- Verification proves a sentence exists in the source. It does not prove the sentence supports the score.
- The draft first message is a starting point and can be bland. It is never sent by the app.
- The example thesis is an outsider's reading. The weights are opinions; that is why they are sliders.
- Scouted organisations are search results, not recommendations, until they are researched. The scout searches with a description of the target, kept separate from the thesis: the first live scout used the thesis text ("we are a developer platform…") and returned competitors.
- News is kept only when the article names the target as whole words. A very common name can still collect unrelated articles.
- One desk, one thesis. No private workspaces, no invitations, no comments.
- After the reveal a vote cannot be reopened. The activity feed is never trimmed.

What I would build next: private desks with invitations, uploaded documents as
extra sources, and a record of which pursued targets actually replied.

## Run it

```bash
npm install
npx deepspace auth login
npx deepspace dev start        # http://localhost:5173
```

## Tests

```bash
npm run test:unit              # unit tests: scoring, verdict, quote verification, arguments, draft message, scout, HTML reading, email
npx deepspace test run all     # + browser tests
```

The browser tests run on the sample target, so none makes a paid call. They
cover: live research ending with exactly the verified quotes, arguments and
draft message; what-if weights; a two-account blind vote (each browser receives
only its own ballot from the server until the reveal, then the result is
announced on the other member's screen); and a member being refused when they
try to delete, reveal, re-run or change the thesis on a target they did not add.

## File map

```
src/desk/types.ts        shared types and the playbook (wording, stages, starting thesis)
src/desk/providers.ts    the integrations behind one interface + quote verification
src/desk/sample.ts       the same interface with saved material (sample + tests)
src/desk/research.ts     the research steps and the weekly news watch
src/desk/start.ts        spend limits, queue the job, the scout
src/desk/score.ts        weighted score, vote tally, verdict
src/desk/email.ts        the Monday digest
src/desk/activity.ts     one line in the public feed per event
src/actions/index.ts     server actions (the only write path)
src/jobs.ts              background job dispatch
src/cron.ts              the Monday task
src/schemas/             collections and permissions (the blind vote lives here)
src/pages/               landing, about, pipeline board, scorecard, owner page
tests/desk.spec.ts       end-to-end, blind vote and permission tests
```
