import { afterEach, expect, test } from "bun:test"
import Ajv2020 from "ajv/dist/2020.js"
import { Hono } from "hono"
import fs from "node:fs/promises"
import path from "node:path"
import { Instance, runOutsideInstanceContext } from "../../src/project/instance"
import { Server } from "../../src/server/server"
import { ProjectRoutes } from "../../src/server/routes/project"
import { serverErrorResponse } from "../../src/server/error-handler"
import { Session } from "../../src/session"
import { ensureMissionSession } from "../../src/mission/session"
import { SessionPromptState } from "../../src/session/prompt/state"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

type Document = Awaited<ReturnType<typeof Server.openapi>>

async function request(directory: string, method: string, route: string, body?: unknown) {
  const response = await runOutsideInstanceContext(() =>
    Server.App().request(route, {
      method,
      headers: { "x-opencorvus-directory": directory, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  )
  return { status: response.status, body: await response.json() }
}

function conforms(document: Document, actual: { status: number; body: unknown }) {
  const schema =
    document.paths?.["/project/current/promote-anonymous"]?.post?.responses?.[String(actual.status)]?.content?.[
      "application/json"
    ]?.schema
  if (!schema) throw new Error(`Promotion did not publish HTTP ${actual.status}`)
  const validate = new Ajv2020({ strict: false, allErrors: true, validateFormats: false }).compile({
    ...schema,
    components: document.components,
  })
  expect({ valid: validate(actual.body), errors: validate.errors }).toEqual({ valid: true, errors: null })
}

async function documentFor(directory: string) {
  const actual = await request(directory, "GET", "/doc")
  expect(actual.status).toBe(200)
  return actual.body as Document
}

async function anonymousProject(directory: string) {
  const actual = await request(directory, "POST", "/global/projects/anonymous")
  expect(actual.status).toBe(201)
  expect(typeof actual.body.directory).toBe("string")
  expect(typeof actual.body.project.id).toBe("string")
  return actual.body as { directory: string; project: { id: string } }
}

test("real promotion input errors conform and preserve both original directories", async () => {
  await using parent = await memoryProject("promotion-error-inputs")
  const anonymous = await anonymousProject(parent.path)
  const content = "anonymous original\r\n资料保持\r\n"
  await fs.writeFile(path.join(anonymous.directory, "identity-note.txt"), content)
  await fs.mkdir(path.join(parent.path, "existing"))
  await fs.writeFile(path.join(parent.path, "existing", "kept.txt"), "existing original\n")
  const document = await documentFor(anonymous.directory)
  for (const entry of [
    { directory: anonymous.directory, parent: parent.path, name: ".", reason: "invalid_name" },
    {
      directory: anonymous.directory,
      parent: path.join(parent.path, "missing"),
      name: "named",
      reason: "invalid_destination",
    },
    { directory: anonymous.directory, parent: parent.path, name: "existing", reason: "destination_exists" },
    { directory: anonymous.directory, parent: anonymous.directory, name: "nested", reason: "path_overlap" },
    { directory: parent.path, parent: parent.path, name: "named", reason: "not_anonymous" },
  ]) {
    const actual = await request(entry.directory, "POST", "/project/current/promote-anonymous", {
      destinationParent: entry.parent,
      name: entry.name,
    })
    expect(actual).toMatchObject({
      status: 400,
      body: {
        name: "AnonymousProjectPromotionError",
        data: { sourceDirectory: entry.directory, reason: entry.reason },
      },
    })
    expect(typeof actual.body.data.message).toBe("string")
    conforms(document, actual)
    expect(await fs.readFile(path.join(anonymous.directory, "identity-note.txt"), "utf8")).toBe(content)
    expect(await fs.readFile(path.join(parent.path, "existing", "kept.txt"), "utf8")).toBe("existing original\n")
    const current = await request(anonymous.directory, "GET", "/project/current")
    expect(current).toMatchObject({ status: 200, body: { id: anonymous.project.id, worktree: anonymous.directory } })
  }
  const malformed = await request(anonymous.directory, "POST", "/project/current/promote-anonymous", { name: "" })
  expect(malformed).toMatchObject({ status: 400, body: { success: false } })
  expect(typeof malformed.body.data.message).toBe("string")
  expect(Array.isArray(malformed.body.error)).toBe(true)
  conforms(document, malformed)
}, 60_000)

test("real promotion publishes the original project identity and source bytes", async () => {
  await using parent = await memoryProject("promotion-success-response")
  const anonymous = await anonymousProject(parent.path)
  const document = await documentFor(anonymous.directory)
  const content = "published original\r\n原始资料\r\n"
  await fs.writeFile(path.join(anonymous.directory, "identity-note.txt"), content)
  const directory = path.join(parent.path, "named project")
  const actual = await request(anonymous.directory, "POST", "/project/current/promote-anonymous", {
    destinationParent: parent.path,
    name: "named project",
  })
  expect(actual).toMatchObject({
    status: 200,
    body: {
      sourceDirectory: anonymous.directory,
      directory,
      project: { id: anonymous.project.id, worktree: directory },
    },
  })
  expect(typeof actual.body.cleanupPending).toBe("boolean")
  conforms(document, actual)
  expect(await fs.readFile(path.join(directory, "identity-note.txt"), "utf8")).toBe(content)
  const current = await request(directory, "GET", "/project/current")
  expect(current).toMatchObject({ status: 200, body: { id: anonymous.project.id, worktree: directory } })
}, 60_000)

for (const kind of ["assistant", "mission", "root"] as const) {
  test(`promotion reports the real active ${kind} controller through its published conflict`, async () => {
    await using parent = await memoryProject(`promotion-${kind}-controller`)
    const anonymous = await anonymousProject(parent.path)
    const document = await documentFor(anonymous.directory)
    await Instance.provide({
      directory: anonymous.directory,
      fn: async () => {
        const session =
          kind === "mission"
            ? await ensureMissionSession({
                missionID: "promotion-owner",
                defaultCwd: anonymous.directory,
                productPillar: "work",
                heldExpertSquadIDs: ["base"],
              })
            : await Session.create({ kind, title: "Active promotion owner" })
        const owner = SessionPromptState.start(session.id, session.directory)
        if (!owner) throw new Error("Physical prompt ownership was not acquired")
        try {
          const app = new Hono().route("/project", ProjectRoutes()).onError(serverErrorResponse)
          const response = await app.request("/project/current/promote-anonymous", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ destinationParent: parent.path, name: "named" }),
          })
          const actual = { status: response.status, body: await response.json() }
          expect(actual).toEqual({
            status: 409,
            body: {
              name: "OwnedPromptControllersError",
              data: {
                operation: "anonymous project conversion",
                message: "Owned prompt controllers exist; refusing anonymous project conversion.",
              },
            },
          })
          conforms(document, actual)
          expect(SessionPromptState.hasOwnedPrompt(session.id, session.directory)).toBe(true)
          const current = await request(anonymous.directory, "GET", "/project/current")
          expect(current).toMatchObject({
            status: 200,
            body: { id: anonymous.project.id, worktree: anonymous.directory },
          })
        } finally {
          await SessionPromptState.finish(session.id, owner, session.directory)
        }
      },
    })
  }, 60_000)
}
