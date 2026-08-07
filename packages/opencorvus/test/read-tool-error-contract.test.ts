import { expect, test } from "bun:test"
import { OciTaskContainerUnavailableError } from "../src/execution-capsule/oci-task-container"
import { taskFileStatOrMissing } from "../src/tool/read"

test("Read Tool preserves typed Execution Capsule runtime failures", async () => {
  const unavailable = new OciTaskContainerUnavailableError("Task Container exited before stat")
  let received: unknown
  try {
    await taskFileStatOrMissing(async () => {
      throw unavailable
    })
  } catch (error) {
    received = error
  }
  expect(received).toBe(unavailable)

  const missing = Object.assign(new Error("missing"), { code: "ENOENT" })
  expect(
    await taskFileStatOrMissing(async () => {
      throw missing
    }),
  ).toBeUndefined()
})
