import { afterEach, expect, spyOn, test } from "bun:test"
import { Bus } from "@/bus"
import { Config } from "@/config/config"
import { EngineInteraction } from "@/engine/interaction"
import { PermissionAuthority } from "@/permission/authority"
import { ProtocolStore } from "@/protocol/store"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Project } from "@/project/project"
import { Server } from "@/server/server"
import { Session } from "@/session"
import { EngineService } from "@/task-api"
import { NotFoundError } from "@/storage/db"
import { Database } from "@/storage/db"
import { readPermissionRequestFacts } from "@/permission/ledger-facts"
import { withTimeout } from "@/util/await-with-timeout"
import { timelineInteractionResponseOrderKey } from "@/timeline/order"
import { BusPublicationOutboxTable } from "@/bus/bus.sql"
import { eq } from "drizzle-orm"
import { ChannelIngress } from "@/channel/ingress"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { persistEstablishedTask } from "../fixture/engine-task"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function taskFixture(channelBinding?: Parameters<typeof persistEstablishedTask>[0]["channelBinding"]) {
  const revision = {
    scope: "built_in" as const,
    projectID: null,
    namespace: "builtin",
    id: "board-validator-contract",
    version: "2026.10.14.1",
    packageDigest: "a".repeat(64),
  }
  const root = Session.prepareRootNext({
    kind: "root",
    directory: Instance.directory,
    title: "Board validator",
    metadata: { configOverlay: { prompt_profile: { active: revision.id } } },
  })
  const taskID = Identifier.ascending("task"),
    now = Date.now()
  persistEstablishedTask({
    taskID,
    rootSession: root,
    now,
    title: "Board validator",
    request: "Public board contract",
    productPillar: "work",
    source: "test",
    priority: "normal",
    metadata: {},
    channelBinding,
    projectID: Instance.project.id,
    packageRevision: revision,
    executionCapsuleBinding: await prepareTaskProcessBinding({
      mode: "native",
      taskID,
      projectID: Instance.project.id,
      rootDirectory: Instance.directory,
      packageRevisionSHA256: revision.packageDigest,
      timeCreated: now,
    }),
  })
  return { taskID, root }
}

for (const replyFirst of [true, false]) test(`Task permission projects the canonical reply when reply-first=${replyFirst}`, async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    await Config.updateProjectPatch({ permission_mode: "ask" })
    const { taskID, root } = await taskFixture()
    let request: PermissionAuthority.Request | undefined
    const reply = () => Bus.subscribe(PermissionAuthority.Event.Asked, async event => {
      request = event.properties
      await PermissionAuthority.reply({ requestID: request.id, decision: "allow_task", actorID: "task-operator", autoReply: false })
    })
    let stop: () => void
    if (replyFirst) { stop = reply(); EngineInteraction.subscribe() }
    else { EngineInteraction.subscribe(); stop = reply() }
    const notifications: any[] = []
    const subscription = ProtocolStore.subscribeEvents(event => { notifications.push(event) },
      { aggregate: "task", taskID, types: ["interaction.resolved"] })
    try {
      let executions = 0
      const result = await withTimeout(PermissionAuthority.authorizeAndExecute({ projectID: Instance.project.id,
        sessionID: root.id, messageID: Identifier.ascending("message"), toolCallID: Identifier.ascending("part"),
        providerKind: "builtin", providerID: "builtin", toolName: "webfetch", args: { url: "https://example.test/task-report" },
      }, async () => { executions++; return "actual task callback result" }), 10000, "Task permission decision and original execution")
      await subscription.drain()
      const facts = Database.use(db => readPermissionRequestFacts(db, request!.id))!
      const response = await Server.App().request(`/task/${taskID}/board`, { headers: { "x-opencorvus-directory": project.path } })
      const board = await response.json() as any
      expect({ result, status: response.status, interactions: board.interactions.map((item: any) => ({
        externalID: item.externalID, status: item.status, response: item.response, resolved: item.time.resolved,
      })) }).toEqual({ result: "actual task callback result", status: 200, interactions: [{ externalID: request!.id,
        status: "answered", response: { decision: "allow_task" }, resolved: facts.authority!.time_created }] })
      expect({ executions, rows: facts.rows.map(row => row.event_type), source: facts.start?.source_event_id, result: facts.result?.result })
        .toEqual({ executions: 1, rows: ["requested", "grant_created", "execution_started", "execution_succeeded"],
          source: facts.authority!.id, result: { kind: "json", value: "actual task callback result" } })
      expect(Database.use(db => db.select().from(BusPublicationOutboxTable)
        .where(eq(BusPublicationOutboxTable.event_type, "permission.replied")).all()).map(row => row.properties))
        .toEqual([{ sessionID: root.id, requestID: request!.id, decision: "allow_task", actorID: "task-operator", autoReply: false }])
      const terminalProjection = { type: "interaction.resolved", taskID, sessionID: root.id,
        orderKey: timelineInteractionResponseOrderKey({ id: board.interactions[0].id, timeResolved: facts.authority!.time_created }),
        payload: { taskID, interactionID: board.interactions[0].id, requestType: "permission", requestID: request!.id,
          status: "answered", ledgerEventID: facts.authority!.id, summary: "Permission allow_task" } }
      expect(notifications.map(event => ({ type: event.type, taskID: event.taskID, sessionID: event.sessionID,
        orderKey: event.orderKey, payload: event.payload }))).toEqual(replyFirst ? [terminalProjection, terminalProjection] : [terminalProjection])
    } finally { stop!(); subscription() }
  } })
})

test("Channel Permission confirmation describes the actual winner of its real Task decision race", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    await Config.updateProjectPatch({ permission_mode: "ask" })
    EngineInteraction.subscribe()
    const channel = { platform: "slack", channel: "public-channel", thread: "public-thread" }
    const { taskID, root } = await taskFixture(channel)
    const asked = Promise.withResolvers<PermissionAuthority.Request>()
    const stop = Bus.subscribe(PermissionAuthority.Event.Asked, event => { asked.resolve(event.properties) })
    const execution = PermissionAuthority.authorizeAndExecute({ projectID: Instance.project.id, sessionID: root.id,
      messageID: Identifier.ascending("message"), toolCallID: Identifier.ascending("part"), providerKind: "builtin", providerID: "builtin",
      toolName: "webfetch", args: { url: "https://example.test/channel-report" },
    }, async () => "channel callback result")
    void execution.catch(() => undefined)
    try {
      const request = await withTimeout(asked.promise, 10000, "Task channel Permission Asked")
      // listTaskInteractions materializes its pending snapshot synchronously;
      // its awaited return leaves the actual competing operator a commit turn.
      const ingress = ChannelIngress.message({ ...channel, platform: "slack", text: "always",
        request_id: "channel-permission-race", allow_create: false })
      const winner = await PermissionAuthority.reply({ requestID: request.id, decision: "deny", actorID: "original-operator", autoReply: false })
      const result = await withTimeout(ingress, 10000, "actual channel interaction result")
      await expect(execution).rejects.toBeInstanceOf(PermissionAuthority.RejectedError)
      const interactions = await EngineService.listTaskInteractions(taskID)
      expect({ result, winner: winner.decision, interactions: interactions.map(item => ({ status: item.status, response: item.response })) })
        .toEqual({ result: { kind: "interaction", message: "Permission rejected.", task_id: taskID, interaction_id: interactions[0]!.id },
          winner: "deny", interactions: [{ status: "rejected", response: { decision: "deny" } }] })
      expect(Database.use(db => readPermissionRequestFacts(db, request.id))!.rows.map(row => row.event_type)).toEqual(["requested", "denied"])
    } finally { stop(); await PermissionAuthority.cancelPendingForSession(root.id, "Channel contract cleanup"); await Promise.allSettled([execution]) }
  } })
}, 30000)

test("real HTTP Board uses its complete weak entity tag for GET lists, wildcard, weak comparison and HEAD", async () => {
  await using project = await memoryProject()
  const { taskID } = await Instance.provide({ directory: project.path, fn: taskFixture })
  const server = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
  const url = new URL(`/task/${taskID}/board`, server.url)
  const headers = { "x-opencorvus-directory": project.path, origin: "http://localhost:5173" }
  try {
    const first = await fetch(url, { headers }),
      board = (await first.json()) as any
    expect(first.status).toBe(200)
    const tag = first.headers.get("etag")!
    expect({ tag, version: board.snapshotVersion }).toEqual({
      tag: expect.stringMatching(/^W\/"task-board-v1:[a-f0-9]{64}"$/),
      version: tag,
    })
    for (const condition of [tag, `"another", ${tag}`, "*", tag.slice(2)]) {
      const response = await fetch(url, { headers: { ...headers, "if-none-match": condition } })
      expect({
        status: response.status,
        etag: response.headers.get("etag"),
        body: await response.text(),
        cors: response.headers.get("access-control-allow-origin"),
        vary: response.headers.get("vary"),
        requestID: response.headers.get("x-opencorvus-request-id"),
      }).toMatchObject({
        status: 304,
        etag: tag,
        body: "",
        cors: headers.origin,
        vary: expect.stringContaining("Origin"),
        requestID: expect.any(String),
      })
    }
    const different = await fetch(url, { headers: { ...headers, "if-none-match": 'W/"different"' } })
    expect({ status: different.status, body: await different.json() }).toEqual({ status: 200, body: board })
    const head = await fetch(url, { method: "HEAD", headers })
    expect({ status: head.status, etag: head.headers.get("etag"), body: await head.text() }).toEqual({
      status: 200,
      etag: tag,
      body: "",
    })
  } finally {
    await server.stop(true)
  }
}, 60_000)

test("same-millisecond Task Permission termination refreshes its actual ledger-backed Interaction and HTTP body", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      await Config.updateProjectPatch({ permission_mode: "ask" })
      EngineInteraction.subscribe()
      const { taskID, root } = await taskFixture()
      let unsubscribe = () => {}
      const asked = new Promise<PermissionAuthority.Request>((resolve) => {
        unsubscribe = Bus.subscribe(PermissionAuthority.Event.Asked, ({ properties }) => {
          if (properties.sessionID === root.id) {
            unsubscribe()
            resolve(properties)
          }
        })
      })
      const execution = PermissionAuthority.authorizeAndExecute(
        {
          projectID: Instance.project.id,
          sessionID: root.id,
          messageID: Identifier.ascending("message"),
          toolCallID: Identifier.ascending("part"),
          providerKind: "builtin",
          providerID: "builtin",
          toolName: "write",
          args: { filePath: `${project.path}/task-output.txt`, content: "public" },
        },
        async () => "completed",
      ).catch((error) => error)
      const request = await asked
      const notifications: any[] = []
      const subscription = ProtocolStore.subscribeEvents(
        (event) => {
          notifications.push(event)
        },
        { aggregate: "task", taskID, types: ["interaction.resolved"] },
      )
      const headers = { "x-opencorvus-directory": project.path }
      try {
        const before = await Server.App().request(`/task/${taskID}/board`, { headers })
        const old = (await before.json()) as any
        expect(old.interactions.map((item: any) => ({ externalID: item.externalID, status: item.status }))).toEqual([
          { externalID: request.id, status: "pending" },
        ])
        const pendingFact = (await PermissionAuthority.list()).find((item) => item.id === request.id)!
        const clock = spyOn(Date, "now").mockReturnValue(pendingFact.timeCreated)
        let decision: PermissionAuthority.Resolution
        try {
          decision = await PermissionAuthority.settleStale(request.id, "Task public input changed")
        } finally {
          clock.mockRestore()
        }
        expect(await execution).toBeInstanceOf(PermissionAuthority.RejectedError)
        await subscription.drain()
        expect(notifications.map((event) => event.payload)).toEqual([
          expect.objectContaining({
            taskID,
            interactionID: old.interactions[0].id,
            requestID: request.id,
            ledgerEventID: decision.eventID,
            status: "rejected",
          }),
        ])
        const updated = await Server.App().request(`/task/${taskID}/board`, {
          headers: { ...headers, "if-none-match": before.headers.get("etag")! },
        })
        expect(updated.status).toBe(200)
        const board = (await updated.json()) as any
        expect(board.interactions[0]).toMatchObject({
          id: old.interactions[0].id,
          externalID: request.id,
          status: "rejected",
          response: {
            decision: "deny",
            termination: {
              status: "stale",
              ledgerEventID: decision.eventID,
              reason: "Task public input changed",
            },
          },
          time: { created: pendingFact.timeCreated, resolved: pendingFact.timeCreated },
        })
        expect(board.snapshotVersion).toBe(updated.headers.get("etag"))
        const standalone = await Server.App().request(`/session/${root.id}/conversation`, { headers })
        expect(((await standalone.json()) as any).pendingPermissions).toEqual([])
      } finally {
        subscription()
        await PermissionAuthority.cancelPendingForSession(root.id, "contract finished")
        await execution
      }
    },
  })
}, 60_000)

test("a real denied Permission retains its operator decision in the public Task history", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    await Config.updateProjectPatch({ permission_mode: "ask" })
    EngineInteraction.subscribe()
    const { taskID, root } = await taskFixture()
    let request: PermissionAuthority.Request | undefined
    const unsubscribe = Bus.subscribe(PermissionAuthority.Event.Asked, async ({ properties }) => {
      request = properties
      await PermissionAuthority.reply({
        requestID: request.id,
        decision: "deny",
        actorID: "task-operator",
        message: "Operator declined this exact request",
      })
    })
    try {
      const result = await withTimeout(PermissionAuthority.authorizeAndExecute({
        projectID: Instance.project.id,
        sessionID: root.id,
        messageID: Identifier.ascending("message"),
        toolCallID: Identifier.ascending("part"),
        providerKind: "builtin",
        providerID: "builtin",
        toolName: "webfetch",
        args: { url: "https://example.test/operator-decision" },
      }, async () => "authorized result").catch((error) => error), 10000, "Original operator denial")
      expect(result).toBeInstanceOf(PermissionAuthority.RejectedError)
      const facts = Database.use((db) => readPermissionRequestFacts(db, request!.id))!
      expect(facts.authority).toMatchObject({ event_type: "denied", actor_id: "task-operator" })
      const response = await Server.App().request(`/task/${taskID}/board`, {
        headers: { "x-opencorvus-directory": project.path },
      })
      const board = await response.json() as any
      expect({ status: response.status, interactions: board.interactions.map((item: any) => ({
        externalID: item.externalID, status: item.status, response: item.response, resolved: item.time.resolved,
      })) }).toEqual({ status: 200, interactions: [{
        externalID: request!.id, status: "rejected", response: { decision: "deny" }, resolved: facts.authority!.time_created,
      }] })
    } finally {
      unsubscribe()
    }
  } })
}, 30000)

test("Task-ID record reads retain their owner while an explicit execution Project enforces its authority", async () => {
  await using owner = await memoryProject("validator-owner")
  await using other = await memoryProject("validator-other")
  const { taskID } = await Instance.provide({ directory: owner.path, fn: taskFixture })
  const otherProjectID = await Instance.provide({ directory: other.path, fn: () => Instance.project.id })
  const ordinary = await Server.App().request(`/task/${taskID}/board`, {
    headers: { "x-opencorvus-directory": other.path },
  })
  const ordinaryBody = (await ordinary.json()) as any
  console.log("Board non-conditional Project response", {
    status: ordinary.status,
    requestedTaskID: taskID,
    headerProjectID: otherProjectID,
    bodyTaskID: ordinaryBody.task?.id,
    bodyProjectID: ordinaryBody.project?.id,
  })
  const ownerProjectID = await Instance.provide({ directory: owner.path, fn: () => Instance.project.id })
  expect({ status: ordinary.status, taskID: ordinaryBody.task.id, projectID: ordinaryBody.project.id }).toEqual({
    status: 200,
    taskID,
    projectID: ownerProjectID,
  })
  const response = await Server.App().request(`/task/${taskID}/board`, {
    headers: { "x-opencorvus-directory": other.path, "if-none-match": "*" },
  })
  const text = await response.text()
  expect({ status: response.status, text, etag: response.headers.get("etag") }).toEqual({
    status: 304,
    text: "",
    etag: ordinaryBody.snapshotVersion,
  })
  const unknown = await Server.App().request(`/task/${Identifier.ascending("task")}/board`, {
    headers: { "if-none-match": "*" },
  })
  expect({ status: unknown.status, body: await unknown.json() }).toMatchObject({
    status: 404,
    body: { name: "NotFoundError" },
  })
  await Instance.provide({
    directory: other.path,
    fn: async () => {
      await expect(EngineService.getBoard(taskID)).rejects.toBeInstanceOf(NotFoundError)
    },
  })
})

test("actual Project public fields change the Board response and invalidate its previous HTTP validator", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const { taskID } = await taskFixture()
      const headers = { "x-opencorvus-directory": project.path }
      const first = await Server.App().request(`/task/${taskID}/board`, { headers })
      const before = (await first.json()) as any,
        tag = first.headers.get("etag")!
      await Project.update({ projectID: Instance.project.id, name: "Public project revised" })
      const response = await Server.App().request(`/task/${taskID}/board`, {
        headers: { ...headers, "if-none-match": tag },
      })
      expect(response.status).toBe(200)
      const after = (await response.json()) as any
      expect({ name: after.project.name, taskID: after.task.id, version: after.snapshotVersion }).toEqual({
        name: "Public project revised",
        taskID,
        version: response.headers.get("etag"),
      })
      expect(before.project.id).toBe(after.project.id)
      await EngineService.updateTaskTitle(taskID, "Actual Task title revised")
      const taskChanged = await Server.App().request(`/task/${taskID}/board`, {
        headers: { ...headers, "if-none-match": after.snapshotVersion },
      })
      const changed = (await taskChanged.json()) as any
      expect({ status: taskChanged.status, title: changed.task.title, version: changed.snapshotVersion }).toEqual({
        status: 200,
        title: "Actual Task title revised",
        version: taskChanged.headers.get("etag"),
      })
      const repeated = await Server.App().request(`/task/${taskID}/board`, { headers })
      expect(await repeated.json()).toEqual(changed)
    },
  })
}, 60_000)
