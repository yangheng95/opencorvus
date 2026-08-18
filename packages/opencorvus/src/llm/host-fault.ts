/**
 * Host-origin failures inside one LLM activity.
 *
 * `withLLMActivity` owns retry for one provider call, and its classifier only
 * understands provider-shaped failures: HTTP status, transport wording, abort
 * cause. Anything else falls through to `"unknown"`, which is retryable. That
 * default is right for an unrecognized *provider* error and wrong for a Host
 * one: an invariant violation raised while the processor persists a streamed
 * chunk is deterministic, so a retry cannot change its outcome, and once the
 * attempt has already started executing tools the retry is not merely useless
 * but structurally impossible — the processor's rollback boundary refuses it
 * and the real cause disappears behind `ProcessorUnsafeRetryError`.
 *
 * Observed on task tsk_g00VSTJYc900STEQzWIq (2026-08-16): a Tool request
 * immutability conflict inside the `tool-call` chunk handler was classified
 * `unknown`, retried, and surfaced to the operator only as "cannot retry
 * activity attempt 0", with the conflict itself truncated out of the durable
 * Task error.
 *
 * Wrapping keeps the original error as `cause` so the true failure stays in
 * the message the operator reads, while `isHostProcessingFault` lets the
 * activity classifier stop treating it as a transient provider condition.
 *
 * This module stays dependency-free so both `@/llm/activity` and
 * `@/session/processor` can import it without a cycle.
 */
export class HostProcessingFaultError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "HostProcessingFaultError"
  }
}

/** A storage-layer constraint refusal (RAISE(ABORT) trigger, UNIQUE, CHECK…)
 *  raised while the Host persists its own write is deterministic: the schema
 *  is enforcing an invariant against the Host, and retrying the provider call
 *  replays the identical write. Recognizing the code here means every trigger
 *  that ever bites costs one clean failure, never a retry storm. Only
 *  bun:sqlite produces SQLITE_CONSTRAINT codes, so a provider error can never
 *  match. */
function isStorageConstraintRefusal(candidate: object): boolean {
  const code = (candidate as { code?: unknown }).code
  return typeof code === "string" && code.startsWith("SQLITE_CONSTRAINT")
}

/** Chain-shape tolerant: a Host fault stays a Host fault after the activity
 *  runner wraps it as `LLMActivityError`. */
export function isHostProcessingFault(error: unknown): boolean {
  let current: unknown = error
  const seen = new Set<unknown>()
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current)
    if (current instanceof HostProcessingFaultError) return true
    if ((current as { name?: unknown }).name === "HostProcessingFaultError") return true
    if (isStorageConstraintRefusal(current)) return true
    current = (current as { cause?: unknown }).cause
  }
  return false
}
