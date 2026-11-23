/** Small typed wrappers over the action tools, so the pipeline reads as plain steps. */

import type { ActionResult, ActionTools } from 'deepspace/worker'

export interface Row<T> {
  recordId: string
  data: T
}

/** Unwrap an ActionResult or throw a readable error. */
export function must<T>(result: ActionResult<T>, what: string): T {
  if (!result.success) throw new Error(`${what}: ${result.error}`)
  return result.data
}

export async function getRow<T>(tools: ActionTools, collection: string, recordId: string): Promise<Row<T> | null> {
  const r = await tools.get(collection, recordId)
  if (!r.success) return null
  const record = (r.data as unknown as { record?: Row<T> }).record
  return record ?? null
}

export async function listRows<T>(
  tools: ActionTools,
  collection: string,
  options: { where?: Record<string, unknown>; orderBy?: string; orderDir?: 'asc' | 'desc'; limit?: number },
): Promise<Row<T>[]> {
  const data = must(await tools.query(collection, options), `query ${collection}`)
  return (data as unknown as { records: Row<T>[] }).records ?? []
}

export async function createRow(tools: ActionTools, collection: string, data: Record<string, unknown>): Promise<string> {
  return must(await tools.create(collection, data), `create ${collection}`).recordId
}
