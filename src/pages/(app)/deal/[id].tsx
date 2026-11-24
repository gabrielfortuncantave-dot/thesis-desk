/**
 * One company: the scorecard, the memo, the news, and the committee vote.
 *
 * Everything here is a live subscription. While research runs, the job
 * appends to `deal.log` and this page shows each line as it lands. When the
 * votes are revealed, the `votes` rows become readable and appear for every
 * member looking at the page, at the same moment.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useUser } from 'deepspace'
import { Button, Label, Textarea, useToast } from '@/components/ui'
import { RadarChart, StageChip, TotalScore, scoreTone } from '../../../components/Score'
import { SignInPrompt } from '../../../components/SignInPrompt'
import { callAction } from '../../../lib/actions'
import { useDesk, usePlaybook } from '../../../lib/desk'
import { coverage, tally, verdict, weightedScore } from '../../../desk/score'
import { STAGES, type CasePoint, type Deal, type Playbook, type Vote } from '../../../desk/types'
import { safeHref } from '../../../desk/validate'

export default function DealPage() {
  const { id = '' } = useParams()
  const { user } = useUser()
  const desk = useDesk()
  const words = usePlaybook()
  const toast = useToast()
  const navigate = useNavigate()
  const deals = useQuery<Deal>('deals', { where: { recordId: id } })
  const votes = useQuery<Vote>('votes', { where: { dealId: id } })
  const [working, setWorking] = useState('')

  if (deals.status === 'loading') return <Shell>Loading…</Shell>
  const deal = deals.records[0]?.data
  if (!deal) {
    return (
      <Shell>
        <p>This target is not on the desk (it may have been removed).</p>
        <Link to="/desk" className="mt-4 inline-block underline underline-offset-4">
          Back to the pipeline
        </Link>
      </Shell>
    )
  }

  const running = !['done', 'failed'].includes(deal.status)
  const total = weightedScore(deal.scores ?? [], desk.criteria)
  const { scored, total: criteriaCount } = coverage(deal.scores ?? [], desk.criteria)
  const canManage = Boolean(user) && (user!.id === deal.addedBy || user!.role === 'admin')

  /** Run an action, show its refusal as a toast, and say whether it worked. */
  async function run<T>(label: string, action: string, params: Record<string, unknown> = {}) {
    setWorking(label)
    const reply = await callAction<T>(action, { dealId: id, ...params })
    setWorking('')
    if (!reply.success) toast.warning('Not done', reply.error)
    return reply
  }

  async function downloadMemo() {
    const reply = await run<{ pdfBase64: string; fileName: string }>('pdf', 'exportMemo')
    if (!reply.success) return
    const bytes = Uint8Array.from(atob(reply.data.pdfBase64), (c) => c.charCodeAt(0))
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
    const link = document.createElement('a')
    link.href = url
    link.download = reply.data.fileName
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-full text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link to="/desk" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Pipeline
        </Link>

        <header className="mt-4 grid gap-8 md:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-4xl">{deal.name}</h1>
              <StageChip stage={deal.stage} label={words.stageLabels[deal.stage]} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {deal.isSample ? (
                'Sample target. It is fictional and its research is saved material: no paid call was made.'
              ) : (
                <a href={safeHref(deal.websiteUrl) ?? '#'} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                  {deal.websiteUrl}
                </a>
              )}
              {' · '}added by {deal.addedByName}
              {deal.researchedAt && ` · researched ${new Date(deal.researchedAt).toLocaleDateString()}`}
            </p>
            {deal.profile?.oneLiner && <p className="mt-5 text-lg">{deal.profile.oneLiner}</p>}
            {deal.profile && (
              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                {(
                  [
                    ['Sector', deal.profile.sector],
                    ['Business model', deal.profile.businessModel],
                    ['Customers', deal.profile.customers],
                    ['Headquarters', deal.profile.headquarters],
                    ['Founded', deal.profile.founded],
                    ['Size', deal.profile.size],
                  ] as const
                )
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
                      <dd className="mt-0.5">{value}</dd>
                    </div>
                  ))}
              </dl>
            )}
            {user && (
              <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
                <label htmlFor="stage" className="text-muted-foreground">
                  Stage
                </label>
                <select
                  id="stage"
                  data-testid="stage-select"
                  value={deal.stage}
                  onChange={(e) => void run('stage', 'setStage', { stage: e.target.value })}
                  className="rounded-md border border-input bg-card px-2 py-1"
                >
                  {STAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {words.stageLabels[s.id]}
                    </option>
                  ))}
                </select>
                {canManage && !running && (
                  <>
                    <button type="button" className="underline underline-offset-4" disabled={working !== ''} onClick={() => void run('rerun', 'rerunResearch')}>
                      Research again
                    </button>
                    <button
                      type="button"
                      className="text-negative underline underline-offset-4"
                      disabled={working !== ''}
                      data-testid="delete-deal"
                      onClick={async () => {
                        if (!window.confirm(`Remove ${deal.name} and its votes from the desk?`)) return
                        const reply = await run('delete', 'deleteDeal')
                        if (reply.success) navigate('/desk')
                      }}
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {deal.status === 'done' && (
            <div className="flex flex-col items-center" data-testid="score-panel">
              <TotalScore score={total} size="lg" />
              <p className="mt-1 text-xs text-muted-foreground">
                {scored} of {criteriaCount} criteria scored
              </p>
              {typeof total === 'number' && typeof deal.previousScore === 'number' && total !== deal.previousScore && (
                <p className="mt-1 text-xs" data-testid="score-delta">
                  <span className={total > deal.previousScore ? 'text-positive' : 'text-negative'}>
                    {total > deal.previousScore ? '▲' : '▼'} {Math.abs(total - deal.previousScore)} points
                  </span>{' '}
                  <span className="text-muted-foreground">since the previous research</span>
                </p>
              )}
              <RadarChart series={[{ name: deal.name, scores: deal.scores ?? [] }]} criteria={desk.criteria} />
            </div>
          )}
        </header>

        {(running || deal.status === 'failed') && (
          <section className="mt-8 rounded-md border border-border bg-card p-5" aria-live="polite" data-testid="research-feed" data-status={deal.status}>
            <h2 className="font-display text-lg">{running ? 'Research in progress' : 'Research failed'}</h2>
            <ol className="mt-3 space-y-1.5 text-sm">
              {(deal.log ?? []).map((line, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full bg-primary ${running && i === (deal.log ?? []).length - 1 ? 'desk-pulse' : ''}`}
                    aria-hidden="true"
                  />
                  {line}
                </li>
              ))}
            </ol>
            {deal.status === 'failed' && (
              <p role="alert" className="mt-3 text-sm text-negative">
                Nothing below is complete.{canManage ? ' Use “Research again” to retry.' : ''}
              </p>
            )}
          </section>
        )}

        {deal.status === 'done' && (
          <>
            <section className="mt-12" aria-labelledby="scorecard-title">
              <h2 id="scorecard-title" className="font-display text-2xl">
                Scorecard
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Each score needs a sentence quoted word for word from a public page. No verified quote, no score.
                {(deal.log ?? []).filter((line) => line.startsWith('Verified')).map((line) => (
                  <span key={line} data-testid="verification-line"> {line}.</span>
                ))}
              </p>
              <ul className="mt-5 divide-y divide-border rounded-md border border-border bg-card" data-testid="scorecard">
                {desk.criteria.map((c) => {
                  const s = (deal.scores ?? []).find((x) => x.key === c.key)
                  return (
                    <li key={c.key} className="grid gap-3 p-5 sm:grid-cols-[11rem_minmax(0,1fr)]" data-testid="criterion-row" data-scored={typeof s?.score === 'number'}>
                      <div>
                        <p className="font-medium">{c.label}</p>
                        <p className={`font-display mt-1 text-2xl tabular-nums ${scoreTone(s?.score, 10)}`}>
                          {typeof s?.score === 'number' ? (
                            <>
                              {s.score}
                              <span className="text-sm text-muted-foreground">/10</span>
                            </>
                          ) : (
                            <span className="text-base">Not scored</span>
                          )}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">Weight {c.weight}</p>
                      </div>
                      <div className="text-sm">
                        <p>{s?.rationale || 'No analysis for this criterion.'}</p>
                        {(s?.evidence ?? []).map((e) => (
                          <blockquote key={e.quote} data-testid="evidence" className="mt-3 border-l-2 border-primary pl-3 text-muted-foreground">
                            “{e.quote}”
                            <footer className="mt-1 text-xs">
                              <span className="font-medium text-positive">✓ Found in the source</span>
                              {' · '}
                              {deal.isSample || !safeHref(e.url) ? (
                                e.title
                              ) : (
                                <a href={safeHref(e.url)!} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                                  {e.title}
                                </a>
                              )}
                            </footer>
                          </blockquote>
                        ))}
                        {(s?.dropped ?? 0) > 0 && (
                          <p className="mt-3 text-xs text-caution" data-testid="dropped-note">
                            {s!.dropped} quote{s!.dropped === 1 ? '' : 's'} the analyst cited {s!.dropped === 1 ? 'was' : 'were'} not found in the source and {s!.dropped === 1 ? 'was' : 'were'} removed.
                          </p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>

            {deal.memo && (
              <section className="mt-12" aria-labelledby="memo-title">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <h2 id="memo-title" className="font-display text-2xl">
                    {words.briefTitle}
                  </h2>
                  {user && (
                    <Button variant="secondary" disabled={working !== ''} onClick={() => void downloadMemo()} data-testid="pdf-button">
                      {working === 'pdf' ? 'Building the PDF…' : 'Download as PDF'}
                    </Button>
                  )}
                </div>
                <div className="mt-4 grid gap-8 md:grid-cols-2">
                  <div className="space-y-4">
                    <p>{deal.memo.summary}</p>
                    <p>
                      <span className="font-medium">Fit with the thesis. </span>
                      {deal.memo.fit}
                    </p>
                  </div>
                  <div className="space-y-5 text-sm">
                    <div>
                      <h3 className="font-medium">{words.risksTitle}</h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {deal.memo.risks.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-medium">{words.questionsTitle}</h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {deal.memo.questions.map((q) => (
                          <li key={q}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
                {deal.memo.opener && (
                  <div className="mt-8 rounded-md border border-primary bg-card p-5" data-testid="opener">
                    <h3 className="font-display text-xl">Draft first message</h3>
                    <p className="mt-1 text-xs text-muted-foreground">A starting point for a person to edit and send. This app never sends anything to a target.</p>
                    <p className="mt-4 whitespace-pre-wrap">{deal.memo.opener.text}</p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      <span className="font-medium text-positive">✓ The fact it mentions was found in the source</span>: “{deal.memo.opener.quote}”
                    </p>
                    <Button
                      variant="secondary"
                      className="mt-4"
                      onClick={() => void navigator.clipboard.writeText(deal.memo!.opener!.text).then(() => toast.success('Copied', 'Edit it before you send it.'))}
                    >
                      Copy
                    </Button>
                  </div>
                )}
              </section>
            )}

            {(deal.news ?? []).length > 0 && (
              <section className="mt-12" aria-labelledby="news-title">
                <h2 id="news-title" className="font-display text-2xl">
                  In the news
                </h2>
                <ul className="mt-4 divide-y divide-border rounded-md border border-border bg-card text-sm">
                  {deal.news.map((n) => (
                    <li key={n.url} className="p-4">
                      <p>
                        {n.isNew && <span className="mr-2 rounded-full bg-caution/15 px-2 py-0.5 text-xs font-medium text-caution">New this week</span>}
                        {deal.isSample || !safeHref(n.url) ? (
                          <span className="font-medium">{n.title}</span>
                        ) : (
                          <a href={safeHref(n.url)!} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4">
                            {n.title}
                          </a>
                        )}
                        {n.date && <span className="text-muted-foreground"> · {n.date}</span>}
                      </p>
                      {n.summary && <p className="mt-1 text-muted-foreground">{n.summary}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {((deal.bull ?? []).length > 0 || (deal.bear ?? []).length > 0) && (
              <section className="mt-12" aria-labelledby="case-title" data-testid="cases">
                <h2 id="case-title" className="font-display text-2xl">
                  The case for, the case against
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  The analyst argues both sides before anyone votes. An argument is shown only if its quote was found in the source.
                </p>
                <div className="mt-5 grid gap-6 md:grid-cols-2">
                  <CaseColumn title={words.forTitle} tone="text-positive" border="border-positive" points={deal.bull ?? []} sample={Boolean(deal.isSample)} testId="bull" />
                  <CaseColumn title={words.againstTitle} tone="text-negative" border="border-negative" points={deal.bear ?? []} sample={Boolean(deal.isSample)} testId="bear" />
                </div>
              </section>
            )}

            <Committee deal={deal} votes={votes.records.map((v) => v.data)} userId={user?.id} canManage={canManage} run={run} working={working} words={words} />
          </>
        )}
      </div>
    </div>
  )
}

/**
 * The blind vote. Before the reveal a member can read only their own ballot:
 * that is enforced by the `votes` schema on the server, so `votes` here simply
 * contains whatever this visitor is allowed to see.
 */
function Committee({
  deal,
  votes,
  userId,
  canManage,
  run,
  working,
  words,
}: {
  words: Playbook
  deal: Deal
  votes: Vote[]
  userId: string | undefined
  canManage: boolean
  run: (label: string, action: string, params?: Record<string, unknown>) => Promise<{ success: boolean }>
  working: string
}) {
  const mine = votes.find((v) => v.voterId === userId)
  const revealed = deal.voting === 'revealed'
  const result = tally(votes)
  const decision = verdict(result)
  // The stored decision is 'Invest' / 'Pass' / 'Split'; the playbook says what the team calls it.
  const decisionLabel = decision === 'Invest' ? words.yes : decision === 'Pass' ? words.no : 'Split'

  // The reveal is a shared moment: anyone who has this page open when the vote
  // closes sees the result announced, without touching anything. Opening an
  // already-revealed vote later does not replay it.
  const wasOpen = useRef(deal.voting === 'open')
  const [announce, setAnnounce] = useState(false)
  useEffect(() => {
    if (deal.voting === 'revealed' && wasOpen.current && votes.length > 0) {
      wasOpen.current = false
      setAnnounce(true)
    }
  }, [deal.voting, votes.length])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    await run('vote', 'castVote', { decision: form.get('decision'), conviction: form.get('conviction'), reason: form.get('reason') })
  }

  return (
    <section
      className="mt-12"
      aria-labelledby="committee-title"
      data-testid="committee"
      data-voting={deal.voting}
      // How many ballots the server actually sent to this browser. The tests read it to prove blindness.
      data-ballots-received={votes.length}
    >
      {announce && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="announce-title"
          data-testid="reveal-moment"
          className="reveal-moment fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-6"
          onClick={() => setAnnounce(false)}
        >
          <div className="w-full max-w-lg rounded-md border border-border bg-card p-10 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">The team has decided on {deal.name}</p>
            <p id="announce-title" className={`font-display mt-4 text-6xl ${decision === 'Invest' ? 'text-positive' : decision === 'Pass' ? 'text-negative' : 'text-caution'}`}>
              {decisionLabel}
            </p>
            <p className="mt-4 text-lg">
              {words.yes} {result.invest} · {words.no} {result.pass}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Conviction {result.investConviction} for, {result.passConviction} against
            </p>
            <Button className="mt-8" autoFocus onClick={() => setAnnounce(false)}>
              See the ballots
            </Button>
          </div>
        </div>
      )}
      <h2 id="committee-title" className="font-display text-2xl">
        {words.voteTitle}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {revealed
          ? 'The vote is closed. Every ballot is shown below.'
          : 'Votes are blind: nobody sees another member’s ballot until the reveal, so the first opinion does not steer the rest.'}
      </p>

      <div className="mt-5 grid gap-8 md:grid-cols-2">
        <div className="rounded-md border border-border bg-card p-5">
          {revealed ? (
            <div data-testid="vote-result">
              <p className="font-display text-3xl">
                <span className="text-positive">
                  {words.yes} {result.invest}
                </span>
                <span className="mx-3 text-muted-foreground">·</span>
                <span className="text-negative">
                  {words.no} {result.pass}
                </span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Conviction: {result.investConviction} for, {result.passConviction} against. Decision: <span className="font-medium text-foreground">{decisionLabel}</span>.
              </p>
            </div>
          ) : !userId ? (
            <SignInPrompt what="vote" />
          ) : (
            <form onSubmit={onSubmit} className="space-y-4" data-testid="vote-form">
              <fieldset>
                <legend className="text-sm font-medium">Your decision</legend>
                <div className="mt-2 flex gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="decision" value="invest" required defaultChecked={mine?.decision === 'invest'} /> {words.yes}
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="decision" value="pass" required defaultChecked={mine?.decision === 'pass'} /> {words.no}
                  </label>
                </div>
              </fieldset>
              <div>
                <Label htmlFor="conviction">Conviction</Label>
                <select id="conviction" name="conviction" defaultValue={mine?.conviction ?? 3} className="mt-1.5 block rounded-md border border-input bg-card px-2 py-1 text-sm">
                  <option value={1}>1, weak</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5, strong</option>
                </select>
              </div>
              <div>
                <Label htmlFor="reason">Your reason, in a sentence</Label>
                <Textarea id="reason" name="reason" required minLength={10} maxLength={400} defaultValue={mine?.reason ?? ''} className="mt-1.5" />
              </div>
              <Button type="submit" disabled={working !== ''}>
                {mine ? 'Change my vote' : 'Lock my vote'}
              </Button>
              {mine && (
                <p className="text-sm text-positive" data-testid="my-vote-locked">
                  ✓ Your vote is locked: {mine.decision === 'invest' ? words.yes : words.no}, conviction {mine.conviction}. Only you can see it.
                </p>
              )}
            </form>
          )}
        </div>

        <div>
          {revealed ? (
            <ul className="space-y-3" data-testid="ballots">
              {votes.map((v) => (
                <li key={v.voterId} data-testid="ballot" className="rounded-md border border-border bg-card p-4 text-sm">
                  <p className="font-medium">
                    {v.voterName}
                    <span className={`ml-2 ${v.decision === 'invest' ? 'text-positive' : 'text-negative'}`}>
                      {v.decision === 'invest' ? words.yes : words.no} · conviction {v.conviction}
                    </span>
                  </p>
                  <p className="mt-1 text-muted-foreground">{v.reason}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-md border border-dashed border-border p-5 text-sm">
              <p className="font-display text-3xl tabular-nums" data-testid="locked-count">
                {deal.voteCount ?? 0}
              </p>
              <p className="text-muted-foreground">vote{deal.voteCount === 1 ? '' : 's'} locked</p>
              {canManage && (deal.voteCount ?? 0) > 0 && (
                <Button className="mt-4" variant="secondary" disabled={working !== ''} onClick={() => void run('reveal', 'revealVotes')} data-testid="reveal-button">
                  Close the vote and reveal
                </Button>
              )}
              {!canManage && <p className="mt-3 text-muted-foreground">The member who added this target reveals the votes.</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function CaseColumn({ title, tone, border, points, sample, testId }: { title: string; tone: string; border: string; points: CasePoint[]; sample: boolean; testId: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-5" data-testid={testId}>
      <h3 className={`font-display text-xl ${tone}`}>{title}</h3>
      {points.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No argument on this side survived the quote check.</p>
      ) : (
        <ol className="mt-3 space-y-4 text-sm">
          {points.map((p) => (
            <li key={p.point} data-testid="case-point">
              <p className="font-medium">{p.point}</p>
              <blockquote className={`mt-2 border-l-2 pl-3 text-muted-foreground ${border}`}>
                “{p.quote}”
                <footer className="mt-1 text-xs">
                  {sample || !safeHref(p.url) ? (
                    p.title
                  ) : (
                    <a href={safeHref(p.url)!} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                      {p.title}
                    </a>
                  )}
                </footer>
              </blockquote>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-5xl px-6 py-12 text-sm text-muted-foreground">{children}</div>
}
