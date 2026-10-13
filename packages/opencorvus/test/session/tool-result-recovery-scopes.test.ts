import { afterAll, expect, test } from "bun:test"
import { createServer } from "node:http"
import { once } from "node:events"
import { Config } from "../../src/config/config"
import { prepareTaskProcessBinding } from "../../src/engine/task-execution-capsule-binding"
import { EngineTaskRootIngressTable } from "../../src/engine/engine.sql"
import { acquireTaskRootIngressLease } from "../../src/engine/task-root-fact-store"
import { releaseControlLease } from "../../src/engine/control-lease"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { Identifier } from "../../src/id/id"
import { currentOrchestratorControlMessage } from "../../src/orchestrator/agent"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { MessageStore } from "../../src/session/message-store"
import { SessionLoop } from "../../src/session/loop"
import { Database, eq } from "../../src/storage/db"
import { completedReadResult, resultRecoveryModel } from "../fixture/completed-read-result"
import { persistEstablishedTask } from "../fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterAll(resetMemoryDatabase)

async function scope(fn: (directory: string) => Promise<void>) {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: () => fn(project.path) })
}

async function expectResult(value: Awaited<ReturnType<typeof completedReadResult>>) {
  const message = await MessageStore.get({ sessionID: value.session.id, messageID: value.assistant.id })
  expect(message.parts.find((part) => part.id === value.part.id)).toMatchObject({
    state: { status: "completed", output: value.result.output },
  })
  expect(message.parts.filter((part) => part.type === "source-file" || part.type === "source-url")).toMatchObject(value.result.sources!)
  expect(value.executeCount()).toBe(1)
  expect(message.info.time.completed).toBeNumber()
}

test("Task-root recovery settles the accepted web result after its activation is released", async () => {
  await scope(async (directory) => {
    await Config.updateProjectPatch({ permission_mode: "full_access", prompt_profile: { active: "base" } })
    const { schedulerCapability } = await PromptProfileResolver.resolveSchedulerTurnProjection({
      projectDirectory: directory, config: await Config.get(),
    })
    const taskID = Identifier.ascending("task"), now = Date.now()
    const root = Session.prepareRootNext({ kind: "root", directory, title: "Result recovery Task",
      metadata: { configOverlay: { prompt_profile: { active: schedulerCapability.expertSquadID } } } })
    persistEstablishedTask({ taskID, rootSession: root, now, title: "Result recovery Task",
      request: "Inspect a recorded successful read", productPillar: "code", metadata: { actor: "user" },
      projectID: Instance.project.id, packageRevision: schedulerCapability.packageRevision,
      executionCapsuleBinding: await prepareTaskProcessBinding({ mode: "native", taskID,
        projectID: Instance.project.id, rootDirectory: directory,
        packageRevisionSHA256: schedulerCapability.packageRevision.packageDigest, timeCreated: now }),
    })
    const session = await Session.create({ kind: "orchestrator", parentID: root.id, title: "Accepted result activation" })
    const ingress = Database.use((db) => db.select().from(EngineTaskRootIngressTable)
      .where(eq(EngineTaskRootIngressTable.task_id, taskID)).orderBy(EngineTaskRootIngressTable.sequence).get())!
    const owner = `result-recovery:${taskID}`
    const activation = acquireTaskRootIngressLease({ ingressID: ingress.id, ownerOccurrenceID: owner,
      now: Date.now(), leaseMilliseconds: 120_000, assertControlOwnerInTransaction() {} })
    if (!activation.acquired) throw new Error("Task activation was not acquired")
    const control = currentOrchestratorControlMessage({ taskCreation: { taskID } }, taskID, ingress.id, ingress.id)!
    const model = resultRecoveryModel
    const user = await Session.updateMessage({ id: control.messageID, sessionID: session.id, role: "user",
      author: "orchestrator", agent: "orchestrator", time: { created: Date.now() },
      model: { providerID: model.providerID, modelID: model.id }, extra: control.extra })
    await Session.updatePart({ id: control.partID, sessionID: session.id, messageID: user.id,
      type: "text", text: control.text, kind: "control", source: "system" })
    const message = await Session.updateMessage({ id: Identifier.ascending("message"), sessionID: session.id,
      parentID: user.id, role: "assistant", author: "orchestrator", agent: "orchestrator", activationID: activation.activationID,
      time: { created: Date.now() }, modelID: model.id, providerID: model.providerID,
      path: { cwd: directory, root: directory }, cost: 0,
      tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } } })
    if (message.role !== "assistant") throw new Error("Task assistant required")
    const server = createServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      response.end("<html><title>Accepted task source</title><body>Actual accepted web result.</body></html>")
    }).listen(0, "127.0.0.1")
    await once(server, "listening")
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("Owned HTTP source address required")
    let value: Awaited<ReturnType<typeof completedReadResult>>
    try {
      value = await completedReadResult({ mode: "full_access", url: `http://127.0.0.1:${address.port}/source`, session, message, taskID })
    } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) }
    expect(releaseControlLease({ target: "task_root_ingress", targetID: ingress.id,
      leaseID: activation.activationID, ownerOccurrenceID: owner, now: Date.now() })).toBe(true)
    await SessionLoop.terminalizeRecoveredIncompleteAssistant(session.id, undefined,
      [{ messageID: message.id, completedAt: Date.now() }])
    await expectResult(value)
  })
}, 60_000)
