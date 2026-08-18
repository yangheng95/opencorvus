/**
 * Integrity violations observed while reading durable Task-root evidence.
 *
 * The control-plane projection must be a total function over persisted facts:
 * a violation is a projected `host_fault` value, never an exception. Evidence
 * readers therefore raise this typed error, the fact store catches exactly
 * this type at its single boundary, and the reducer turns it into
 * `host_fault/evidence_violation` — a settlement local to that ingress, which
 * never executes an effect and never holds the Task's FIFO. Untyped throws
 * stay reserved for infrastructure faults (an unavailable Database), which the
 * driver is allowed to retry under backoff.
 *
 * This module intentionally imports nothing so both the evidence readers and
 * the fact store can depend on it without a cycle.
 */
export class TaskRootIngressIntegrityError extends Error {
  override readonly name = "TaskRootIngressIntegrityError"
  constructor(
    readonly ingressID: string,
    message: string,
  ) {
    super(message)
  }
}

export function isTaskRootIngressIntegrityError(error: unknown): error is TaskRootIngressIntegrityError {
  return error instanceof TaskRootIngressIntegrityError
}

/**
 * An activation that can never be current again: its epoch was superseded, its
 * lease was replaced, or it was already consumed. Unlike a transient fence
 * rejection (an unexpired lease held elsewhere, a deadline not yet reached),
 * nothing a caller does later can satisfy it. Recovery uses the distinction to
 * retire work that would otherwise be replayed on every project open.
 */
export class TaskRootActivationSupersededError extends Error {
  override readonly name = "TaskRootActivationSupersededError"
  constructor(
    readonly ingressID: string,
    message: string,
  ) {
    super(message)
  }
}
