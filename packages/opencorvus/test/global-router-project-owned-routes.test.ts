import { afterEach, expect, test } from "bun:test"
import { DIRECTORY_REFERENCE_MIME } from "@opencorvus-ai/transport-protocol"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { Identifier } from "@/id/id"
import { ensureMissionSession } from "@/mission/session"
import { Instance } from "@/project/instance"
import { Server } from "@/server/server"
import { Session } from "@/session"
import { persistEstablishedTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "base",
  version: "2026.08.06.1",
  packageDigest: "a".repeat(64),
}

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function pin(input: { kind: "task" | "mission"; itemID: string; directory: string; pinned: boolean }) {
  const query = new URLSearchParams({ directory: input.directory })
  const response = await Server.App().request(
    `/work-ledger/item/${input.kind}/${encodeURIComponent(input.itemID)}/pin?${query.toString()}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: input.pinned }),
    },
  )
  return { status: response.status, body: await response.json() }
}

/**
 * The Work Ledger lists every project, but one row's pin belongs to exactly one
 * project: both branches publish `Session.Event.Updated` / `Event.TaskUpdated`
 * under that project's Bus authority. The route therefore has to run inside the
 * project the row names, which the Overlay already sends as `?directory=`.
 */
test("pins and unpins a Mission row and its Task through the real Work Ledger route", async () => {
  await using project = await memoryProject()
  const missionID = "work-ledger-item-pin"
  const created = Date.now()
  const { missionSessionID, taskID } = await Instance.provide({
    directory: project.path,
    fn: async () => {
      const mission = await ensureMissionSession({
        missionID,
        defaultCwd: project.path,
        productPillar: "code",
        heldExpertSquadIDs: ["base"],
      })
      const root = Session.prepareRootNext({ kind: "root", directory: Instance.directory, title: "Work Ledger item pin" })
      const id = Identifier.ascending("task")
      persistEstablishedTask({
        taskID: id,
        rootSession: root,
        now: created,
        title: "Work Ledger item pin",
        request: "Keep the Work Ledger pin inside its owning Project",
        productPillar: "code",
        source: "mission",
        priority: "normal",
        metadata: { actor: "mission", mission: { id: missionID, session_id: mission.id } },
        projectID: Instance.project.id,
        packageRevision,
        executionCapsuleBinding: await prepareTaskProcessBinding({
          mode: "native",
          taskID: id,
          projectID: Instance.project.id,
          rootDirectory: Instance.directory,
          packageRevisionSHA256: packageRevision.packageDigest,
          timeCreated: created,
        }),
      })
      return { missionSessionID: mission.id, taskID: id }
    },
  })

  expect({
    task: await pin({ kind: "task", itemID: taskID, directory: project.path, pinned: true }),
    mission: await pin({ kind: "mission", itemID: missionSessionID, directory: project.path, pinned: true }),
  }).toEqual({
    task: { status: 200, body: { pinned: true } },
    mission: { status: 200, body: { pinned: true } },
  })

  const listed = await Server.App().request("/work-ledger")
  const list = (await listed.json()) as {
    rows: Array<{ kind: string; sessionID?: string; pinned: boolean; tasks?: Array<{ id: string; pinned: boolean }> }>
  }
  const missionRow = list.rows.find((row) => row.kind === "mission" && row.sessionID === missionSessionID)
  expect({
    listed: listed.status,
    missionPinned: missionRow?.pinned,
    taskPinned: missionRow?.tasks?.find((task) => task.id === taskID)?.pinned,
  }).toEqual({ listed: 200, missionPinned: true, taskPinned: true })

  expect({
    task: await pin({ kind: "task", itemID: taskID, directory: project.path, pinned: false }),
    mission: await pin({ kind: "mission", itemID: missionSessionID, directory: project.path, pinned: false }),
  }).toEqual({
    task: { status: 200, body: { pinned: false } },
    mission: { status: 200, body: { pinned: false } },
  })
})

/**
 * `POST /attachment/directory-reference` writes into the current Project's
 * content-addressed attachment store, exactly like its sibling
 * `POST /attachment`. Both must resolve the Project the Overlay names.
 */
test("stores a directory reference through the real attachment route", async () => {
  await using project = await memoryProject()
  const query = new URLSearchParams({ directory: project.path })
  const response = await Server.App().request(`/attachment/directory-reference?${query.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: project.path }),
  })
  const reference = (await response.json()) as { kind?: string; path?: string; mime?: string; url?: string }
  expect({
    status: response.status,
    kind: reference.kind,
    path: reference.path,
    mime: reference.mime,
    scoped: reference.url?.startsWith("/attachment/"),
  }).toEqual({
    status: 200,
    kind: "folder",
    path: project.path,
    mime: DIRECTORY_REFERENCE_MIME,
    scoped: true,
  })
})
