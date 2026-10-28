import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

type OwnedProcessIdentity = { pid: number; processInstanceID: string; occurrenceID: string }

/** Diagnostic owner only: retire its exact loopback CLI through public shutdown. */
export function scheduleOwnedUIShutdown(input: {
  runtime: string
  evidence: string
  port: number
  occurrence: string
  owner: OwnedProcessIdentity
  observe: (owner: OwnedProcessIdentity) => string
  delayMs: number
  fetch: typeof fetch
}) {
  const ready = JSON.parse(fs.readFileSync(path.join(input.evidence, "native-host-ready.json"), "utf8"))
  const launch = JSON.parse(fs.readFileSync(path.join(input.evidence, "launch-admission.json"), "utf8"))
  assert.equal(process.env.OPENCORVUS_HOME, input.runtime)
  assert.equal(input.owner.pid, process.pid)
  assert.equal(ready.target.pid, input.owner.pid)
  assert.equal(ready.target.processInstanceID, input.owner.processInstanceID)
  assert.equal(input.observe(input.owner), "exact_live")
  assert.equal(ready.occurrence, input.occurrence)
  assert.equal(launch.occurrence, input.occurrence)
  assert.equal(launch.port, input.port)
  assert(Number.isInteger(input.port) && input.port > 0 && input.port < 65536)
  assert(Number.isSafeInteger(input.delayMs) && input.delayMs > 0)
  const dueAt = Date.now() + input.delayMs
  assert(dueAt <= launch.deadlineAt - 300000)
  const publish = (name: string, value: unknown) =>
    fs.writeFileSync(path.join(input.evidence, name), JSON.stringify(value, null, 2) + "\n")
  publish("graceful-shutdown-plan.json", { registeredAt: Date.now(), dueAt, physicalDeadlineAt: launch.deadlineAt, occurrence: input.occurrence, owner: input.owner })
  const timer = setTimeout(async () => {
    try {
      assert.equal(input.observe(input.owner), "exact_live")
      publish("graceful-shutdown-started.json", { at: Date.now(), dueAt, occurrence: input.occurrence })
      const response = await input.fetch(`http://127.0.0.1:${input.port}/shutdown`, {
        method: "POST", signal: AbortSignal.timeout(20000),
      })
      const content = await response.text()
      publish("public-shutdown.json", { occurrence: input.occurrence, target: ready.target, statusCode: response.status, content, source: "owned diagnostic timer", observedAtUtc: new Date().toISOString() })
    } catch (error) {
      publish("graceful-shutdown-error.json", { at: Date.now(), type: error instanceof Error ? error.name : "unknown", message: error instanceof Error ? error.message : String(error) })
    }
  }, input.delayMs)
  timer.unref()
  return { [Symbol.dispose]() { clearTimeout(timer) } }
}
