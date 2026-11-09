import { afterEach, expect, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { Server } from "../../src/server/server"
import { Session } from "../../src/session"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

type Experience = "chat" | "work"

function request(directory: string, path: string, method: string, body?: unknown) {
  return Server.App().request(path, {
    method,
    headers: { "x-opencorvus-directory": directory, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

async function accepted(directory: string, experience: Experience, requestID: string): Promise<Session.Info> {
  const response = await request(directory, `/coding/${experience}/session`, "POST", { requestID })
  expect(response.status).toBe(201)
  return ((await response.json()) as { session: Session.Info }).session
}

test("parallel project Chat creation converges to the one accepted session in the canonical list", async () => {
  await using project = await memoryProject()
  const [first, replay] = await Promise.all([
    accepted(project.path, "chat", "parallel-chat"),
    accepted(project.path, "chat", "parallel-chat"),
  ])
  expect(replay).toEqual(first)
  const response = await request(project.path, "/coding/chat/sessions", "GET")
  expect(response.status).toBe(200)
  expect(((await response.json()) as { sessions: Session.Info[] }).sessions.map((item) => item.id)).toEqual([first.id])
}, 60_000)

test("project and experience scope the same request string to independent conversation identities", async () => {
  await using a = await memoryProject()
  await using b = await memoryProject()
  const [chat, work, other] = await Promise.all([
    accepted(a.path, "chat", "same-intent"),
    accepted(a.path, "work", "same-intent"),
    accepted(b.path, "chat", "same-intent"),
  ])
  expect(new Set([chat.id, work.id, other.id]).size).toBe(3)
  expect(work.projectID).toBe(chat.projectID)
  expect([chat.directory, work.directory, other.directory]).toEqual([a.path, a.path, b.path])
  expect((await accepted(a.path, "work", "same-intent")).id).toBe(work.id)
  expect((await accepted(b.path, "chat", "same-intent")).id).toBe(other.id)
}, 60_000)

test("changing the explicit model on an accepted creation returns the stable identity conflict", async () => {
  await using project = await memoryProject()
  const first = await accepted(project.path, "work", "bound-model")
  const response = await request(project.path, "/coding/work/session", "POST", {
    requestID: "bound-model",
    model: "isolated-catalog/missing-model",
  })
  expect(response.status).toBe(409)
  expect(await response.json()).toMatchObject({
    name: "ProjectConversationCreationConflictError",
    data: { sessionID: first.id, reason: "identity" },
  })
}, 60_000)
