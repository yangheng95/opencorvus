import { afterEach, expect, test } from "bun:test"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { Bus } from "@/bus"
import { rightSidebarConversationMetadata } from "@/chat/identity"
import { ConfigPaths } from "@/config/paths"
import { EngineTaskTable } from "@/engine/engine.sql"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { File } from "@/file"
import { FileWatcher } from "@/file/watcher"
import { ProtocolStore } from "@/protocol/store"
import { AutomationService } from "@/scheduler/automation-service"
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

test.each(["succeeded", "retry_wait"] as const)(
  "a committed scheduled %s receipt invalidates its exact definition",
  async (outcome) => {
    await using project = await memoryProject("automation-execution-fanout")
    await using peer = await memoryProject("automation-execution-fanout-control")
    const projectID = await Instance.provide({ directory: project.path, fn: () => Instance.project.id })
    const peerID = await Instance.provide({ directory: peer.path, fn: () => Instance.project.id })
    const schedule = {
      recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY",
      prompt: "Verify the committed scheduled execution.",
    }
    const primary = await AutomationService.create({
      ...schedule, name: "Execution under review", target: { scope: "project", projectIds: [projectID] },
    })
    const control = await AutomationService.create({
      ...schedule, name: "Other project execution", target: { scope: "project", projectIds: [peerID] },
    })
    await Database.awaitEffectIdle(5_000)
    using wake = AutomationService.TestHooks.installWakeExecutor(async (input) => ({
      sessionID: input.sessionID!,
      messageID: input.messageID!,
      activation: Promise.resolve({ owner: new AbortController().signal }),
      completion: Promise.resolve(outcome === "succeeded"
        ? { ok: true as const }
        : { ok: false as const, error: "Retryable review result" }),
    }))
    const { next, close } = await openLedgerEvents()
    const route = `/global/automations/${primary.id}`
    try {
      await next("work-ledger.connected")
      const response = await Server.App().request(`${route}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestID: `execution-fanout-${outcome}` }),
      })
      expect(response.status).toBe(200)
      const accepted = await response.json()
      expect(accepted).toMatchObject([{ automationId: primary.id, targetProjectId: projectID, outcome }])
      expect(await next("work-ledger.changed", "automation.execution.changed")).toEqual({
        type: "work-ledger.changed", sourceType: "automation.execution.changed", automationID: primary.id, sequence: 0,
      })
      const history = await Server.App().request(`${route}/runs`)
      expect(await history.json()).toEqual(accepted)
      const list = await Server.App().request("/global/automations")
      const projected = (await list.json()) as Array<{ id: string }>
      expect(projected.find(({ id }) => id === primary.id)).toMatchObject({
        revisionId: primary.revisionId, target: { scope: "project", projectIds: [projectID] }, lastRun: accepted[0].startedAt,
      })
      expect(projected.find(({ id }) => id === control.id)).toMatchObject({
        revisionId: control.revisionId, target: { scope: "project", projectIds: [peerID] }, lastRun: null,
      })
    } finally {
      await close()
    }
  },
  30_000,
)

test("scheduled conversation titles re-read the same bound identity after sidebar and root renames", async () => {
  await using sidebarProject = await memoryProject("scheduled-sidebar-title")
  await using rootProject = await memoryProject("scheduled-root-title")
  const sidebar = await Instance.provide({
    directory: sidebarProject.path,
    fn: () => Session.create({ kind: "assistant", title: "Sidebar original", metadata: rightSidebarConversationMetadata("chat") }),
  })
  const root = await Instance.provide({
    directory: rootProject.path,
    fn: () => Session.create({ kind: "root", title: "Root original" }),
  })
  async function createPlan(session: Session.Info) {
    const result = await Server.App().request("/global/automations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: `Future plan for ${session.title}`,
        target: { scope: "session", sessionId: session.id },
        recurrence: "DTSTART:20990101T000000Z\nRRULE:FREQ=DAILY;COUNT=2",
        prompt: "Verify the existing conversation binding.",
      }),
    })
    expect(result.status).toBe(201)
    return (await result.json()) as { id: string; revisionId: string; nextRun: number }
  }

  const sidebarPlan = await createPlan(sidebar)
  const rootPlan = await createPlan(root)
  await Database.awaitEffectIdle(5_000)
  const { next, close } = await openLedgerEvents()
  try {
    await next("work-ledger.connected")
    for (const [session, route, title] of [
      [sidebar, `/coding/chat/session/${sidebar.id}`, "Sidebar current title"],
      [root, `/session/${root.id}`, "Root current title"],
    ] as const) {
      const renamed = await Server.App().request(`${route}?${new URLSearchParams({ directory: session.directory })}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      })
      expect(renamed.status).toBe(200)
      expect(await next("work-ledger.changed", "session.updated")).toMatchObject({ sessionID: session.id, titleChanged: true })
    }
    const response = await Server.App().request("/global/automations")
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        ...sidebarPlan,
        target: { scope: "session", sessionId: sidebar.id },
        targetSession: { id: sidebar.id, title: "Sidebar current title", directory: sidebar.directory },
      }),
      expect.objectContaining({
        ...rootPlan,
        target: { scope: "session", sessionId: root.id },
        targetSession: { id: root.id, title: "Root current title", directory: root.directory },
      }),
    ]))
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
  for (const archived of [true, false, true, false]) {
    const expected = archived ? [target, retained] : [retained]
    const { next, close } = await openLedgerEvents()
    try {
      expect((await next("work-ledger.connected")).type).toBe("work-ledger.connected")
      await setArchived(target, archived)
      expect(await next("work-ledger.changed", "session.updated")).toMatchObject({
        sessionID: target.sessionID,
        archiveUpdated: true,
      })
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

test("conversation archive and restore announce the exact work record and its current search membership", async () => {
  await using chatProject = await memoryProject("chat-archive-search")
  await using workProject = await memoryProject("work-archive-search")
  for (const [experience, project] of [["chat", chatProject], ["work", workProject]] as const) {
    const title = `Original ${experience} handoff`
    const session = await Instance.provide({
      directory: project.path,
      fn: () => Session.create({ kind: "assistant", title, metadata: rightSidebarConversationMetadata(experience) }),
    })
    await Database.awaitEffectIdle(5_000)
    const { next, close } = await openLedgerEvents()
    try {
      await next("work-ledger.connected")
      for (const archived of [true, false]) {
        const archiveQuery = new URLSearchParams({ directory: project.path })
        const change = await Server.App().request(`/coding/${experience}/session/${session.id}/archive?${archiveQuery}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ archived }),
        })
        expect(change.status).toBe(200)
        const receipt = (await change.json() as { session: Session.Info }).session
        expect({ id: receipt.id, projectID: receipt.projectID, archived: receipt.time.archived ?? null }).toEqual({
          id: session.id,
          projectID: session.projectID,
          archived: archived ? expect.any(Number) : null,
        })
        expect(await next("work-ledger.changed", "session.updated")).toMatchObject({
          sessionID: session.id,
          conversationExperience: experience,
          archiveUpdated: true,
          ...(archived ? { sessionArchived: true } : {}),
          sequence: receipt.time.updated,
        })
        const search = new URLSearchParams({ search: title })
        const path = archived ? "/work-ledger/archive" : "/work-ledger"
        const response = await Server.App().request(`${path}?${search}`)
        expect(response.status).toBe(200)
        expect(await response.json()).toMatchObject({
          rows: [{ kind: "chat", sessionID: session.id, experience, title, directory: project.path }],
        })
      }
    } finally {
      await close()
    }
  }
}, 30_000)

test("the public stream distinguishes ordinary renames from renamed archive members", async () => {
  await using project = await memoryProject("archive-member-title-fanout")
  const { active, retained } = await Instance.provide({
    directory: project.path,
    fn: async () => {
      const create = (title: string) => Session.create({
        kind: "assistant", title, metadata: rightSidebarConversationMetadata("chat"),
      })
      const active = await create("Active review")
      const retained = await create("Archived review")
      await Session.setArchived({ sessionID: retained.id, time: Date.now() })
      return { active, retained }
    },
  })
  await Database.awaitEffectIdle(5_000)
  const { next, close } = await openLedgerEvents()
  async function rename(sessionID: string, title: string) {
    const query = new URLSearchParams({ directory: project.path })
    const response = await Server.App().request(`/coding/chat/session/${sessionID}?${query}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title }),
    })
    expect(response.status).toBe(200)
    return (await response.json() as { session: Session.Info }).session
  }
  try {
    await next("work-ledger.connected")
    const activeReceipt = await rename(active.id, "Revised active review")
    expect(activeReceipt.title).toBe("Revised active review")
    expect(await next("work-ledger.changed", "session.updated")).toEqual({
      type: "work-ledger.changed", sourceType: "session.updated", sessionID: active.id,
      conversationExperience: "chat", titleChanged: true, sequence: activeReceipt.time.updated,
    })
    const retainedReceipt = await rename(retained.id, "Revised archived review")
    expect(await next("work-ledger.changed", "session.updated")).toEqual({
      type: "work-ledger.changed", sourceType: "session.updated", sessionID: retained.id,
      conversationExperience: "chat", titleChanged: true, sessionArchived: true, sequence: retainedReceipt.time.updated,
    })
    const search = new URLSearchParams({ search: "Revised" })
    const archive = await Server.App().request(`/work-ledger/archive?${search}`)
    expect(await archive.json()).toMatchObject({
      rows: [{ id: retained.id, title: retainedReceipt.title, directory: project.path, archived: retainedReceipt.time.archived }],
      nextCursor: null,
    })
  } finally {
    await close()
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

test("watched worktree changes invalidate Git metadata for each exact checkout", async () => {
  await using first = await memoryProject("ledger-watched-first")
  await using second = await memoryProject("ledger-watched-second")
  const { next, close } = await openLedgerEvents()
  try {
    expect((await next("work-ledger.connected")).type).toBe("work-ledger.connected")
    for (const project of [first, second]) {
      const file = path.join(project.path, ".opencorvus-test-project-identity")
      await writeFile(file, "Externally edited worktree\n")
      await Instance.provide({ directory: project.path, fn: async () => {
        await Bus.publish(FileWatcher.Event.Updated, { file, event: "change" })
      } })
      expect(await next("work-ledger.changed", FileWatcher.Event.Updated.type)).toEqual({
        type: "work-ledger.changed",
        sourceType: FileWatcher.Event.Updated.type,
        directory: project.path,
        sequence: 0,
      })
      const vcs = await Server.App().request("/vcs", { headers: { "x-opencorvus-directory": project.path } })
      expect({ status: vcs.status, body: await vcs.json() }).toMatchObject({
        status: 200,
        body: { initialized: true, dirty: true, modified: 1 },
      })
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
        archiveUpdated: true,
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

test("a passive Git read observes external branch switches through the default HEAD watcher", async () => {
  await using project = await memoryProject("ledger-passive-head-watch")
  const branch = "external-observer"
  const options = { cwd: project.path, timeoutProfile: "default" } as const
  expect((await hostGit(["branch", branch], options)).exitCode).toBe(0)
  const { next, close } = await openLedgerEvents()
  try {
    expect((await next("work-ledger.connected")).type).toBe("work-ledger.connected")
    const read = () => Server.App().request("/vcs", { headers: { "x-opencorvus-directory": project.path } })
    const initial = await read()
    const before = await initial.json() as { branch: string; commit: string }
    expect({ status: initial.status, ...before }).toMatchObject({
      status: 200, initialized: true, clean: true, commit: expect.any(String),
    })
    expect((await hostGit(["switch", branch], options)).exitCode).toBe(0)
    expect(await next("work-ledger.changed", "vcs.branch.updated")).toEqual({
      type: "work-ledger.changed",
      sourceType: "vcs.branch.updated",
      directory: project.path,
      sequence: 0,
    })
    const after = await read()
    expect({ status: after.status, body: await after.json() }).toMatchObject({
      status: 200,
      body: { branch, commit: before.commit, clean: true },
    })
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
