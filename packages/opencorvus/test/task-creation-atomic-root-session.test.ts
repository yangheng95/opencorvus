import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { SessionTable } from "../src/session/session.sql"
import { Database } from "../src/storage/db"
import { EngineService } from "../src/task-api"
import * as Pipeline from "../src/engine/pipeline"
import { InstanceBootstrap } from "../src/project/bootstrap"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

function sessionIDsInProject(projectID: string): string[] {
  return Database.use((db) =>
    db
      .select({ id: SessionTable.id })
      .from(SessionTable)
      .all()
      .filter(() => true)
      .map((row) => row.id),
  )
}

describe("Task creation commits its root Session with the Task aggregate", () => {
  test("a failed aggregate commit leaves no visible root Session, and the retried request creates the whole occurrence", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        const requestID = `arc010-${Identifier.ascending("artifact")}`
        const input = {
          requestID,
          request: "Commit the root Session and the Task aggregate together",
          productPillar: "code" as const,
          model: "firmware/gpt-5",
          promptProfile: "base",
        }
        const before = sessionIDsInProject(Instance.project.id)

        const persist = spyOn(Pipeline, "persistTask").mockImplementationOnce(() => {
          throw new Error("injected task aggregate commit failure")
        })
        try {
          await expect(EngineService.createTask(input, { actor: "user" })).rejects.toThrow(
            "injected task aggregate commit failure",
          )
        } finally {
          persist.mockRestore()
        }

        // The failed request's durable footprint is empty: the Session table
        // is exactly what it was — no ownerless root Session to strand.
        expect(sessionIDsInProject(Instance.project.id)).toEqual(before)

        // The same request retried creates the complete occurrence: Task and
        // root Session commit together and reference each other.
        const taskID = await EngineService.createTask(input, { actor: "user" })
        const task = await EngineService.getTask(taskID)
        expect(task.sessionID).toBeTruthy()
        const rootSession = await Session.get(task.sessionID!)
        expect({ kind: rootSession.kind, projectID: rootSession.projectID }).toEqual({
          kind: "root",
          projectID: Instance.project.id,
        })
      },
    })
  }, 120_000)
})
