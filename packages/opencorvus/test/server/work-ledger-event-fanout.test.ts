import { afterEach, expect, test } from "bun:test"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { ConfigPaths } from "@/config/paths"
import { EngineTaskTable } from "@/engine/engine.sql"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { File } from "@/file"
import { ProtocolStore } from "@/protocol/store"
import { Server } from "@/server/server"
import { Session } from "@/session"
import { Database, eq } from "@/storage/db"
import { EngineService } from "@/task-api"
import { hostGit } from "@/util/git"
import { WorkLedgerArchiveList, WorkLedgerEvent } from "@opencorvus-ai/transport-protocol"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

async function openLedgerEvents() {
  const abort = new AbortController()
  const response = await Server.App().request("/work-ledger/events", { signal: abort.signal })
  expect(response.status).toBe(200)
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffered = ""
  const pending: Array<ReturnType<typeof WorkLedgerEvent.parse>> = []
  async function next(type: string, sourceType?: string, taskID?: string) {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Ledger event delivery timed out: ${type} ${sourceType ?? ""}`)), 5_000)
    })
    try {
      while (true) {
        const frames = buffered.split("\n\n")
        buffered = frames.pop() ?? ""
        for (const frame of frames) {
          const data = frame
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n")
          if (data) pending.push(WorkLedgerEvent.parse(JSON.parse(data)))
        }
        const index = pending.findIndex(
          (event) =>
            event.type === type &&
            (sourceType === undefined || event.sourceType === sourceType) &&
            (taskID === undefined || ("taskID" in event && event.taskID === taskID)),
        )
        if (index >= 0) return pending.splice(index, 1)[0]!
        const chunk = await Promise.race([reader.read(), timeout])
        if (chunk.done) throw new Error("Ledger stream closed before expected event")
        buffered += decoder.decode(chunk.value, { stream: true })
      }
    } finally {
      clearTimeout(timer)
    }
  }
  return {
    next,
    async close() {
      abort.abort()
      await reader.cancel()
    },
  }
}

test("committed scheduled definition changes invalidate the public list after each revision", async () => {
  await using project = await memoryProject("automation-definition-fanout")
  await using control = await memoryProject("automation-definition-fanout-control")
  const projectID = await Instance.provide({ directory: project.path, fn: () => Instance.project.id })
  const controlID = await Instance.provide({ directory: control.path, fn: () => Instance.project.id })
  async function create(name: string, projectID: string) {
    const response = await Server.App().request("/global/automations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        target: { scope: "project", projectIds: [projectID] },
        recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY;COUNT=2",
        prompt: "Verify the future scheduled definition projection.",
      }),
    })
    expect(response.status).toBe(201)
    return (await response.json()) as { id: string; revisionId: string }
  }
  async function list() {
    const response = await Server.App().request("/global/automations")
    expect(response.status).toBe(200)
    return (await response.json()) as Array<{ id: string; revisionId: string; status: string }>
  }

  const unaffected = await create("Other project", controlID)
  await Database.awaitEffectIdle(5_000)
  const { next, close } = await openLedgerEvents()
  async function expectChange() {
    expect(await next("work-ledger.changed", "automation.definition.changed")).toEqual({
      type: "work-ledger.changed",
      sourceType: "automation.definition.changed",
      sequence: 0,
    })
  }
  try {
    await next("work-ledger.connected")
    const added = await create("Future project handoff", projectID)
    await expectChange()
    expect((await list()).find(({ id }) => id === added.id)).toMatchObject({ ...added, status: "active" })

    const route = `/global/automations/${added.id}`
    const paused = await Server.App().request(route, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "paused", expectedRevisionId: added.revisionId }),
    })
    expect(paused.status).toBe(200)
    const current = (await paused.json()) as { revisionId: string }
    await expectChange()
    expect((await list()).find(({ id }) => id === added.id)).toMatchObject({
      id: added.id, revisionId: current.revisionId, status: "paused",
    })

    const query = new URLSearchParams({ expectedRevisionId: current.revisionId })
    const deleted = await Server.App().request(`${route}?${query}`, { method: "DELETE" })
    expect(deleted.status).toBe(200)
    expect(await deleted.json()).toMatchObject({ id: added.id, name: "Future project handoff" })
    await expectChange()
    expect(await list()).toMatchObject([{ ...unaffected, status: "active", target: { scope: "project", projectIds: [controlID] } }])
  } finally {
    await close()
  }
}, 30_000)

test("Mission archive and restore invalidate the public archive query for the exact original Session", async () => {
  await using project = await memoryProject("archive-notification")
  await using control = await memoryProject("archive-notification-control")
  const search = "Handoff summary"
  async function createDraft(directory: string) {
    const response = await Server.App().request("/mission/draft", {
      method: "POST",
      headers: { "x-opencorvus-directory": directory, "content-type": "application/json" },
      body: JSON.stringify({ title: search, request: "Review the handoff.", productPillar: "work", expertSquadIDs: ["base"] }),
    })
    expect(response.status).toBe(200)
    return (await response.json()) as { missionID: string; sessionID: string; directory: string }
  }
  type Draft = Awaited<ReturnType<typeof createDraft>>
  async function setArchived(draft: Draft, archived: boolean) {
    const response = await Server.App().request(`/mission/${draft.missionID}/archive`, {
      method: "PATCH",
      headers: { "x-opencorvus-directory": draft.directory, "content-type": "application/json" },
      body: JSON.stringify(archived ? { archived, surface: "api", reason: "Archive the isolated draft" } : { archived }),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ missionID: draft.missionID, sessionID: draft.sessionID, directory: draft.directory })
  }

  const target = await createDraft(project.path)
  const retained = await createDraft(control.path)
  await setArchived(retained, true)
  for (const [archived, expected] of [[true, [target, retained]], [false, [retained]]] as const) {
    const { next, close } = await openLedgerEvents()
    try {
      expect((await next("work-ledger.connected")).type).toBe("work-ledger.connected")
      await setArchived(target, archived)
      expect(await next("work-ledger.changed", "session.updated")).toMatchObject({ sessionID: target.sessionID })
      const response = await Server.App().request(`/work-ledger/archive?${new URLSearchParams({ search })}`)
      expect(response.status).toBe(200)
      const { rows } = WorkLedgerArchiveList.parse(await response.json())
      expect(rows.map((row) => row.sessionID).sort()).toEqual(expected.map((draft) => draft.sessionID).sort())
      for (const draft of expected) {
        expect(rows.find((row) => row.sessionID === draft.sessionID)).toMatchObject({
          kind: "mission", missionID: draft.missionID, directory: draft.directory, title: search,
        })
      }
    } finally {
      await close()
    }
  }
}, 30_000)

test("committed file writes announce their real path and resource on the public stream in each project", async () => {
  await using first = await memoryProject("ledger-file-first")
  await using second = await memoryProject("ledger-file-second")
  const { next, close } = await openLedgerEvents()
  try {
    expect((await next("work-ledger.connected")).type).toBe("work-ledger.connected")
    const file = "notes/checklist.txt"
    for (const [index, project] of [first, second].entries()) {
      const full = path.join(project.path, file)
      await mkdir(path.dirname(full), { recursive: true })
      await writeFile(full, "Original checklist\n")
      const headers = { "x-opencorvus-directory": project.path, "content-type": "application/json" }
      const read = await Server.App().request(`/file/content?${new URLSearchParams({ path: file })}`, { headers })
      expect(read.status).toBe(200)
      const original = File.Content.parse(await read.json())
      const content = `Committed checklist for project ${index + 1}\n`
      const saved = await Server.App().request("/file/content", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ path: `./${file}`, content, expectedRevision: original.revision }),
      })
      expect(saved.status).toBe(200)
      const snapshot = File.Content.parse(await saved.json())
      expect(snapshot).toMatchObject({ content, resourceID: original.resourceID })
      expect(await next("work-ledger.file-changed", "file.edited")).toEqual({
        type: "work-ledger.file-changed",
        sourceType: "file.edited",
        directory: project.path,
        path: file,
        resourceID: snapshot.resourceID,
        sequence: 0,
      })
      expect(await readFile(full, "utf8")).toBe(content)
    }
  } finally {
    await close()
  }
}, 30_000)

test("created directory members announce their exact parent path on the public stream in each project", async () => {
  await using first = await memoryProject("ledger-create-first")
  await using second = await memoryProject("ledger-create-second")
  const { next, close } = await openLedgerEvents()
  try {
    expect((await next("work-ledger.connected")).type).toBe("work-ledger.connected")
    for (const [index, project] of [first, second].entries()) {
      const name = `handoff-${index + 1}.txt`
      const file = `notes/${name}`
      const content = `Project handoff ${index + 1}\n`
      await mkdir(path.join(project.path, "notes"))
      const headers = { "x-opencorvus-directory": project.path, "content-type": "application/json" }
      const app = Server.App()
      const created = await app.request("/file/item", {
        method: "POST",
        headers,
        body: JSON.stringify({ path: file, type: "file", content }),
      })
      expect(created.status).toBe(200)
      expect(File.Node.parse(await created.json())).toMatchObject({ name, type: "file" })
      expect(await next("work-ledger.file-changed", "file.edited")).toEqual({
        type: "work-ledger.file-changed",
        sourceType: "file.edited",
        directory: project.path,
        path: file,
        sequence: 0,
      })
      const list = await app.request("/file?path=notes", { headers })
      expect(list.status).toBe(200)
      expect(await list.json()).toMatchObject([{ name, type: "file", directoryTarget: false }])
      expect(await readFile(path.join(project.path, file), "utf8")).toBe(content)
    }
  } finally {
    await close()
  }
}, 30_000)

test("an accepted project configuration change announces its project on the public stream", async () => {
  await using first = await memoryProject("ledger-config-first")
  await using second = await memoryProject("ledger-config-second")
  for (const project of [first, second]) {
    const config = ConfigPaths.projectFile(project.path)
    await mkdir(path.dirname(config), { recursive: true })
    await writeFile(config, JSON.stringify({ permission_mode: "full_access" }))
  }
  const { next, close } = await openLedgerEvents()
  try {
    expect((await next("work-ledger.connected")).type).toBe("work-ledger.connected")
    const app = Server.App()
    const headers = { "x-opencorvus-directory": first.path, "content-type": "application/json" }
    const saved = await app.request("/config", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ permission_mode: "ask" }),
    })
    expect(saved.status).toBe(200)
    expect(await saved.json()).toMatchObject({ permission_mode: "ask" })
    expect(await next("work-ledger.changed", "project.config.changed")).toEqual({
      type: "work-ledger.changed",
      sourceType: "project.config.changed",
      directory: first.path,
      sequence: 0,
    })
    const firstRead = await app.request("/config", { headers })
    const secondRead = await app.request("/config", { headers: { "x-opencorvus-directory": second.path } })
    expect(firstRead.status).toBe(200)
    expect(await firstRead.json()).toMatchObject({ permission_mode: "ask" })
    expect(secondRead.status).toBe(200)
    expect(await secondRead.json()).toMatchObject({ permission_mode: "full_access" })
    expect(JSON.parse(await readFile(ConfigPaths.projectFile(first.path), "utf8"))).toMatchObject({ permission_mode: "ask" })
  } finally {
    await close()
  }
}, 30_000)

test("global ledger stream fans out durable Task events to every affected projection across projects", async () => {
  await using first = await memoryProject("ledger-first")
  await using second = await memoryProject("ledger-second")
  const { next, close } = await openLedgerEvents()
  try {
    expect((await next("work-ledger.connected")).type).toBe("work-ledger.connected")
    const affected: Array<{ project: typeof first; taskID: string }> = []
    for (const [index, type] of [
      "task.completed",
      "task.failed",
      "interaction.requested",
      "task.cancelled",
    ].entries()) {
      const project = index % 2 === 0 ? first : second
      const event = await Instance.provide({
        directory: project.path,
        fn: async () => {
          const root = await Session.create({ kind: "root", title: type })
          const taskID = Identifier.ascending("task")
          Database.transaction((db) => {
            db
              .insert(EngineTaskTable)
              .values({
                id: taskID,
                project_id: Instance.project.id,
                session_id: root.id,
                source: "test",
                product_pillar: "code",
                title: type,
                request: "Verify durable notification fan-out",
                time_created: Date.now(),
              })
              .run()
            appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now: Date.now(), source: "test.work-ledger-fanout" })
          })
          return ProtocolStore.appendEvent({
            kind: "event",
            type,
            aggregate: "task",
            aggregate_id: taskID,
            source: "test.work-ledger-fanout",
            payload: { execution_epoch: 1 },
          })
        },
      })
      await Database.awaitEffectIdle(5_000)
      affected.push({ project, taskID: event.taskID! })
      if (type !== "task.cancelled") {
        expect(await next("mailbox.changed", type, event.taskID)).toEqual({
          type: "mailbox.changed",
          sourceType: type,
          messageID: event.id,
          taskID: event.taskID,
          sequence: event.sequence,
        })
      }
      expect(await next("work-ledger.changed", type, event.taskID)).toEqual({
        type: "work-ledger.changed",
        sourceType: type,
        taskID: event.taskID,
        sequence: event.sequence,
      })
      expect(ProtocolStore.requireEvent(event.id)).toMatchObject({
        type,
        taskID: event.taskID,
        sequence: event.sequence,
      })
    }
    const renamed = affected[0]!
    const pinned = affected[1]!
    await Promise.all([
      Instance.provide({ directory: renamed.project.path, fn: () => EngineService.updateTaskTitle(renamed.taskID, "Restorable ledger task") }),
      Instance.provide({ directory: pinned.project.path, fn: () => EngineService.setTaskPinned(pinned.taskID, true) }),
    ])
    for (const target of [renamed, pinned]) {
      expect(await next("work-ledger.changed", "task.updated", target.taskID)).toEqual({
        type: "work-ledger.changed",
        sourceType: "task.updated",
        taskID: target.taskID,
        directory: target.project.path,
        sequence: 0,
      })
    }
    expect(Database.use(db => db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, renamed.taskID)).get())?.title)
      .toBe("Restorable ledger task")
    expect(Database.use(db => db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, pinned.taskID)).get())?.time_pinned)
      .toBeGreaterThan(0)
    for (const archived of [true, false] as const) {
      await Instance.provide({ directory: renamed.project.path, fn: () => EngineService.setTaskArchived(renamed.taskID, archived) })
      expect(await next("work-ledger.changed", "task.updated", renamed.taskID)).toEqual({
        type: "work-ledger.changed",
        sourceType: "task.updated",
        taskID: renamed.taskID,
        directory: renamed.project.path,
        sequence: 0,
      })
      const record = Database.use(db => db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, renamed.taskID)).get())!
      if (archived) expect(record.time_archived).toBeGreaterThan(0)
      else expect(record.time_archived).toBeNull()
    }
  } finally {
    await close()
  }
}, 30_000)

test("accepted branch switches announce their exact workspaces on the public stream", async () => {
  await using first = await memoryProject("ledger-switch-first")
  await using second = await memoryProject("ledger-switch-second")
  const { next, close } = await openLedgerEvents()
  try {
    expect((await next("work-ledger.connected")).type).toBe("work-ledger.connected")
    for (const project of [first, second]) {
      const branch = "review-checkout"
      const creation = await hostGit(["branch", branch], { cwd: project.path, timeoutProfile: "default" })
      expect(creation.exitCode).toBe(0)
      const response = await Server.App().request("/vcs/branch", {
        method: "POST",
        headers: { "content-type": "application/json", "x-opencorvus-directory": project.path },
        body: JSON.stringify({ branch }),
      })
      expect({ status: response.status, body: await response.json() }).toMatchObject({ status: 200, body: { branch } })
      expect(await next("work-ledger.changed", "vcs.branch.updated")).toEqual({
        type: "work-ledger.changed",
        sourceType: "vcs.branch.updated",
        directory: project.path,
        sequence: 0,
      })
    }
  } finally {
    await close()
  }
}, 30_000)

test("a saved global configuration announces settlement on the public stream", async () => {
  await using project = await memoryProject("ledger-config-global-control")
  const configPath = ConfigPaths.projectFile(project.path)
  await mkdir(path.dirname(configPath), { recursive: true })
  await writeFile(configPath, JSON.stringify({ permission_mode: "full_access" }))
  const { next, close } = await openLedgerEvents()
  try {
    expect((await next("work-ledger.connected")).type).toBe("work-ledger.connected")
    const app = Server.App()
    const saved = await app.request("/global/config", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ permission_mode: "ask" }),
    })
    expect(saved.status).toBe(200)
    expect(await saved.json()).toMatchObject({ permission_mode: "ask" })
    expect(await next("work-ledger.changed", "global.disposed")).toEqual({
      type: "work-ledger.changed",
      sourceType: "global.disposed",
      sequence: 0,
    })
    const global = await app.request("/global/config")
    expect(global.status).toBe(200)
    expect(await global.json()).toMatchObject({ permission_mode: "ask" })
    const scoped = await app.request("/config", { headers: { "x-opencorvus-directory": project.path } })
    expect(scoped.status).toBe(200)
    expect(await scoped.json()).toMatchObject({ permission_mode: "full_access" })
  } finally {
    await close()
  }
}, 30_000)
