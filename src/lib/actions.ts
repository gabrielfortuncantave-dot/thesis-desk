import { getAuthToken } from 'deepspace'

export type ActionReply<T> = { success: true; data: T } | { success: false; error: string }

/** Call a server action (src/actions/index.ts) as the signed-in user. */
export async function callAction<T>(name: string, params: Record<string, unknown>): Promise<ActionReply<T>> {
  try {
    const res = await fetch(`/api/actions/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAuthToken()}` },
      body: JSON.stringify(params),
    })
    const body = (await res.json()) as { success?: boolean; data?: T; error?: string }
    if (body.success) return { success: true, data: body.data as T }
    return { success: false, error: body.error ?? `The server answered ${res.status}.` }
  } catch {
    return { success: false, error: 'Could not reach the server. Check your connection and try again.' }
  }
}
