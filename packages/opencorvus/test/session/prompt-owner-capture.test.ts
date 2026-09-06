import { afterEach, expect, test } from "bun:test"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { currentRuntimeProcessOccurrence } from "../../src/runtime/process-occurrence"
import { Session } from "../../src/session"
import { SessionPromptOwner } from "../../src/session/prompt/owner"
import { SessionPromptState } from "../../src/session/prompt/state"
import { SessionPromptOwnerTable } from "../../src/session/session.sql"
import { Database, eq } from "../../src/storage/db"
import { resetDatabase } from "../fixture/db"
import { tmpdir } from "../fixture/fixture"

afterEach(async () => {
  await Instance.disposeAll()
  await resetDatabase()
})

test("prompt owner capture maps concurrent async Session starts to their exact target Sessions", async () => {
  await using project = await tmpdir({ git: true })
  try {
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const target = await Session.create({ kind: "assistant", title: "Target prompt owner" })
        const unrelated = await Session.create({ kind: "assistant", title: "Unrelated prompt owner" })
        const targetCaptures: AbortSignal[] = []
        const unrelatedCaptures: AbortSignal[] = []
        let targetOwner: AbortSignal | undefined
        let unrelatedOwner: AbortSignal | undefined

        try {
          await SessionPromptState.withPromptOwnerCapture(
            target.id,
            (owner) => targetCaptures.push(owner),
            async () => {
              await Promise.resolve()
              unrelatedOwner = SessionPromptState.start(unrelated.id, project.path)
              await Promise.resolve()
              targetOwner = SessionPromptState.start(target.id, project.path)
            },
          )

          SessionPromptState.withPromptOwnerCapture(
            unrelated.id,
            (owner) => unrelatedCaptures.push(owner),
            () => SessionPromptState.capturePromptOwner(unrelated.id, project.path),
          )

          expect({ targetCaptures, unrelatedCaptures }).toEqual({
            targetCaptures: [targetOwner],
            unrelatedCaptures: [unrelatedOwner],
          })
        } finally {
          await SessionPromptState.release(target.id)
          await SessionPromptState.release(unrelated.id)
        }
      },
    })
  } finally {
    await Instance.disposeAll()
  }
}, 30_000)

test("prompt owner acquisition reobserves a changed exact authority before deciding its winner", async () => {
  await using project = await tmpdir({ git: true })
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "Prompt owner observation race" })
      const processOwner = currentRuntimeProcessOccurrence()
      const first = {
        session_id: session.id,
        project_id: session.projectID,
        directory: session.directory,
        generation: Identifier.ascending("call"),
        owner_pid: processOwner.pid,
        owner_process_instance_id: `superseded-${processOwner.processInstanceID}`,
        owner_occurrence_id: Identifier.ascending("call"),
        time_acquired: Date.now(),
      }
      const second = {
        ...first,
        generation: Identifier.ascending("call"),
        owner_process_instance_id: `current-${processOwner.processInstanceID}`,
        owner_occurrence_id: Identifier.ascending("call"),
        time_acquired: first.time_acquired + 1,
      }
      Database.immediateTransaction((db) => db.insert(SessionPromptOwnerTable).values(first).run())
      const observed: string[] = []
      using _observation = SessionPromptOwner.TestHooks.installOwnerObservation((authority) => {
        observed.push(authority.generation)
        if (authority.generation === first.generation) {
          Database.immediateTransaction((db) => {
            db.delete(SessionPromptOwnerTable).where(eq(SessionPromptOwnerTable.session_id, session.id)).run()
            db.insert(SessionPromptOwnerTable).values(second).run()
          })
          return "dead_or_reused"
        }
        return "exact_live"
      })

      const admission = SessionPromptOwner.acquire({
        sessionID: session.id,
        projectID: session.projectID,
        directory: session.directory,
      })

      expect({
        admission,
        observed,
        current: SessionPromptOwner.current(session.id),
      }).toEqual({
        admission: { acquired: false, authority: second, observation: "exact_live" },
        observed: [first.generation, second.generation],
        current: second,
      })
    },
  })
}, 30_000)
