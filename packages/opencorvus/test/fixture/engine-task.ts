import { persistTask } from "../../src/engine/pipeline"

/**
 * Establish a Task fixture whose creation ingress is outside the test's scope.
 *
 * This used to also call a `retirePendingTaskRootIngressesForOperatorIntent...`
 * helper, whose name promised to keep the creation ingress out of the FIFO head.
 * That function only ever *read* rows — it mutated nothing and its return value
 * was discarded here — so the call was a no-op, and the tests that rely on this
 * helper have always been passing without it. It went with the Retry intent it
 * was written for.
 */
export function persistEstablishedTask(input: Parameters<typeof persistTask>[0]): void {
  persistTask(input)
}
