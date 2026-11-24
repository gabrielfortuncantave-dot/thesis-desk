/**
 * The four collections of the desk.
 *
 * - `desk` and `deals` are readable by everyone, signed in or not: the board
 *   is a shared room. Nobody writes to them directly; every change goes
 *   through a server action (src/actions/index.ts), which validates input,
 *   checks who is asking and enforces the spend limits.
 * - `votes` are blind. `read: 'published'` means a row is visible to its owner,
 *   or to everyone once its `revealed` column says 'yes'. The reveal action
 *   flips that column for every vote of a deal at once, so the server (not the
 *   UI) is what keeps votes hidden while the committee is still voting.
 */

import type { CollectionSchema } from 'deepspace/schema'

const SERVER_WRITES_ONLY = { create: false, update: false, delete: false } as const

export const deskSchema: CollectionSchema = {
  name: 'desk',
  columns: [
    { name: 'playbook', storage: 'text', interpretation: 'plain' },
    { name: 'thesisName', storage: 'text', interpretation: 'plain' },
    { name: 'thesisText', storage: 'text', interpretation: 'plain' },
    { name: 'criteria', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'suggestions', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'scoutedAt', storage: 'text', interpretation: 'plain' },
  ],
  permissions: {
    '*': { read: true, ...SERVER_WRITES_ONLY },
    viewer: { read: true, ...SERVER_WRITES_ONLY },
    member: { read: true, ...SERVER_WRITES_ONLY },
    admin: { read: true, ...SERVER_WRITES_ONLY },
  },
}

export const dealsSchema: CollectionSchema = {
  name: 'deals',
  columns: [
    { name: 'addedBy', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'addedByName', storage: 'text', interpretation: 'plain' },
    { name: 'name', storage: 'text', interpretation: 'plain', required: true },
    { name: 'websiteUrl', storage: 'text', interpretation: 'plain', required: true },
    { name: 'stage', storage: 'text', interpretation: 'plain' },
    { name: 'status', storage: 'text', interpretation: 'plain' },
    { name: 'step', storage: 'text', interpretation: 'plain' },
    { name: 'log', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'profile', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'scores', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'totalScore', storage: 'number', interpretation: 'plain' },
    { name: 'previousScore', storage: 'number', interpretation: 'plain' },
    { name: 'memo', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'bull', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'bear', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'news', storage: 'text', interpretation: { kind: 'json' } },
    { name: 'isSample', storage: 'number', interpretation: { kind: 'boolean' } },
    { name: 'costUsd', storage: 'number', interpretation: 'plain' },
    { name: 'startedAt', storage: 'text', interpretation: 'plain' },
    { name: 'researchedAt', storage: 'text', interpretation: 'plain' },
    { name: 'newsCheckedAt', storage: 'text', interpretation: 'plain' },
    { name: 'voting', storage: 'text', interpretation: 'plain' },
    { name: 'voteCount', storage: 'number', interpretation: 'plain' },
    { name: 'pdfExports', storage: 'number', interpretation: 'plain' },
    { name: 'error', storage: 'text', interpretation: 'plain' },
  ],
  ownerField: 'addedBy',
  permissions: {
    '*': { read: true, ...SERVER_WRITES_ONLY },
    viewer: { read: true, ...SERVER_WRITES_ONLY },
    member: { read: true, ...SERVER_WRITES_ONLY },
    admin: { read: true, ...SERVER_WRITES_ONLY },
  },
}

const BLIND_UNTIL_REVEALED = { read: 'published', ...SERVER_WRITES_ONLY } as const

export const votesSchema: CollectionSchema = {
  name: 'votes',
  columns: [
    { name: 'dealId', storage: 'text', interpretation: 'plain', required: true },
    { name: 'voterId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true },
    { name: 'voterName', storage: 'text', interpretation: 'plain' },
    { name: 'decision', storage: 'text', interpretation: 'plain' },
    { name: 'conviction', storage: 'number', interpretation: 'plain' },
    { name: 'reason', storage: 'text', interpretation: 'plain' },
    { name: 'revealed', storage: 'text', interpretation: 'plain' },
  ],
  ownerField: 'voterId',
  visibilityField: { field: 'revealed', value: 'yes' },
  // One vote per person per deal, enforced by the Durable Object, not by the UI.
  uniqueOn: ['dealId', 'voterId'],
  permissions: {
    '*': BLIND_UNTIL_REVEALED,
    viewer: BLIND_UNTIL_REVEALED,
    member: BLIND_UNTIL_REVEALED,
    // The owner of the app is on the committee too: no early look for admins.
    admin: BLIND_UNTIL_REVEALED,
  },
}

/** Public, append-only feed of what happens on the desk. Written by the server only. */
export const activitySchema: CollectionSchema = {
  name: 'activity',
  columns: [
    { name: 'actorName', storage: 'text', interpretation: 'plain' },
    { name: 'kind', storage: 'text', interpretation: 'plain' },
    { name: 'dealId', storage: 'text', interpretation: 'plain' },
    { name: 'dealName', storage: 'text', interpretation: 'plain' },
    { name: 'detail', storage: 'text', interpretation: 'plain' },
    { name: 'at', storage: 'text', interpretation: 'plain' },
  ],
  permissions: {
    '*': { read: true, ...SERVER_WRITES_ONLY },
    viewer: { read: true, ...SERVER_WRITES_ONLY },
    member: { read: true, ...SERVER_WRITES_ONLY },
    admin: { read: true, ...SERVER_WRITES_ONLY },
  },
}
