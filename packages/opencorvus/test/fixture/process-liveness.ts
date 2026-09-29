import { Identifier } from "@/id/id"
import { EngineControlActivationLeaseTable } from "@/engine/engine.sql"
import { Database } from "@/storage/db"
import { currentRuntimeProcessOccurrence, ProcessInstanceIDTestHooks } from "@/runtime/process-occurrence"

export function recordTestProcessIdentity(occurrenceID: string, state: "live" | "dead") {
  const process = currentRuntimeProcessOccurrence()
  return recordIdentity({
    ...process,
    occurrenceID,
    processInstanceID: state === "live" ? process.processInstanceID : `${process.processInstanceID}:prior-instance`,
  })
}

function recordIdentity(identity: ReturnType<typeof currentRuntimeProcessOccurrence>) {
  const now = Date.now()
  const receipt = {
    id: Identifier.ascending("activity"),
    target: "runtime_process" as const,
    target_id: identity.occurrenceID,
    owner_occurrence_id: JSON.stringify(identity),
    time_activated: now,
    expires_at: Number.MAX_SAFE_INTEGER,
  }
  Database.use((db) => db.insert(EngineControlActivationLeaseTable).values(receipt).run())
  return receipt
}

export function childProcessIdentity(occurrenceID: string) {
  const child = Bun.spawn([process.execPath, "-e", "setInterval(() => {}, 1000)"], {
    stdout: "ignore",
    stderr: "ignore",
  })
  recordIdentity({ occurrenceID, pid: child.pid, processInstanceID: ProcessInstanceIDTestHooks.require(child.pid) })
  return {
    async exit() {
      child.kill()
      await child.exited
    },
    async [Symbol.asyncDispose]() {
      if (child.exitCode === null) {
        child.kill()
        await child.exited
      }
    },
  }
}
