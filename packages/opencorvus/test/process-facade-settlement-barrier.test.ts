import { afterAll, expect, test } from "bun:test"
import { setImmediate } from "node:timers/promises"
import { ProcessSupervisor } from "../src/shell/process-supervisor"
import { supervisedHostProcessFacade, supervisedTaskProcessFacade } from "../src/util/process-facade"
import { Config } from "../src/config/config"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { PromptProfileResolver } from "../src/expert-squad/prompt-profile-resolver"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { persistEstablishedTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

function originalHandle(fact: { exitCode: number | null; signal: NodeJS.Signals | null } = { exitCode: 0, signal: null }) {
  const output = Promise.withResolvers<void>()
  const rawSettlement = Promise.withResolvers<void>()
  const events: string[] = []
  void output.promise.then(() => events.push("output fulfilled"), () => events.push("output rejected"))
  void rawSettlement.promise.then(() => events.push("raw settled fulfilled"), () => events.push("raw settled rejected"))
  const raw: ProcessSupervisor.Handle = {
    pid: 994201,
    stdin: null,
    stdout: null,
    stderr: null,
    exited: Promise.resolve(fact.exitCode ?? (fact.signal ? 1 : 0)),
    terminalFact: Promise.resolve(fact),
    outputSettled: output.promise,
    settled: rawSettlement.promise,
    async terminate() { await rawSettlement.promise },
    async dispose() { await rawSettlement.promise },
    unref() {},
  }
  return { raw, output, rawSettlement, events }
}

function observePublic<T>(promise: Promise<T>, events: string[]) {
  return promise.then(
    (value) => { events.push("public fulfilled"); return { status: "fulfilled" as const, value } },
    (reason: unknown) => { events.push("public rejected"); return { status: "rejected" as const, reason } },
  )
}

for (const cleanupFailure of [false, true]) {
  test(`Host settlement retains original output${cleanupFailure ? " and late cleanup" : ""} failures after the raw barrier`, async () => {
    const fixture = originalHandle()
    const outputFailure = new Error("original output failure")
    const cleanup = new Error("original request cleanup failure")
    const restore = ProcessSupervisor.setCommandFactoryForTest(async () => fixture.raw)
    try {
      const handle = await supervisedHostProcessFacade("positive-host-settlement-barrier", false).spawn({
        command: { executable: "controlled-original-handle", args: [] },
        occurrenceID: "host-output-and-raw-settlement",
        stdout: "ignore", stderr: "ignore",
      })
      const observed = observePublic(handle.settled, fixture.events)
      fixture.output.reject(outputFailure)
      await setImmediate()
      fixture.rawSettlement.reject(cleanupFailure
        ? new AggregateError([outputFailure, cleanup], "original complete settlement")
        : outputFailure)
      const outcome = await observed
      expect(outcome.status).toBe("rejected")
      if (outcome.status !== "rejected") throw new Error("Expected the original settlement failure")
      if (cleanupFailure) {
        expect(outcome.reason).toBeInstanceOf(AggregateError)
        const reasons = (outcome.reason as AggregateError).errors
        expect(reasons.length).toBe(2)
        expect(reasons[0]).toBe(outputFailure)
        expect(reasons[1]).toBe(cleanup)
      } else expect(outcome.reason).toBe(outputFailure)
      expect(fixture.events).toEqual(["output rejected", "raw settled rejected", "public rejected"])
      await Promise.allSettled([handle.dispose()])
    } finally { restore() }
  })
}

test("Host settlement preserves the sole original cleanup error after delivered output", async () => {
  const fixture = originalHandle()
  const cleanup = new Error("original cleanup error")
  const restore = ProcessSupervisor.setCommandFactoryForTest(async () => fixture.raw)
  try {
    const handle = await supervisedHostProcessFacade("positive-cleanup-settlement", false).spawn({
      command: { executable: "controlled-original-handle", args: [] }, stdout: "ignore", stderr: "ignore",
    })
    const observed = observePublic(handle.settled, fixture.events)
    fixture.output.resolve()
    await setImmediate()
    fixture.rawSettlement.reject(cleanup)
    const outcome = await observed
    expect(outcome).toMatchObject({ status: "rejected" })
    if (outcome.status !== "rejected") throw new Error("Expected the original cleanup error")
    expect(outcome.reason).toBe(cleanup)
    expect(fixture.events).toEqual(["output fulfilled", "raw settled rejected", "public rejected"])
    await Promise.allSettled([handle.dispose()])
  } finally { restore() }
})

test("Host settlement projects the exact original signal fact after complete raw closure", async () => {
  const fixture = originalHandle({ exitCode: null, signal: "SIGTERM" })
  const restore = ProcessSupervisor.setCommandFactoryForTest(async () => fixture.raw)
  try {
    const handle = await supervisedHostProcessFacade("positive-original-signal-settlement", false).spawn({
      command: { executable: "controlled-original-handle", args: [] },
      occurrenceID: "original-signal-receipt", stdout: "ignore", stderr: "ignore",
    })
    const observed = observePublic(handle.settled, fixture.events)
    fixture.output.resolve()
    await setImmediate()
    fixture.rawSettlement.resolve()
    expect(await observed).toEqual({ status: "fulfilled", value: {
      occurrenceID: "original-signal-receipt", pid: fixture.raw.pid, reason: "exited", exitCode: null, signal: "SIGTERM",
    } })
    expect(fixture.events).toEqual(["output fulfilled", "raw settled fulfilled", "public fulfilled"])
    await handle.dispose()
  } finally { restore() }
})

test("Task adapter joins the original settlement under the current persisted native binding", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const revision = await PromptProfileResolver.resolveActivePackageRevision({
      projectDirectory: project.path, config: await Config.get(),
    })
    const taskID = Identifier.ascending("task")
    const now = Date.now()
    persistEstablishedTask({
      taskID, projectID: Instance.project.id, now,
      rootSession: Session.prepareRootNext({ kind: "root", directory: project.path, title: "Positive settlement contract" }),
      title: "Positive settlement contract", request: "Task adapter original settlement service contract",
      productPillar: "code", metadata: {}, packageRevision: revision,
      executionCapsuleBinding: await prepareTaskProcessBinding({
        mode: "native", taskID, projectID: Instance.project.id, rootDirectory: project.path,
        packageRevisionSHA256: revision.packageDigest, timeCreated: now,
      }),
    })
    const fixture = originalHandle()
    const failure = new Error("Task original output failure")
    const admitted: Array<{ cwd?: string; owner?: string }> = []
    const restore = ProcessSupervisor.setCommandFactoryForTest(async (options) => {
      admitted.push({ cwd: options.cwd, owner: options.owner })
      return fixture.raw
    })
    try {
      const handle = await supervisedTaskProcessFacade({ taskID, cwd: project.path }, "positive-task-settlement").spawn({
        command: { executable: "controlled-original-handle", args: [] },
        occurrenceID: "task-original-settlement", stdout: "ignore", stderr: "ignore",
      })
      const observed = observePublic(handle.settled, fixture.events)
      fixture.output.reject(failure)
      await setImmediate()
      fixture.rawSettlement.reject(failure)
      const outcome = await observed
      expect(outcome.status).toBe("rejected")
      if (outcome.status !== "rejected") throw new Error("Expected the original Task output error")
      expect(outcome.reason).toBe(failure)
      expect(admitted).toEqual([{ cwd: project.path, owner: "positive-task-settlement" }])
      expect(fixture.events).toEqual(["output rejected", "raw settled rejected", "public rejected"])
      await Promise.allSettled([handle.dispose()])
    } finally { restore() }
  } })
})
