import type { ActionTools } from 'deepspace/worker'
import type { NewsItem } from './types'
import { must } from './records'

export interface WatchedDeal {
  dealId: string
  name: string
  fresh: NewsItem[]
}

/** Plain-text weekly digest; pure so it can be unit-tested. Returns null when there is nothing to say. */
export function digestEmailText(appName: string, deals: WatchedDeal[]): { subject: string; text: string } | null {
  const withNews = deals.filter((d) => d.fresh.length > 0)
  if (withNews.length === 0) return null
  const count = withNews.reduce((n, d) => n + d.fresh.length, 0)
  const lines: string[] = ['New headlines on companies you added to the desk:', '']
  for (const deal of withNews) {
    lines.push(`${deal.name}`)
    for (const item of deal.fresh) lines.push(`  - ${item.title}${item.date ? ` (${item.date})` : ''}`, `    ${item.url}`)
    lines.push(`  Scorecard: https://${appName}.app.space/deal/${deal.dealId}`, '')
  }
  const subject = `${count} new headline${count === 1 ? '' : 's'} on ${withNews.length === 1 ? withNews[0].name : `${withNews.length} companies`} in your pipeline`
  return { subject, text: lines.join('\n').trim() }
}

/**
 * `email/send` always sends as "DeepSpace Apps <notifications@updates.app.space>":
 * the catalog says a `from` value is ignored, and a real send confirmed it, so none is passed.
 */
export async function sendEmail(tools: ActionTools, to: string, subject: string, text: string): Promise<void> {
  must(await tools.integration('email/send', { to, subject, text }), 'send email')
}
