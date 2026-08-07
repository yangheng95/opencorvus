import { expect, test } from "bun:test"
import { createInitialDirectoryResolver, initialRestoreTaskID } from "../src/services/init"

test("initial directory resolution shares one successful result across reconnects", async () => {
  let resolutions = 0
  const resolve = createInitialDirectoryResolver(async () => {
    resolutions += 1
    return true
  })

  const results = await Promise.all([resolve(), resolve(), resolve()])

  expect({ resolutions, results }).toEqual({ resolutions: 1, results: [true, true, true] })
})

test("initial workspace restore keeps an existing saved task selection", () => {
  const selected = initialRestoreTaskID(
    [{ task: { id: "tsk_active", status: "active" } }, { task: { id: "tsk_saved", status: "completed" } }],
    "tsk_saved",
  )

  expect(selected).toBe("tsk_saved")
})

test("initial workspace restore selects the newest running task when no saved task exists", () => {
  const selected = initialRestoreTaskID(
    [
      { task: { id: "tsk_done", status: "completed" } },
      { task: { id: "tsk_running", status: "active" } },
      { task: { id: "tsk_waiting", status: "queued" } },
    ],
    "",
  )

  expect(selected).toBe("tsk_running")
})
