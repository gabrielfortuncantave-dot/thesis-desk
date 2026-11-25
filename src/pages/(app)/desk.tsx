/**
 * The pipeline board — public to read, live for everyone looking at it.
 *
 * `useQuery('deals')` is a realtime subscription: a company someone else adds,
 * a research step, a stage move or a new vote count shows up here without a
 * refresh. Ranking is computed in the browser from the stored criterion
 * scores, so the what-if sliders re-rank the board instantly and privately.
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useUser } from 'deepspace'
import { Button, Input, Label, useToast } from '@/components/ui'
import { CriteriaBars, StageChip, TotalScore } from '../../components/Score'
import { ActivityFeed } from '../../components/DeskLive'
import { SignInPrompt } from '../../components/SignInPrompt'
import { callAction } from '../../lib/actions'
import { useDesk, usePlaybook } from '../../lib/desk'
import { weightedScore } from '../../desk/score'
import { STAGES, type Deal, type Stage } from '../../desk/types'

type Weights = Record<string, number>

export default function DeskPage() {
  const { user } = useUser()
  const desk = useDesk()
  const words = usePlaybook()
  const navigate = useNavigate()
  const toast = useToast()
  const deals = useQuery<Deal>('deals', { orderBy: 'createdAt', orderDir: 'desc', limit: 200 })
  const [stage, setStage] = useState<Stage | 'all'>('all')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  // What-if weights live in this browser only. They follow the desk until the visitor moves a slider.
  const deskWeights = useMemo<Weights>(() => Object.fromEntries(desk.criteria.map((c) => [c.key, c.weight])), [desk])
  const [weights, setWeights] = useState<Weights>(deskWeights)
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    if (!touched) setWeights(deskWeights)
  }, [deskWeights, touched])
  const criteria = desk.criteria.map((c) => ({ ...c, weight: weights[c.key] ?? c.weight }))

  const ranked = deals.records
    .filter((d) => stage === 'all' || d.data.stage === stage)
    .map((d) => ({ deal: d, score: weightedScore(d.data.scores ?? [], criteria) }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))

  async function add(params: Record<string, unknown>) {
    setBusy(true)
    setFormError('')
    const reply = await callAction<{ dealId: string; alreadyOnDesk: boolean }>('addDeal', params)
    setBusy(false)
    if (!reply.success) return setFormError(reply.error)
    if (reply.data.alreadyOnDesk) toast.success('Already on the desk', 'Opening the existing scorecard.')
    navigate(`/deal/${reply.data.dealId}`)
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void add({ name: form.get('name'), websiteUrl: form.get('websiteUrl') })
  }

  async function saveForEveryone() {
    const reply = await callAction('saveThesis', { criteria })
    if (!reply.success) return toast.warning('Not saved', reply.error)
    setTouched(false)
    toast.success('Thesis saved', 'The whole pipeline was re-ranked for everyone.')
  }

  return (
    <div className="min-h-full text-foreground">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{words.thesisLabel}</p>
          <h1 className="font-display mt-2 text-4xl">{desk.thesisName}</h1>
          <p className="mt-3 text-muted-foreground">{desk.thesisText}</p>
          <p className="mt-4 text-sm" data-testid="try-it">
            <span className="font-medium">New here?</span>{' '}
            <span className="text-muted-foreground">
              Open a target to read its scorecard. Or sign in, add the free sample and watch the analyst work, then vote
              on it.{' '}
            </span>
            <Link to="/about" className="underline underline-offset-4">
              How it works, and where it stops
            </Link>
          </p>
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section aria-labelledby="pipeline-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="pipeline-title" className="font-display text-2xl">
                Pipeline
              </h2>
              <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter by stage">
                {[{ id: 'all', label: 'All' } as const, ...STAGES.map((st) => ({ id: st.id, label: words.stageLabels[st.id] }))].map((s) => (
                  <button
                    key={s.id}
                    role="tab"
                    aria-selected={stage === s.id}
                    onClick={() => setStage(s.id)}
                    className={`rounded-full px-3 py-1 text-sm ${stage === s.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            {touched && (
              <p className="mt-3 text-sm text-caution" data-testid="what-if-note">
                Ranked with your what-if weights. Only you see this order.
              </p>
            )}

            {deals.status === 'loading' ? (
              <p className="mt-6 text-sm text-muted-foreground">Loading the pipeline…</p>
            ) : deals.status === 'error' ? (
              <p role="alert" className="mt-6 text-sm text-negative">
                The pipeline could not be loaded. Reload the page to try again.
              </p>
            ) : ranked.length === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">
                {stage === 'all' ? 'Nothing here yet. Add the first target on the right.' : 'Nothing at this stage.'}
              </p>
            ) : (
              <ol className="mt-4 space-y-3">
                {ranked.map(({ deal, score }, index) => {
                  const d = deal.data
                  const running = !['done', 'failed'].includes(d.status)
                  return (
                    <li key={deal.recordId} data-testid="deal-row" data-status={d.status} className="rounded-md border border-border bg-card p-5">
                      <div className="flex items-start gap-4">
                        <span className="font-display w-7 pt-1 text-xl tabular-nums text-muted-foreground">{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <Link to={`/deal/${deal.recordId}`} className="font-display text-xl underline-offset-4 hover:underline">
                              {d.name}
                            </Link>
                            <StageChip stage={d.stage} label={words.stageLabels[d.stage]} />
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {running ? (
                              <span className="inline-flex items-center gap-2">
                                <span className="desk-pulse h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                                {d.step}
                              </span>
                            ) : d.status === 'failed' ? (
                              'Research failed. Open the company to see why.'
                            ) : (
                              d.profile?.oneLiner || d.websiteUrl
                            )}
                          </p>
                          {d.status === 'done' && (
                            <div className="mt-3">
                              <CriteriaBars scores={d.scores ?? []} criteria={criteria} />
                            </div>
                          )}
                          <p className="mt-3 text-xs text-muted-foreground">
                            Added by {d.addedByName}
                            {d.voteCount > 0 && ` · ${d.voteCount} vote${d.voteCount === 1 ? '' : 's'} ${d.voting === 'revealed' ? 'revealed' : 'locked'}`}
                            {(d.news ?? []).some((n) => n.isNew) && ' · new headlines this week'}
                          </p>
                        </div>
                        <div className="text-right">
                          <TotalScore score={score} />
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
            {(desk.suggestions ?? []).length > 0 && (
              <section className="mt-10" aria-labelledby="scout-title" data-testid="scouted">
                <h2 id="scout-title" className="font-display text-2xl">
                  Scouted for this thesis
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  The desk searched the web for organisations that match the thesis{desk.scoutedAt ? ` on ${new Date(desk.scoutedAt).toLocaleDateString()}` : ''}. They are not researched yet: one click
                  puts one through the analyst.
                </p>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(desk.suggestions ?? [])
                    .filter((sug) => !deals.records.some((d) => d.data.websiteUrl.replace(/^https?:\/\/(www\.)?/, '') === sug.websiteUrl.replace(/^https?:\/\/(www\.)?/, '')))
                    .map((sug) => (
                      <li key={sug.websiteUrl} data-testid="suggestion" className="flex flex-col rounded-md border border-dashed border-border p-4">
                        <p className="font-display text-lg">{sug.name}</p>
                        <p className="mt-1 flex-1 text-sm text-muted-foreground">{sug.why}</p>
                        <p className="mt-3 flex items-center justify-between gap-3 text-sm">
                          <a href={sug.websiteUrl} target="_blank" rel="noreferrer" className="truncate text-muted-foreground underline underline-offset-4">
                            {sug.websiteUrl.replace(/^https?:\/\//, '')}
                          </a>
                          {user && (
                            <button type="button" disabled={busy} onClick={() => void add({ name: sug.name, websiteUrl: sug.websiteUrl })} className="shrink-0 font-medium text-primary underline underline-offset-4 disabled:opacity-50">
                              Research it
                            </button>
                          )}
                        </p>
                      </li>
                    ))}
                </ul>
              </section>
            )}
            <p className="mt-6 text-xs text-muted-foreground">
              Scores come from an AI analyst reading public pages. A criterion is scored only when a quoted sentence was
              found word for word in the page it cites. This is a screening aid, not advice.
            </p>
          </section>

          <aside className="space-y-8">
            <section aria-labelledby="weights-title" className="rounded-md border border-border bg-card p-5">
              <h2 id="weights-title" className="font-display text-lg">
                What matters most?
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">Move a weight and the pipeline re-ranks at once.</p>
              <div className="mt-4 space-y-4">
                {desk.criteria.map((c) => (
                  <div key={c.key}>
                    <div className="flex items-baseline justify-between text-sm">
                      <label htmlFor={`weight-${c.key}`} title={c.guide}>
                        {c.label}
                      </label>
                      <span className="tabular-nums text-muted-foreground">{weights[c.key] ?? c.weight}</span>
                    </div>
                    <input
                      id={`weight-${c.key}`}
                      data-testid={`weight-${c.key}`}
                      type="range"
                      min={0}
                      max={10}
                      step={1}
                      value={weights[c.key] ?? c.weight}
                      onChange={(e) => {
                        setTouched(true)
                        setWeights({ ...weights, [c.key]: Number(e.target.value) })
                      }}
                      className="mt-1 w-full accent-[var(--color-primary)]"
                    />
                  </div>
                ))}
              </div>
              {touched && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setTouched(false)}>
                    Back to the desk weights
                  </Button>
                  {user?.role === 'admin' && <Button onClick={() => void saveForEveryone()}>Save for everyone</Button>}
                </div>
              )}
            </section>

            <ActivityFeed />

            <section aria-labelledby="add-title" className="rounded-md border border-border bg-card p-5">
              <h2 id="add-title" className="font-display text-lg">
                Add a target
              </h2>
              {user ? (
                <form onSubmit={onSubmit} className="mt-3 space-y-3" data-testid="add-form">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" name="name" required maxLength={80} placeholder={words.example.name} className="mt-1.5" />
                  </div>
                  <div>
                    <Label htmlFor="websiteUrl">Website</Label>
                    <Input id="websiteUrl" name="websiteUrl" required maxLength={200} placeholder={words.example.websiteUrl} className="mt-1.5" />
                  </div>
                  {formError && (
                    <p role="alert" data-testid="form-error" className="text-sm text-negative">
                      {formError}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={busy}>
                      {busy ? 'Starting…' : 'Research it'}
                    </Button>
                    <Button type="button" variant="secondary" disabled={busy} onClick={() => void add({ sample: true })} data-testid="sample-button">
                      Add the sample
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Research reads the website and a year of news, then scores the target. It takes under a minute and
                    each member gets 5 runs per day. The sample target is fictional and free.
                  </p>
                </form>
              ) : (
                <div className="mt-3">
                  <SignInPrompt what="add a target, move it along the pipeline and vote" />
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}
