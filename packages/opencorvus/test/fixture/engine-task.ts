import { Database } from "../../src/storage/db"
import { persistTask } from "../../src/engine/pipeline"
import { retirePendingTaskRootIngressesForOperatorIntentInTransaction } from "../../src/engine/task-root-ingress-delivery"

/**
 * Establish a Task fixture whose creation ingress is outside the test's scope.
 *
 * Production Task creation always commits `task_creation` ingress atomically.
 * Tests for later lifecycle slices use this helper to start from an already
 * established Task without allowing that unrelated ingress to become their
 * root-Session FIFO head.
 */
export function persistEstablishedTask(input: Parameters<typeof persistTask>[0]): void {
  persistTask(input)
  Database.transaction((db) => {
    retirePendingTaskRootIngressesForOperatorIntentInTransaction(db, {
      taskID: input.taskID,
      now: Date.now(),
    })
  })
}
