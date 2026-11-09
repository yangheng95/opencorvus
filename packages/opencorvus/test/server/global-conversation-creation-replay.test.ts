import { afterEach, expect, test } from "bun:test"
import { GlobalCreationAllocation } from "../../src/project/global-creation-allocation"
import { Instance } from "../../src/project/instance"
import { Server } from "../../src/server/server"
import type { Session } from "../../src/session"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

type Experience = "chat" | "work"

function create(experience: Experience, requestID: string, model?: string) {
  return Server.App().request(`/global/${experience}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ requestID, ...(model ? { model } : {}) }),
  })
}

async function accepted(experience: Experience, requestID: string): Promise<Session.Info> {
  const response = await create(experience, requestID)
  expect(response.status).toBe(201)
  return ((await response.json()) as { session: Session.Info }).session
}

test("parallel global Chat requests join the same accepted project and session", async () => {
  await using project = await memoryProject()
  const [first, second] = await Promise.all([accepted("chat", "parallel-global-chat"), accepted("chat", "parallel-global-chat")])
  expect(second).toEqual(first)
  const allocation = GlobalCreationAllocation.find({
    kind: "global_chat_create",
    requestID: "parallel-global-chat",
    requestContract: { protocol: "global-conversation-create-v1", experience: "chat", model: null },
  })!
  expect(GlobalCreationAllocation.acceptedTarget(allocation)).toEqual({
    projectID: first.projectID, targetID: first.id, acceptedAt: first.time.created,
  })
}, 60_000)

test("global Chat and Work retain independent experience identities and explicit input conflicts", async () => {
  await using project = await memoryProject()
  const [chat, work] = await Promise.all([accepted("chat", "scoped-global"), accepted("work", "scoped-global")])
  expect(new Set([chat.projectID, work.projectID]).size).toBe(2)
  expect((await accepted("work", "scoped-global")).id).toBe(work.id)
  const conflict = await create("work", "scoped-global", "isolated/missing-catalog-model")
  expect(conflict.status).toBe(409)
  expect(await conflict.json()).toMatchObject({
    name: "GlobalCreationAllocationConflictError", data: { kind: "global_work_create", requestID: "scoped-global" },
  })
}, 60_000)

test("global Work joins a previously materialized project and its frozen initial config", async () => {
  await using project = await memoryProject()
  const initialConfigOverlay = { prompt_profile: { active: "dynamic" } }
  const allocation = GlobalCreationAllocation.reserve({
    kind: "global_work_create",
    requestID: "prepared-global-work",
    requestContract: { protocol: "global-conversation-create-v1", experience: "work", model: null },
    resolutionSeed: { initialConfigOverlay },
  })
  const carrying = await GlobalCreationAllocation.materializeProject(allocation)
  const work = await accepted("work", "prepared-global-work")
  expect({ projectID: work.projectID, directory: work.directory, overlay: work.metadata?.configOverlay }).toEqual({
    projectID: carrying.project.id, directory: carrying.directory, overlay: initialConfigOverlay,
  })
}, 60_000)
