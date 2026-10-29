import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const SETTLEMENT_RESERVE_MS = 300_000
type OwnedProcessIdentity = { pid: number; processInstanceID: string; occurrenceID: string }

export function ownedShutdownBudgetWindow(input: { registeredAt: number; deadlineAt: number }) {
  if (![input.registeredAt, input.deadlineAt].every(Number.isSafeInteger)) {
    throw new RangeError("Diagnostic shutdown timestamps must be safe integer milliseconds")
  }
  const dueAt = input.deadlineAt - SETTLEMENT_RESERVE_MS
  const delayMs = dueAt - input.registeredAt
  if (delayMs <= 0 || delayMs > 2_147_483_647) {
    throw new RangeError("Diagnostic admission must retain its shutdown and settlement window")
  }
  return { dueAt, delayMs, physicalDeadlineAt: input.deadlineAt, settlementReserveMs: SETTLEMENT_RESERVE_MS }
}

export function qualifyOwnedShutdownReaderAbort(input: {
  occurrence: string
  shutdownOccurrence: string
  settledOccurrence: string
  arrivedAt: number
  terminalAt: number
  settledAt: number
}) {
  assert(input.occurrence.length > 0)
  assert.equal(input.shutdownOccurrence, input.occurrence)
  assert.equal(input.settledOccurrence, input.occurrence)
  if (![input.arrivedAt, input.terminalAt, input.settledAt].every(Number.isSafeInteger) ||
    input.terminalAt < input.arrivedAt || input.terminalAt > input.settledAt) {
    throw new RangeError("Reader cancellation must settle within the exact owned shutdown occurrence")
  }
  return {
    kind: "owned_shutdown_abort" as const,
    occurrence: input.occurrence,
    millisecondsAfterArrival: input.terminalAt - input.arrivedAt,
    millisecondsBeforeSettlement: input.settledAt - input.terminalAt,
  }
}

/** Retire only this diagnostic's exact loopback CLI at its admitted budget boundary. */
export function scheduleOwnedDiagnosticShutdown(input: {
  runtime: string
  evidence: string
  port: number
  occurrence: string
  owner: OwnedProcessIdentity
  observe: (owner: OwnedProcessIdentity) => string
  fetch: typeof fetch
}) {
  const ready = JSON.parse(fs.readFileSync(path.join(input.evidence, "native-host-ready.json"), "utf8"))
  const launch = JSON.parse(fs.readFileSync(path.join(input.evidence, "launch-admission.json"), "utf8"))
  assert.equal(process.env.OPENCORVUS_HOME, input.runtime)
  assert.equal(input.owner.pid, process.pid)
  assert.equal(ready.target.pid, input.owner.pid)
  assert.equal(ready.target.processInstanceID, input.owner.processInstanceID)
  // Supervisor and runtime occurrence UUIDs have different owners; the native
  // process instance and the diagnostic admission bind this exact target.
  assert.equal(input.observe(input.owner), "exact_live")
  assert.equal(ready.occurrence, input.occurrence)
  assert.equal(launch.occurrence, input.occurrence)
  assert.equal(launch.port, input.port)
  assert(Number.isInteger(input.port) && input.port > 0 && input.port < 65536)
  const registeredAt = Date.now()
  const window = ownedShutdownBudgetWindow({ registeredAt, deadlineAt: launch.deadlineAt })
  const publish = (name: string, value: unknown) =>
    fs.writeFileSync(path.join(input.evidence, name), JSON.stringify(value, null, 2) + "\n")
  publish("graceful-shutdown-plan.json", { registeredAt, ...window, occurrence: input.occurrence, owner: input.owner })
  const timer = setTimeout(async () => {
    try {
      assert.equal(input.observe(input.owner), "exact_live")
      publish("graceful-shutdown-started.json", { at: Date.now(), dueAt: window.dueAt, occurrence: input.occurrence })
      const response = await input.fetch(`http://127.0.0.1:${input.port}/shutdown`, {
        method: "POST", signal: AbortSignal.timeout(20_000),
      })
      const content = await response.text()
      publish("public-shutdown.json", { occurrence: input.occurrence, target: ready.target, statusCode: response.status,
        content, source: "owned diagnostic admission budget", observedAtUtc: new Date().toISOString() })
    } catch (error) {
      publish("graceful-shutdown-error.json", { at: Date.now(), type: error instanceof Error ? error.name : "unknown",
        message: error instanceof Error ? error.message : String(error) })
    }
  }, window.delayMs)
  timer.unref()
  return { [Symbol.dispose]() { clearTimeout(timer) } }
}
