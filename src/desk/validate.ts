/** Input cleaning for the server actions. Pure functions, unit-tested. */

export function cleanText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

/** Accept only a public http(s) address; return it normalised, or null. */
export function cleanWebsiteUrl(value: unknown): string | null {
  const raw = cleanText(value, 200)
  if (!raw) return null
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    const isIp = /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':')
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.') || isIp) return null
    return (url.origin + url.pathname).replace(/\/$/, '')
  } catch {
    return null
  }
}

/** Only web links may be rendered as links: a source URL is third-party data. */
export function safeHref(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null
  } catch {
    return null
  }
}
