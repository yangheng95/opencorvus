/**
 * Stateful-snapshot tool registry — single source of truth.
 *
 * A "stateful snapshot" tool is one whose return value is a snapshot of
 * mutable task state. The LATEST call's output represents authoritative
 * state; older calls' outputs are obsolete. The session loop projects
 * older calls' outputs to a short "[superseded]" placeholder in the
 * model prompt, dramatically reducing the per-turn token bill.
 *
 * This module is dependency-free so it can be imported from both
 * `orchestrator/tools.ts` (where the actual tool definitions live) and
 * `session/message.ts` (where projection happens) without creating a
 * circular dependency through `@/session`.
 *
 * Adding a tool here means making a deliberate semantic claim: the tool
 * is read-only, returns a state snapshot, and the most recent call
 * supersedes any earlier ones in the same session. Do NOT add a tool
 * here unless that property holds — the projection silently drops
 * superseded payloads, so a tool whose old returns still carry value
 * (e.g., a transcript of an irreversible operation) MUST stay out.
 *
 * The forward-guard test in `test/session/stateful-snapshot-tools.test.ts`
 * verifies every name here corresponds to a real tool registered by
 * `createOrchestratorTools`. Renaming a tool without updating this list
 * therefore fails CI rather than silently disabling projection.
 */
export const STATEFUL_SNAPSHOT_TOOL_NAMES = [] as const

export type StatefulSnapshotToolName = (typeof STATEFUL_SNAPSHOT_TOOL_NAMES)[number]

const STATEFUL_SNAPSHOT_TOOL_NAME_SET = new Set<string>(STATEFUL_SNAPSHOT_TOOL_NAMES)

export function statefulSnapshotToolKey(toolName: string, _input: unknown): string | undefined {
  if (STATEFUL_SNAPSHOT_TOOL_NAME_SET.has(toolName)) return toolName
  return undefined
}
