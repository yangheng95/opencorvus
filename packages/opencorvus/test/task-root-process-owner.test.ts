import { afterEach, expect, test } from "bun:test"
import { EngineTaskTable } from "@/engine/engine.sql"
import { acceptTaskRootIngressInTransaction, acquireTaskRootIngressLease, projectTaskRootIngress } from "@/engine/task-root-fact-store"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { observeProcessLiveness } from "@/engine/process-liveness"
import { configureTaskIngressRunner, readTaskRootIngressEvidence, reconcileTaskControlPlane, taskControlDriverSnapshot, TestHooks } from "@/engine/task-root-ingress-delivery"
import { currentOrchestratorControlMessage } from "@/orchestrator/agent"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { Database } from "@/storage/db"
import { releaseControlLeaseInTransaction } from "@/engine/control-lease"
import { TASK_CONTROL_HEARTBEAT_MS } from "@/engine/task-control-driver"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { childProcessIdentity } from "./fixture/process-liveness"

afterEach(resetMemoryDatabase)

test("an identity discovery retains its original Task until initialized execution completes it", async () => {
  await using project = await memoryProject()
  const frame = await Instance.provideProjectIdentity({ directory: project.path, fn: async () => {
    const current = await taskFrame(project.path)
    await reconcileTaskControlPlane(current.taskID)
    expect(taskControlDriverSnapshot()).toMatchObject([{ taskID: current.taskID, running: false, failures: 1 }])
    return current
  } })
  await Instance.provide({ directory: project.path, init: async () => {
    configureTaskIngressRunner(async input => {
      if (!input.activationID || !input.predecessorID) throw new Error("Expected initialized execution identity")
      return finish(await invocation(frame, input.activationID, input.predecessorID), "Original input after full initialization")
    })
  }, fn: async () => {
    const deadline = Date.now() + 5000
    while (projectTaskRootIngress(frame.ingress.id, Date.now(), readTaskRootIngressEvidence).state !== "resolved") {
      if (Date.now() >= deadline) throw new Error("Retained discovery did not execute after full initialization")
      await Bun.sleep(10)
    }
    const messages = await Session.messages({ sessionID: frame.orchestrator.id })
    expect(messages.flatMap(message => message.parts.filter(part => part.type === "tool").map(part => part.state)))
      .toMatchObject([{ status: "completed", output: "Original input after full initialization" }])
  } })
}, 30000)

async function taskFrame(directory: string) {
  const taskID = Identifier.ascending("task")
  const root = await Session.create({ kind: "root", title: "Physical owner observation" })
  const orchestrator = await Session.create({ kind: "orchestrator", parentID: root.id })
  const ingress = Database.immediateTransaction(db => {
    const now = Date.now()
    db.insert(EngineTaskTable).values({ id: taskID, project_id: Instance.project.id,
      session_id: root.id, source: "test", product_pillar: "code", title: "Physical owner observation",
      request: "Recover the original accepted input from its exact physical owner", time_created: now }).run()
    appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test.physical-owner" })
    return acceptTaskRootIngressInTransaction(db, { taskID, executionEpoch: 1, source: "inline",
      sourceID: Identifier.ascending("call"), inlinePayload: { note: "Original owner input" },
      semanticTurnLimit: 3, activationLimit: 4, now })
  })
  return { taskID, root, orchestrator, ingress, directory }
}

async function invocation(frame: Awaited<ReturnType<typeof taskFrame>>, activationID: string, predecessorID: string) {
  const control = currentOrchestratorControlMessage({ note: "Original owner input" }, frame.taskID, frame.ingress.id, predecessorID)
  if (!control) throw new Error("Expected a current canonical control occurrence")
  await Session.persistMessage({ info: { id: control.messageID, sessionID: frame.orchestrator.id,
    role: "user", author: "orchestrator", time: { created: Date.now() }, agent: "orchestrator",
    model: { providerID: "local-contract", modelID: "physical-owner" }, extra: control.extra },
    parts: [{ id: control.partID, sessionID: frame.orchestrator.id, messageID: control.messageID,
      type: "text", text: control.text, kind: "control", source: "system" }] })
  const assistant = await Session.updateMessage({ id: Identifier.ascending("message"),
    sessionID: frame.orchestrator.id, parentID: control.messageID, role: "assistant", author: "orchestrator",
    time: { created: Date.now() }, agent: "orchestrator", providerID: "local-contract", modelID: "physical-owner",
    path: { cwd: frame.directory, root: frame.directory }, cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
    finish: "tool-calls", activationID })
  if (assistant.role !== "assistant") throw new Error("Expected the original assistant Message")
  const part = await Session.updatePart({ id: Identifier.ascending("part"), sessionID: frame.orchestrator.id,
    messageID: assistant.id, type: "tool", callID: Identifier.ascending("call"), tool: "manage_task",
    state: { status: "running", input: { action: "inspect" }, time: { start: Date.now() } } }) as Message.ToolPart
  return { assistant, part }
}

async function finish(invoked: Awaited<ReturnType<typeof invocation>>, output: string) {
  const part = await Session.updatePart({ ...invoked.part, state: { status: "completed",
    input: invoked.part.state.input, output, title: "Original inspection", metadata: {},
    time: { start: invoked.part.state.status === "running" ? invoked.part.state.time.start : Date.now(), end: Date.now() } } })
  const message = await Session.updateMessage({ ...invoked.assistant, finish: "stop",
    time: { ...invoked.assistant.time, completed: Date.now() } })
  return { finalMessageID: message.id, part }
}

test("the original accepted input resolves promptly after its real process exits with an unexpired lease", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const frame = await taskFrame(project.path)
    const owner = Identifier.ascending("call")
    await using peer = childProcessIdentity(owner)
    const lease = acquireTaskRootIngressLease({ ingressID: frame.ingress.id, ownerOccurrenceID: owner,
      now: Date.now(), leaseMilliseconds: 120000, assertControlOwnerInTransaction: () => undefined })
    if (!lease.acquired) throw new Error("Expected the original current lease")
    await peer.exit()
    expect(observeProcessLiveness(owner)).toBe("dead_or_reused")
    using runner = TestHooks.replaceTaskIngressRunner({ runner: async input => {
      if (!input.activationID || !input.predecessorID) throw new Error("Expected exact resumed activation")
      return finish(await invocation(frame, input.activationID, input.predecessorID), "Recovered original input")
    } })
    await reconcileTaskControlPlane(frame.taskID)
    expect(projectTaskRootIngress(frame.ingress.id, Date.now(), readTaskRootIngressEvidence)).toMatchObject({ state: "resolved" })
    const messages = await Session.messages({ sessionID: frame.orchestrator.id })
    expect(messages.flatMap(message => message.parts.filter(part => part.type === "tool").map(part => part.state)))
      .toMatchObject([{ status: "completed", output: "Recovered original input" }])
  } })
}, 30000)

test("a physically live peer completes its original accepted result across the activation deadline", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const frame = await taskFrame(project.path)
    const owner = Identifier.ascending("call")
    await using peer = childProcessIdentity(owner)
    const lease = acquireTaskRootIngressLease({ ingressID: frame.ingress.id, ownerOccurrenceID: owner,
      now: Date.now(), leaseMilliseconds: 400, assertControlOwnerInTransaction: () => undefined })
    if (!lease.acquired) throw new Error("Expected the original current lease")
    const original = await invocation(frame, lease.activationID, frame.ingress.id)
    await Bun.sleep(Math.max(0, lease.expiresAt - Date.now()) + 10)
    expect(observeProcessLiveness(owner)).toBe("exact_live")
    using runner = TestHooks.replaceTaskIngressRunner({ runner: async input => {
      if (!input.activationID || !input.predecessorID) throw new Error("Expected a current activation")
      return finish(await invocation(frame, input.activationID, input.predecessorID), "Successor inspection")
    } })
    await reconcileTaskControlPlane(frame.taskID)
    const completed = await finish(original, "Original peer inspection completed")
    expect(completed.part).toMatchObject({ id: original.part.id, state: { status: "completed", output: "Original peer inspection completed" } })
    expect(projectTaskRootIngress(frame.ingress.id, Date.now(), readTaskRootIngressEvidence)).toMatchObject({ state: "resolved" })
  } })
}, 30000)

test("a dead peer's exact partial invocation settles before its accepted input resumes", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const frame = await taskFrame(project.path)
    const owner = Identifier.ascending("call")
    await using peer = childProcessIdentity(owner)
    const lease = acquireTaskRootIngressLease({ ingressID: frame.ingress.id, ownerOccurrenceID: owner,
      now: Date.now(), leaseMilliseconds: 120000, assertControlOwnerInTransaction: () => undefined })
    if (!lease.acquired) throw new Error("Expected the original current lease")
    const original = await invocation(frame, lease.activationID, frame.ingress.id)
    await peer.exit()
    expect(observeProcessLiveness(owner)).toBe("dead_or_reused")
    using runner = TestHooks.replaceTaskIngressRunner({ runner: async input => {
      if (!input.activationID || !input.predecessorID) throw new Error("Expected exact resumed activation")
      return finish(await invocation(frame, input.activationID, input.predecessorID), "Resumed after real peer exit")
    } })
    await reconcileTaskControlPlane(frame.taskID)
    expect(projectTaskRootIngress(frame.ingress.id, Date.now(), readTaskRootIngressEvidence)).toMatchObject({ state: "resolved" })
    const messages = await Session.messages({ sessionID: frame.orchestrator.id })
    const states = messages.flatMap(message => message.parts.filter(part => part.type === "tool").map(part => ({ id: part.id, ...part.state })))
    expect(states).toMatchObject([{ id: original.part.id, status: "error" }, { status: "completed", output: "Resumed after real peer exit" }])
  } })
}, 30000)

test("an unobservable physical owner retains its original accepted completion contract", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const frame = await taskFrame(project.path)
    const owner = Identifier.ascending("call")
    await using peer = childProcessIdentity(owner)
    const lease = acquireTaskRootIngressLease({ ingressID: frame.ingress.id, ownerOccurrenceID: owner,
      now: Date.now(), leaseMilliseconds: 400, assertControlOwnerInTransaction: () => undefined })
    if (!lease.acquired) throw new Error("Expected the original current lease")
    const original = await invocation(frame, lease.activationID, frame.ingress.id)
    await Bun.sleep(Math.max(0, lease.expiresAt - Date.now()) + 10)
    const now = Date.now()
    const recovery = await TestHooks.recoverTaskRootActivationOwner(frame.ingress.id, now, () => "unknown_live")
    expect(recovery).toEqual({ wakeAt: now + TASK_CONTROL_HEARTBEAT_MS })
    const completed = await finish(original, "Original result under uncertain observation")
    expect(completed.part).toMatchObject({ id: original.part.id, state: { status: "completed", output: "Original result under uncertain observation" } })
    expect(projectTaskRootIngress(frame.ingress.id, Date.now(), readTaskRootIngressEvidence)).toMatchObject({ state: "resolved" })
  } })
}, 30000)

test("missing physical identity returns its typed error and the same input recovers after identity admission", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const frame = await taskFrame(project.path)
    const owner = Identifier.ascending("call")
    const lease = acquireTaskRootIngressLease({ ingressID: frame.ingress.id, ownerOccurrenceID: owner,
      now: Date.now(), leaseMilliseconds: 120000, assertControlOwnerInTransaction: () => undefined })
    if (!lease.acquired) throw new Error("Expected the original current lease")
    const error = await TestHooks.recoverTaskRootActivationOwner(frame.ingress.id, Date.now()).catch(error => error)
    expect(error).toMatchObject({ name: "ProcessLivenessOwnerUnavailableError", code: "PROCESS_LIVENESS_OWNER_UNAVAILABLE" })
    await using peer = childProcessIdentity(owner)
    await peer.exit()
    using runner = TestHooks.replaceTaskIngressRunner({ runner: async input => {
      if (!input.activationID || !input.predecessorID) throw new Error("Expected exact resumed activation")
      return finish(await invocation(frame, input.activationID, input.predecessorID), "Recovered after exact identity admission")
    } })
    await reconcileTaskControlPlane(frame.taskID)
    expect(projectTaskRootIngress(frame.ingress.id, Date.now(), readTaskRootIngressEvidence)).toMatchObject({ state: "resolved" })
  } })
}, 30000)

test("a concurrent successor owns its exact lease and then delivers its original input after physical exit", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const frame = await taskFrame(project.path)
    const originalOwner = Identifier.ascending("call")
    const successorOwner = Identifier.ascending("call")
    await using originalPeer = childProcessIdentity(originalOwner)
    await using successorPeer = childProcessIdentity(successorOwner)
    const original = acquireTaskRootIngressLease({ ingressID: frame.ingress.id, ownerOccurrenceID: originalOwner,
      now: Date.now(), leaseMilliseconds: 120000, assertControlOwnerInTransaction: () => undefined })
    if (!original.acquired) throw new Error("Expected the original current lease")
    await originalPeer.exit()
    let successorID: string | undefined
    using race = TestHooks.replaceBeforeTaskRootOwnerSettlement(({ activationID }) => {
      if (activationID !== original.activationID) return
      Database.immediateTransaction(db => {
        releaseControlLeaseInTransaction(db, { target: "task_root_ingress", targetID: frame.ingress.id,
          leaseID: original.activationID, ownerOccurrenceID: originalOwner, now: Date.now() })
        const successor = acquireTaskRootIngressLease({ ingressID: frame.ingress.id, ownerOccurrenceID: successorOwner,
          now: Date.now(), leaseMilliseconds: 120000, assertControlOwnerInTransaction: () => undefined })
        if (!successor.acquired) throw new Error("Expected the concurrent successor lease")
        successorID = successor.activationID
      })
    })
    using runner = TestHooks.replaceTaskIngressRunner({ runner: async input => {
      if (!input.activationID || !input.predecessorID) throw new Error("Expected exact resumed activation")
      return finish(await invocation(frame, input.activationID, input.predecessorID), "Recovered rightful successor")
    } })
    await reconcileTaskControlPlane(frame.taskID)
    expect(projectTaskRootIngress(frame.ingress.id, Date.now(), readTaskRootIngressEvidence)).toMatchObject({
      state: "leased", activationID: successorID, ownerOccurrenceID: successorOwner,
    })
    await successorPeer.exit()
    await reconcileTaskControlPlane(frame.taskID)
    expect(projectTaskRootIngress(frame.ingress.id, Date.now(), readTaskRootIngressEvidence)).toMatchObject({ state: "resolved" })
    const messages = await Session.messages({ sessionID: frame.orchestrator.id })
    expect(messages.flatMap(message => message.parts.filter(part => part.type === "tool").map(part => part.state)))
      .toMatchObject([{ status: "completed", output: "Recovered rightful successor" }])
  } })
}, 30000)

test("parallel Projects deliver their own original results while one physical owner recovers", async () => {
  await using projectA = await memoryProject("owner-recovery-a")
  await using projectB = await memoryProject("owner-recovery-b")
  const frameA = await Instance.provide({ directory: projectA.path, fn: () => taskFrame(projectA.path) })
  const frameB = await Instance.provide({ directory: projectB.path, fn: () => taskFrame(projectB.path) })
  const ownerA = Identifier.ascending("call")
  const ownerB = Identifier.ascending("call")
  await using peerA = childProcessIdentity(ownerA)
  await using peerB = childProcessIdentity(ownerB)
  const originalB = await Instance.provide({ directory: projectB.path, fn: async () => {
    const lease = acquireTaskRootIngressLease({ ingressID: frameB.ingress.id, ownerOccurrenceID: ownerB,
      now: Date.now(), leaseMilliseconds: 120000, assertControlOwnerInTransaction: () => undefined })
    if (!lease.acquired) throw new Error("Expected Project B's original current lease")
    return invocation(frameB, lease.activationID, frameB.ingress.id)
  } })
  await Instance.provide({ directory: projectA.path, fn: async () => {
    const lease = acquireTaskRootIngressLease({ ingressID: frameA.ingress.id, ownerOccurrenceID: ownerA,
      now: Date.now(), leaseMilliseconds: 120000, assertControlOwnerInTransaction: () => undefined })
    if (!lease.acquired) throw new Error("Expected Project A's original current lease")
    await peerA.exit()
    using runner = TestHooks.replaceTaskIngressRunner({ runner: async input => {
      if (!input.activationID || !input.predecessorID) throw new Error("Expected Project A's resumed activation")
      return finish(await invocation(frameA, input.activationID, input.predecessorID), "Project A recovered result")
    } })
    await reconcileTaskControlPlane(frameA.taskID)
    expect(projectTaskRootIngress(frameA.ingress.id, Date.now(), readTaskRootIngressEvidence)).toMatchObject({ state: "resolved" })
  } })
  await Instance.provide({ directory: projectB.path, fn: async () => {
    const completed = await finish(originalB, "Project B original result")
    expect(completed.part).toMatchObject({ id: originalB.part.id, state: { status: "completed", output: "Project B original result" } })
    expect(projectTaskRootIngress(frameB.ingress.id, Date.now(), readTaskRootIngressEvidence)).toMatchObject({ state: "resolved" })
  } })
}, 30000)

test("an unavailable executor returns its configuration error and the original input executes after binding", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const frame = await taskFrame(project.path)
    const error = await reconcileTaskControlPlane(frame.taskID).catch(error => error)
    expect(error).toMatchObject({ message: "Task-root fact runner is not configured for this instance" })
    expect(projectTaskRootIngress(frame.ingress.id, Date.now(), readTaskRootIngressEvidence)).toEqual({ state: "ready" })
    using runner = TestHooks.replaceTaskIngressRunner({ runner: async input => {
      if (!input.activationID || !input.predecessorID) throw new Error("Expected the configured execution")
      return finish(await invocation(frame, input.activationID, input.predecessorID), "Original input after executor binding")
    } })
    await reconcileTaskControlPlane(frame.taskID)
    const deadline = Date.now() + 5000
    while (projectTaskRootIngress(frame.ingress.id, Date.now(), readTaskRootIngressEvidence).state !== "resolved") {
      if (Date.now() >= deadline) throw new Error("Configured execution did not resolve the original accepted input")
      await Bun.sleep(10)
    }
    expect(projectTaskRootIngress(frame.ingress.id, Date.now(), readTaskRootIngressEvidence)).toMatchObject({ state: "resolved" })
  } })
}, 30000)

test("an executor's original failure settles its physical claim before the same input completes", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const frame = await taskFrame(project.path)
    const originalFailure = new Error("Original executor admission failure")
    {
      using failure = TestHooks.replaceTaskIngressRunner({ runner: async () => { throw originalFailure } })
      const error = await reconcileTaskControlPlane(frame.taskID).catch(error => error)
      expect(error).toBe(originalFailure)
      expect(projectTaskRootIngress(frame.ingress.id, Date.now(), readTaskRootIngressEvidence)).toEqual({ state: "ready" })
    }
    using runner = TestHooks.replaceTaskIngressRunner({ runner: async input => {
      if (!input.activationID || !input.predecessorID) throw new Error("Expected the next legal execution")
      return finish(await invocation(frame, input.activationID, input.predecessorID), "Original input after settled failure")
    } })
    await reconcileTaskControlPlane(frame.taskID)
    const deadline = Date.now() + 5000
    while (projectTaskRootIngress(frame.ingress.id, Date.now(), readTaskRootIngressEvidence).state !== "resolved") {
      if (Date.now() >= deadline) throw new Error("The next legal execution did not resolve its original input")
      await Bun.sleep(10)
    }
    expect(projectTaskRootIngress(frame.ingress.id, Date.now(), readTaskRootIngressEvidence)).toMatchObject({ state: "resolved" })
  } })
}, 30000)
