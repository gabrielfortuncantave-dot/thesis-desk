import type { ActionTools } from 'deepspace/worker'
import type { Activity } from './types'

/**
 * Append one line to the desk's public feed. The feed is a convenience, so a
 * failed write is logged and never fails the action that caused it.
 */
export async function logActivity(tools: ActionTools, entry: Omit<Activity, 'at'>): Promise<void> {
  try {
    const row: Activity = { ...entry, at: new Date().toISOString() }
    await tools.create('activity', row as unknown as Record<string, unknown>)
  } catch (error) {
    console.warn(`[activity] not recorded: ${error instanceof Error ? error.message : String(error)}`)
  }
}
