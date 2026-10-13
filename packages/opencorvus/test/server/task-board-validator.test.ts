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
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { persistEstablishedTask } from "../fixture/engine-task"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function taskFixture() {
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
