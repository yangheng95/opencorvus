import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { createRightSidebarConversationSession } from "@/chat/session"
import { ConfigPaths } from "@/config/paths"
import { EngineTaskTable } from "@/engine/engine.sql"
import { recoverStartedTaskExecutions } from "@/engine/host-recovery"
import { appendTaskOpenedInTransaction, taskLifecycleProjection } from "@/engine/task-lifecycle"
import { Identifier } from "@/id/id"
import { closeMissionExecutionOperation, currentMissionExecutionClosure } from "@/mission/execution-closure"
import { ensureMissionSession } from "@/mission/session"
import { Instance, reenterActiveInstance, runOutsideInstanceContext } from "@/project/instance"
import { provideInitializedProjectExecution, runWithIndependentProjectIdentity } from "@/project/independent-project-owner"
import { ProtocolStore } from "@/protocol/store"
import { Server } from "@/server/server"
import { Session } from "@/session"
import { SessionPromptState } from "@/session/prompt/state"
import { SessionStatus } from "@/session/status"
import { publishSessionStatus } from "@/session/status-publication"
import { Database } from "@/storage/db"
import { EngineService } from "@/task-api"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

async function unavailableModel(directory: string) {
  const file = ConfigPaths.projectFile(directory)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify({ model: "stop-unavailable/model" }))
}

function stop(directory: string, route: string, body?: object) {
  return runOutsideInstanceContext(() => Server.App().request(route, {
    method: "POST", headers: { "x-opencorvus-directory": directory, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }))
}

async function ownedInput(session: Session.Info) {
  const input = await Session.updateMessage({
    id: Identifier.ascending("message"), sessionID: session.id, role: "user", author: "user", agent: "work",
    time: { created: Date.now() }, model: { providerID: "test", modelID: "original" },
  })
  const owner = SessionPromptState.start(session.id, session.directory)
  if (!owner) throw new Error("Expected the original Prompt owner")
  SessionStatus.beginExecutionOccurrence(session.id, input.id, owner)
  await publishSessionStatus(session, { type: "streaming" }, { inputMessageID: input.id, promptGenerationOwner: owner })
  let finished: Promise<void> | undefined
  owner.addEventListener("abort", () => {
    finished = SessionPromptState.finish(session.id, owner, session.directory, owner.reason)
  }, { once: true })
  return { input, owner, finished: () => finished }
}

async function openedTask(mission?: { id: string; missionID: string }) {
  const root = await Session.create({ kind: "root", title: "Original stop root" })
  const id = Identifier.ascending("task")
  Database.immediateTransaction(db => {
    db.insert(EngineTaskTable).values({
      id, project_id: Instance.project.id, session_id: root.id, source: mission ? "mission" : "test",
      product_pillar: "work", title: "Original stop task", request: "Stop the original occurrence", time_created: Date.now(),
      metadata: mission ? { actor: "mission", mission: { id: mission.missionID, session_id: mission.id } } : { actor: "user" },
    }).run()
    appendTaskOpenedInTransaction({ db, taskID: id, sessionID: root.id, now: Date.now(), source: "test.stop" })
  })
  return { id, root }
}

const provenance = { surface: "api", reason: "Operator stopped the original execution" } as const
const origin = (id: string) => ({
  actor: "user" as const, source: "task.cancel" as const, requestID: `stop:${id}`, ...provenance,
})

for (const kind of ["chat", "work", "session"] as const) {
  test(`${kind} Stop cancels the exact original input through full Server middleware with an unavailable model`, async () => {
    await using project = await memoryProject(`stop-${kind}`)
    const session = await Instance.provideProjectIdentity({ directory: project.path, fn: () =>
      kind === "session" ? Session.create({ kind: "assistant", title: "Ordinary stop" }) : createRightSidebarConversationSession(kind),
    })
    await unavailableModel(project.path)
    await Instance.disposeAll()
    const owned = await Instance.provideProjectIdentity({ directory: project.path, fn: () => ownedInput(session) })
    try {
      const route = kind === "session" ? `/session/${session.id}/abort` : `/coding/${kind}/session/${session.id}/abort`
      const response = await stop(project.path, route)
      expect({ status: response.status, body: await response.json(), ownerAborted: owned.owner.aborted }).toEqual({
        status: 200, body: true, ownerAborted: true,
      })
      await owned.finished()
      const fact = await Instance.provideProjectIdentity({ directory: project.path, fn: () =>
        ProtocolStore.latestSessionOccurrenceEvent(session.id, SessionStatus.Event.Status.type, owned.input.id),
      })
      expect(fact?.payload).toMatchObject({ inputMessageID: owned.input.id, status: { type: "terminal", reason: "aborted" } })
      const replay = await stop(project.path, route)
      expect({ status: replay.status, body: await replay.json() }).toEqual({ status: 200, body: true })
    } finally {
      await Instance.provideProjectIdentity({ directory: project.path, fn: () =>
        SessionPromptState.finish(session.id, owned.owner, session.directory, owned.owner.reason),
      })
    }
  }, 60_000)
}

test("Task Stop returns its canonical cancellation receipt with unavailable Project models", async () => {
  await using project = await memoryProject("stop-task")
  const task = await Instance.provideProjectIdentity({ directory: project.path, fn: () => openedTask() })
  await unavailableModel(project.path)
  await Instance.disposeAll()
  const response = await stop(project.path, `/task/${task.id}/cancel`, provenance)
  expect({ status: response.status, body: await response.json() }).toMatchObject({
    status: 202, body: { source: "task.cancel", actor: "user", surface: "api", reason: provenance.reason },
  })
  await Instance.provideProjectIdentity({ directory: project.path, fn: async () => {
    const settled = await EngineService.requestTaskCancellation(task.id, { origin: origin(task.id) })
    expect(settled).toMatchObject({ status: "cancelled", reason: provenance.reason })
    expect(taskLifecycleProjection(task.id).status).toBe("cancelled")
  } })
}, 60_000)

test("Task detached cancellation owns an independent cleanup lease with unavailable models", async () => {
  await using project = await memoryProject("stop-detached")
  const task = await Instance.provideProjectIdentity({ directory: project.path, fn: () => openedTask() })
  await unavailableModel(project.path)
  await Instance.disposeAll()
  await Instance.provideProjectIdentity({ directory: project.path, fn: async () => {
    expect(await EngineService.requestTaskCancellation(task.id, { origin: origin(task.id) })).toMatchObject({
      status: "cancelled", requestID: origin(task.id).requestID, reason: provenance.reason,
    })
  } })
}, 60_000)

test("Mission Stop closes its actual child Task through full Server middleware with unavailable models", async () => {
  await using project = await memoryProject("stop-mission")
  const fixture = await Instance.provideProjectIdentity({ directory: project.path, fn: async () => {
    const mission = await ensureMissionSession({ missionID: "stop-original-mission", defaultCwd: project.path, productPillar: "work", heldExpertSquadIDs: ["base"] })
    return { mission, task: await openedTask(mission) }
  } })
  await unavailableModel(project.path)
  await Instance.disposeAll()
  const response = await stop(project.path, `/mission/${fixture.mission.missionID}/abort`, provenance)
  expect({ status: response.status, body: await response.json() }).toEqual({ status: 200, body: true })
  expect(await Instance.provideProjectIdentity({ directory: project.path, fn: () => ({
    closure: currentMissionExecutionClosure(fixture.mission.id), task: taskLifecycleProjection(fixture.task.id).status,
  }) })).toMatchObject({ closure: { state: "closed", source: "mission.abort", provenance: { reason: provenance.reason } }, task: "cancelled" })
}, 60_000)

test("cold host recovery settles the original accepted Task cancellation before model initialization", async () => {
  await using project = await memoryProject("stop-recovery-task")
  const fixture = await Instance.provideProjectIdentity({ directory: project.path, fn: async () => {
    const task = await openedTask()
    const owner = SessionPromptState.start(task.root.id, task.root.directory)
    if (!owner) throw new Error("Expected original Task Prompt owner")
    let failure: unknown
    try {
      await EngineService.cancelTask(task.id, { origin: origin(task.id), promptSettleInactivityMs: 25 })
    } catch (error) {
      failure = error
    } finally {
      await SessionPromptState.finish(task.root.id, owner, task.root.directory, owner.reason)
    }
    expect(failure).toMatchObject({ name: "TaskCancellationIncompleteError" })
    expect(taskLifecycleProjection(task.id).status).toBe("cancelling")
    return { task, request: ProtocolStore.latestTaskEvent(task.id, "task.cancellation.requested")! }
  } })
  await unavailableModel(project.path)
  await Instance.disposeAll()
  const recovery = await runOutsideInstanceContext(() => recoverStartedTaskExecutions({ scopeProjectWorktree: project.path }))
  expect(await Instance.provideProjectIdentity({ directory: project.path, fn: () => taskLifecycleProjection(fixture.task.id).status })).toBe("cancelled")
  const terminal = await Instance.provideProjectIdentity({ directory: project.path, fn: async () => ({
    lifecycle: taskLifecycleProjection(fixture.task.id).status,
    receipt: await EngineService.requestTaskCancellation(fixture.task.id, { origin: origin(fixture.task.id) }),
  }) })
  expect({ recovery, terminal }).toMatchObject({
    terminal: { lifecycle: "cancelled", receipt: { status: "cancelled", requestEventID: fixture.request.id, requestID: origin(fixture.task.id).requestID } },
  })
}, 60_000)

test("cold host recovery settles the original interrupted Mission close before model initialization", async () => {
  await using project = await memoryProject("stop-recovery-mission")
  const fixture = await Instance.provideProjectIdentity({ directory: project.path, fn: async () => {
    const mission = await ensureMissionSession({ missionID: "stop-recover-original-mission", defaultCwd: project.path, productPillar: "work", heldExpertSquadIDs: ["base"] })
    const task = await openedTask(mission)
    const interrupted = new Error("Original close request connection interrupted")
    const outcome = await closeMissionExecutionOperation({
      missionID: mission.missionID, sessionID: mission.id, source: "mission.abort", requestID: "original-mission-stop",
      provenance: { kind: "request", ...provenance }, signal: AbortSignal.abort(interrupted),
    }).then(value => ({ value }), error => ({ error }))
    expect(outcome).toEqual({ error: interrupted })
    expect(currentMissionExecutionClosure(mission.id)).toMatchObject({ state: "closing", requestID: "original-mission-stop" })
    return { mission, task }
  } })
  await unavailableModel(project.path)
  await Instance.disposeAll()
  await runOutsideInstanceContext(() => recoverStartedTaskExecutions({ scopeProjectWorktree: project.path }))
  expect(await Instance.provideProjectIdentity({ directory: project.path, fn: () => ({
    closure: currentMissionExecutionClosure(fixture.mission.id), task: taskLifecycleProjection(fixture.task.id).status,
  }) })).toMatchObject({ closure: { state: "closed", requestID: "original-mission-stop" }, task: "cancelled" })
}, 60_000)

test("accepted Task cancellation retains its cleanup owner after the HTTP request finishes", async () => {
  await using project = await memoryProject("stop-delayed-cleanup")
  const task = await Instance.provideProjectIdentity({ directory: project.path, fn: () => openedTask() })
  await unavailableModel(project.path)
  await Instance.disposeAll()
  const release = Promise.withResolvers<void>()
  let finished: Promise<void> | undefined
  const owner = await Instance.provideProjectIdentity({ directory: project.path, fn: () => {
    const owner = SessionPromptState.start(task.root.id, task.root.directory)
    if (!owner) throw new Error("Expected original Task Prompt owner")
    owner.addEventListener("abort", () => {
      finished = release.promise.then(() => runWithIndependentProjectIdentity({
        directory: project.path, fn: () => SessionPromptState.finish(task.root.id, owner, task.root.directory, owner.reason),
      }))
      void finished.catch(() => undefined)
    }, { once: true })
    return owner
  } })
  try {
    const response = await stop(project.path, `/task/${task.id}/cancel`, provenance)
    const accepted = await response.json()
    expect({ status: response.status, accepted, originalOwner: owner.aborted }).toMatchObject({
      status: 202, accepted: { status: "cancelling", reason: provenance.reason }, originalOwner: true,
    })
    release.resolve()
    await finished
    const deadline = Date.now() + 5_000
    let receipt
    while (Date.now() < deadline) {
      receipt = await runWithIndependentProjectIdentity({ directory: project.path, fn: () =>
        EngineService.requestTaskCancellation(task.id, { origin: origin(task.id) }),
      })
      if (receipt.status === "cancelled") break
      await new Promise(resolve => setTimeout(resolve, 25))
    }
    expect(receipt).toMatchObject({ status: "cancelled", requestEventID: accepted.requestEventID, reason: provenance.reason })
  } finally {
    release.resolve()
    await finished
    await runWithIndependentProjectIdentity({ directory: project.path, fn: () =>
      SessionPromptState.finish(task.root.id, owner, task.root.directory, owner.reason),
    })
  }
}, 60_000)

test("parallel Stop requests retain exact Task receipts across two Projects", async () => {
  await using first = await memoryProject("stop-parallel-first")
  await using second = await memoryProject("stop-parallel-second")
  const fixtures: Array<{ directory: string; task: Awaited<ReturnType<typeof openedTask>> }> = []
  for (const project of [first, second]) {
    const tasks = await Instance.provideProjectIdentity({ directory: project.path, fn: async () => [await openedTask(), await openedTask()] })
    await unavailableModel(project.path)
    fixtures.push(...tasks.map(task => ({ directory: project.path, task })))
  }
  await Instance.disposeAll()
  const accepted = await Promise.all(fixtures.map(async fixture => {
    const response = await stop(fixture.directory, `/task/${fixture.task.id}/cancel`, { ...provenance, reason: fixture.task.id })
    expect(response.status).toBe(202)
    return response.json()
  }))
  for (const [index, fixture] of fixtures.entries()) {
    const receipt = await runWithIndependentProjectIdentity({ directory: fixture.directory, fn: () =>
      EngineService.requestTaskCancellation(fixture.task.id, { origin: origin(fixture.task.id) }),
    })
    expect(receipt).toMatchObject({ status: "cancelled", requestEventID: accepted[index].requestEventID, reason: fixture.task.id })
  }
}, 60_000)

test("unavailable-model Stop keeps the canonical Mission Session authority error", async () => {
  await using project = await memoryProject("stop-authority")
  const mission = await Instance.provideProjectIdentity({ directory: project.path, fn: () => ensureMissionSession({
    missionID: "stop-authority-mission", defaultCwd: project.path, productPillar: "work", heldExpertSquadIDs: ["base"],
  }) })
  await unavailableModel(project.path)
  await Instance.disposeAll()
  const response = await stop(project.path, `/session/${mission.id}/abort`)
  expect({ status: response.status, body: await response.json() }).toMatchObject({
    status: 409, body: { name: "MissionSessionAuthorityError" },
  })
}, 60_000)

test("scoped cold Stop recovery preserves each Project's original cancellation occurrence", async () => {
  await using first = await memoryProject("stop-scoped-first")
  await using second = await memoryProject("stop-scoped-second")
  const fixtures: Array<{ directory: string; task: Awaited<ReturnType<typeof openedTask>>; requestEventID: string }> = []
  for (const project of [first, second]) {
    const task = await Instance.provideProjectIdentity({ directory: project.path, fn: async () => {
      const task = await openedTask()
      const owner = SessionPromptState.start(task.root.id, task.root.directory)
      if (!owner) throw new Error("Expected original scoped Prompt owner")
      try {
        const outcome = await EngineService.cancelTask(task.id, { origin: origin(task.id), promptSettleInactivityMs: 25 })
          .then(value => ({ value }), error => ({ error }))
        expect(outcome).toMatchObject({ error: { name: "TaskCancellationIncompleteError" } })
      } finally {
        await SessionPromptState.finish(task.root.id, owner, task.root.directory, owner.reason)
      }
      return { ...task, request: ProtocolStore.latestTaskEvent(task.id, "task.cancellation.requested")! }
    } })
    await unavailableModel(project.path)
    fixtures.push({ directory: project.path, task, requestEventID: task.request.id })
    // A cold-start fixture must settle its original process-owned driver before
    // creating another Project; online cleanup now legitimately resumes it.
    await Instance.disposeAll()
  }
  await Instance.disposeAll()
  await runOutsideInstanceContext(() => recoverStartedTaskExecutions({ scopeProjectWorktree: first.path }))
  const states = await Promise.all(fixtures.map(fixture => runWithIndependentProjectIdentity({
    directory: fixture.directory, fn: () => taskLifecycleProjection(fixture.task.id).status,
  })))
  expect(states).toEqual(["cancelled", "cancelling"])
  await runOutsideInstanceContext(() => recoverStartedTaskExecutions({ scopeProjectWorktree: second.path }))
  for (const fixture of fixtures) {
    const receipt = await runWithIndependentProjectIdentity({ directory: fixture.directory, fn: () =>
      EngineService.requestTaskCancellation(fixture.task.id, { origin: origin(fixture.task.id) }),
    })
    expect(receipt).toMatchObject({ status: "cancelled", requestEventID: fixture.requestEventID })
  }
}, 60_000)

test("unavailable-model child Stop retains the projected worker runtime authority check", async () => {
  await using project = await memoryProject("stop-child-authority")
  const fixture = await Instance.provideProjectIdentity({ directory: project.path, fn: async () => {
    const task = await openedTask()
    const child = await Session.create({ kind: "delegated-worker", parentID: task.root.id, title: "Original child" })
    return { task, child }
  } })
  await unavailableModel(project.path)
  await Instance.disposeAll()
  const response = await stop(project.path, `/task/${fixture.task.id}/session/${fixture.child.id}/cancel`)
  expect(response.status).toBe(400)
  expect(await response.json()).toMatchObject({
    success: false,
    data: { message: `Session ${fixture.child.id} has no projected worker runtime identity for agent session control` },
  })
}, 60_000)

test("a cold Task Stop automatically retries its original failed physical settlement", async () => {
  await using project = await memoryProject("stop-online-task")
  const task = await Instance.provideProjectIdentity({ directory: project.path, fn: () => openedTask() })
  await unavailableModel(project.path)
  await Instance.disposeAll()
  const request = await runWithIndependentProjectIdentity({ directory: project.path, fn: async () => {
    const owner = SessionPromptState.start(task.root.id, task.root.directory)
    if (!owner) throw new Error("Expected original interrupted Prompt owner")
    try {
      const result = await EngineService.cancelTask(task.id, { origin: origin(task.id), promptSettleInactivityMs: 25 })
        .then(value => ({ value }), error => ({ error }))
      expect(result).toMatchObject({ error: { name: "TaskCancellationIncompleteError" } })
      expect(taskLifecycleProjection(task.id).status).toBe("cancelling")
      return ProtocolStore.latestTaskEvent(task.id, "task.cancellation.requested")!
    } finally {
      await SessionPromptState.finish(task.root.id, owner, task.root.directory, owner.reason)
    }
  } })
  let status = "cancelling"
  const deadline = Date.now() + 5_000
  while (Date.now() < deadline && status === "cancelling") {
    status = await runWithIndependentProjectIdentity({ directory: project.path, fn: () => taskLifecycleProjection(task.id).status })
    if (status === "cancelling") await new Promise(resolve => setTimeout(resolve, 25))
  }
  expect(status).toBe("cancelled")
  const receipt = await runWithIndependentProjectIdentity({ directory: project.path, fn: () =>
    EngineService.requestTaskCancellation(task.id, { origin: origin(task.id) }),
  })
  expect(receipt).toMatchObject({ status: "cancelled", requestEventID: request.id, requestID: origin(task.id).requestID })
}, 60_000)

test("a cold Mission Stop automatically resumes its original interrupted close occurrence", async () => {
  await using project = await memoryProject("stop-online-mission")
  const fixture = await Instance.provideProjectIdentity({ directory: project.path, fn: async () => {
    const mission = await ensureMissionSession({ missionID: "stop-online-mission", defaultCwd: project.path, productPillar: "work", heldExpertSquadIDs: ["base"] })
    return { mission, task: await openedTask(mission) }
  } })
  await unavailableModel(project.path)
  await Instance.disposeAll()
  const original = await runWithIndependentProjectIdentity({ directory: project.path, fn: async () => {
    const interrupted = new Error("Original Mission Stop connection closed")
    const result = await closeMissionExecutionOperation({
      missionID: fixture.mission.missionID, sessionID: fixture.mission.id, source: "mission.abort", requestID: "online-original-mission-stop",
      provenance: { kind: "request", ...provenance }, signal: AbortSignal.abort(interrupted),
    }).then(value => ({ value }), error => ({ error }))
    expect(result).toEqual({ error: interrupted })
    const closure = currentMissionExecutionClosure(fixture.mission.id)!
    expect(closure).toMatchObject({ state: "closing", requestID: "online-original-mission-stop" })
    return closure
  } })
  const deadline = Date.now() + 5_000
  let state = original.state
  while (Date.now() < deadline && state === "closing") {
    state = await runWithIndependentProjectIdentity({ directory: project.path, fn: () => currentMissionExecutionClosure(fixture.mission.id)!.state })
    if (state === "closing") await new Promise(resolve => setTimeout(resolve, 25))
  }
  expect(await runWithIndependentProjectIdentity({ directory: project.path, fn: () => ({
    closure: currentMissionExecutionClosure(fixture.mission.id), child: taskLifecycleProjection(fixture.task.id).status,
  }) })).toMatchObject({ closure: { state: "closed", operationID: original.operationID, requestID: original.requestID }, child: "cancelled" })
}, 60_000)

test("cached cleanup identity retains its Project while executable admission reports the original model error", async () => {
  await using project = await memoryProject("stop-cached-identity")
  const session = await Instance.provideProjectIdentity({ directory: project.path, fn: () => Session.create({ kind: "assistant", title: "Retained cleanup identity" }) })
  await unavailableModel(project.path)
  await Instance.disposeAll()
  const observe = () => runWithIndependentProjectIdentity({ directory: project.path, fn: () =>
    reenterActiveInstance({ directory: project.path, admission: "identity", fn: async () => ({
      projectID: Instance.project.id, directory: Instance.directory, sessionID: (await Session.get(session.id)).id,
    }) }),
  })
  const before = await observe()
  expect(before).toEqual({ projectID: session.projectID, directory: project.path, sessionID: session.id })
  const result = await runOutsideInstanceContext(() => provideInitializedProjectExecution({ directory: project.path, fn: () => "runtime admitted" }))
    .then(value => ({ value }), error => ({ error }))
  expect(result).toMatchObject({ error: { name: "ProviderModelNotFoundError" } })
  const after = await observe()
  expect(after).toEqual({ projectID: session.projectID, directory: project.path, sessionID: session.id })
}, 60_000)
