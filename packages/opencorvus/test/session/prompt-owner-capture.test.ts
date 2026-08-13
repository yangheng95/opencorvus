import { afterEach, expect, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { SessionPromptState } from "../../src/session/prompt/state"
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
