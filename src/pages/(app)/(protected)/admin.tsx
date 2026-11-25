/**
 * Owner page: the weekly task (with a "Run now" button to prove it works
 * without waiting for Monday), the thesis wording, and what research has cost.
 *
 * Hiding the page from members is UX only. The real gates are server-side:
 * CronRoom refuses writes from non-admins and the saveThesis action checks the
 * caller's role.
 */

import { useState, type FormEvent } from 'react'
import { useCronMonitor, useQuery, useUser } from 'deepspace'
import { Button, Input, Label, Textarea, useToast } from '@/components/ui'
import { SCOPE_ID } from '../../../constants'
import { callAction } from '../../../lib/actions'
import { useDesk } from '../../../lib/desk'
import type { Deal } from '../../../desk/types'

export default function AdminPage() {
  const { user } = useUser()
  const desk = useDesk()
  const toast = useToast()
  const cron = useCronMonitor(SCOPE_ID)
  const deals = useQuery<Deal>('deals', { orderBy: 'createdAt', orderDir: 'desc', limit: 200 })
  const [result, setResult] = useState('')
  const [scout, setScout] = useState('')

  if (user?.role !== 'admin') {
    return <div className="mx-auto max-w-3xl px-6 py-12 text-sm text-muted-foreground">This page is for the desk owner.</div>
  }

  const cost = deals.records.reduce((sum, d) => sum + (d.data.costUsd ?? 0), 0)

  async function saveThesis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const criteria = desk.criteria.map((c) => ({ ...c, label: form.get(`label-${c.key}`), guide: form.get(`guide-${c.key}`) }))
    const reply = await callAction('saveThesis', { thesisName: form.get('thesisName'), thesisText: form.get('thesisText'), scoutQuery: form.get('scoutQuery'), criteria })
    if (!reply.success) return toast.warning('Not saved', reply.error)
    toast.success('Thesis saved', 'New research will use this wording.')
  }

  return (
    <div className="min-h-full text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="font-display text-4xl">Owner</h1>

        <section className="mt-8 rounded-md border border-border bg-card p-6">
          <h2 className="font-display text-xl">Weekly news watch</h2>
          {!cron.connected ? (
            <p className="mt-2 text-sm text-muted-foreground">Connecting…</p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm">
              {cron.tasks.map((task) => (
                <li key={task.name} className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    <span className="font-medium">{task.name}</span>
                    <span className="text-muted-foreground"> · Mondays 08:00 Paris time · targets in the second and third stage</span>
                  </span>
                  <Button
                    variant="secondary"
                    disabled={!cron.canWrite}
                    aria-label={`Run now: ${task.name}`}
                    onClick={async () => {
                      setResult('Running…')
                      const receipt = await cron.trigger(task.name)
                      setResult(receipt.ok ? 'Task ran. New headlines are flagged on the board and emailed.' : (receipt.error ?? 'The task was refused.'))
                    }}
                  >
                    Run now
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {result && (
            <p className="mt-3 text-sm" aria-live="polite" data-testid="cron-trigger-result">
              {result}
            </p>
          )}
          {cron.history.length > 0 && (
            <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
              {cron.history.slice(0, 5).map((run, i) => (
                <li key={i} data-testid="cron-history-row">
                  {run.taskName} · {run.success ? 'ok' : 'failed'} · {run.durationMs} ms
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8 rounded-md border border-border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl">Scout</h2>
            <Button
              variant="secondary"
              data-testid="scout-button"
              onClick={async () => {
                setScout('Searching the web…')
                const reply = await callAction<{ found: number }>('scoutNow', {})
                setScout(reply.success ? `Found ${reply.data.found} companies that are not on the desk yet. They are on the pipeline page.` : reply.error)
              }}
            >
              Scout now
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Searches the web for companies that match the thesis and lists them under the pipeline. Runs by itself every Monday after the news watch.
            {desk.scoutedAt && ` Last run ${new Date(desk.scoutedAt).toLocaleString()}.`}
          </p>
          {scout && (
            <p className="mt-3 text-sm" aria-live="polite" data-testid="scout-result">
              {scout}
            </p>
          )}
        </section>

        <section className="mt-8 rounded-md border border-border bg-card p-6">
          <h2 className="font-display text-xl">Thesis wording</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The analyst reads this text and these guides when it scores a company. Weights are set on the pipeline page.
          </p>
          <form onSubmit={saveThesis} className="mt-4 space-y-4" key={JSON.stringify(desk)}>
            <div>
              <Label htmlFor="thesisName">Name</Label>
              <Input id="thesisName" name="thesisName" maxLength={60} defaultValue={desk.thesisName} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="thesisText">Thesis</Label>
              <Textarea id="thesisText" name="thesisText" maxLength={600} defaultValue={desk.thesisText} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="scoutQuery">Who the scout searches for</Label>
              <Textarea id="scoutQuery" name="scoutQuery" maxLength={400} defaultValue={desk.scoutQuery ?? ''} className="mt-1.5" />
              <p className="mt-1 text-xs text-muted-foreground">Describe the organisations you want to reach, not yourself. A search with "we are…" returns your competitors.</p>
            </div>
            {desk.criteria.map((c) => (
              <div key={c.key} className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
                <div>
                  <Label htmlFor={`label-${c.key}`}>Criterion</Label>
                  <Input id={`label-${c.key}`} name={`label-${c.key}`} maxLength={40} defaultValue={c.label} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor={`guide-${c.key}`}>What to look for</Label>
                  <Input id={`guide-${c.key}`} name={`guide-${c.key}`} maxLength={240} defaultValue={c.guide} className="mt-1.5" />
                </div>
              </div>
            ))}
            <Button type="submit">Save the thesis</Button>
          </form>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-xl">Research spend</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {deals.records.length} companies · ${cost.toFixed(2)} at provider cost
          </p>
          <ul className="mt-4 divide-y divide-border rounded-md border border-border bg-card text-sm">
            {deals.records.map((deal) => (
              <li key={deal.recordId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <span className="font-medium">{deal.data.name}</span>
                <span className="text-muted-foreground">{deal.data.addedByName}</span>
                <span>
                  {deal.data.status}
                  {deal.data.isSample ? ' · sample' : ` · $${(deal.data.costUsd ?? 0).toFixed(3)}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
