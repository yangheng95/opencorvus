import { afterEach, expect, test } from "bun:test"
import { Hono } from "hono"
import { Instance } from "../../src/project/instance"
import { Project } from "../../src/project/project"
import { ProjectRoutes } from "../../src/server/routes/project"
import { serverErrorResponse } from "../../src/server/error-handler"
import { Session } from "../../src/session"
import { ensureMissionSession } from "../../src/mission/session"
import { SessionPromptState } from "../../src/session/prompt/state"
import { declareNativeTaskProcessDeployment } from "../../src/runtime/task-process-deployment"
import { tmpdir } from "../fixture/fixture"
import { resetMemoryDatabase } from "../fixture/memory"

afterEach(resetMemoryDatabase)

for (const kind of ["assistant", "mission", "root"] as const) {
  test(`Git identity mutation returns an owned-controller conflict for active ${kind} work`, async () => {
    declareNativeTaskProcessDeployment()
    await using directory = await tmpdir()
    await Instance.provide({
      directory: directory.path,
      fn: async () => {
        const session =
          kind === "mission"
            ? await ensureMissionSession({
                missionID: "git-identity-owner",
                defaultCwd: directory.path,
                productPillar: "work",
                heldExpertSquadIDs: ["base"],
              })
            : await Session.create({ kind, title: "Active identity owner" })
        const owner = SessionPromptState.start(session.id, session.directory)
        if (!owner) throw new Error("Physical prompt ownership was not acquired")
        const app = new Hono().route("/project", ProjectRoutes()).onError(serverErrorResponse)
        try {
          const response = await app.request("/project/current/init-git", { method: "POST" })
          expect({
            status: response.status,
            body: await response.json(),
            git: Project.isGitRepo(directory.path),
          }).toEqual({
            status: 409,
            body: {
              name: "OwnedPromptControllersError",
              data: {
                operation: "Git initialization",
                message: "Owned prompt controllers exist; refusing Git initialization.",
              },
            },
            git: false,
          })
        } finally {
          await SessionPromptState.finish(session.id, owner, session.directory)
        }
      },
    })
  }, 60_000)
}

test("explicit Git initialization creates and returns the exact idle project", async () => {
  declareNativeTaskProcessDeployment()
  await using directory = await tmpdir()
  await Instance.provide({
    directory: directory.path,
    fn: async () => {
      const app = new Hono().route("/project", ProjectRoutes()).onError(serverErrorResponse)
      const response = await app.request("/project/current/init-git", { method: "POST" })
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ created: true, project: { worktree: directory.path } })
      expect(Project.isGitRepo(directory.path)).toBe(true)
    },
  })
}, 60_000)

test("an active sibling project preserves independent Git initialization", async () => {
  declareNativeTaskProcessDeployment()
  await using source = await tmpdir()
  await using target = await tmpdir()
  await Instance.provide({
    directory: source.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "Sibling project owner" })
      const owner = SessionPromptState.start(session.id, session.directory)
      if (!owner) throw new Error("Physical prompt ownership was not acquired")
      try {
        await Instance.provide({
          directory: target.path,
          fn: async () => {
            const app = new Hono().route("/project", ProjectRoutes()).onError(serverErrorResponse)
            const response = await app.request("/project/current/init-git", { method: "POST" })
            expect(response.status).toBe(200)
            expect(await response.json()).toMatchObject({ created: true, project: { worktree: target.path } })
          },
        })
        expect(SessionPromptState.hasOwnedPrompt(session.id, session.directory)).toBe(true)
      } finally {
        await SessionPromptState.finish(session.id, owner, session.directory)
      }
    },
  })
}, 60_000)
