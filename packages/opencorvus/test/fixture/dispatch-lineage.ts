import { recordDispatchLineage } from "../../src/engine/dispatch-lineage"
import { joinProcessLivenessLease } from "../../src/engine/process-liveness"
import { currentRuntimeOccurrenceID } from "../../src/runtime/process-occurrence"

/** Direct engine fixtures do not enter the production Task-control driver.
 * Give their exact lineage commit the same process fence for the duration of
 * its writer transaction, then expire that fixture owner. */
export function recordTestDispatchLineage(input: Parameters<typeof recordDispatchLineage>[0]) {
  const liveness = joinProcessLivenessLease(currentRuntimeOccurrenceID())
  try {
    return recordDispatchLineage(input)
  } finally {
    liveness.release()
  }
}
