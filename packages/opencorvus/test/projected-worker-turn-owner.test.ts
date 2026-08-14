import { expect, test } from "bun:test"
import {
  runProjectedWorkerTurnExclusive,
  waitForProjectedWorkerTurnOwnersForTest,
} from "@/agent/projected-worker-turn-owner"

test("projected worker Turns acquire one physical Session in submission order", async () => {
  const events: string[] = []
  let releaseFirst!: () => void
  let firstOwned!: () => void
  const firstMayFinish = new Promise<void>((resolve) => {
    releaseFirst = resolve
  })
  const observedFirstOwner = new Promise<void>((resolve) => {
    firstOwned = resolve
  })

  const first = runProjectedWorkerTurnExclusive({
    sessionID: "ses_serial_worker",
    run: async () => {
      events.push("first:owned")
      firstOwned()
      await firstMayFinish
      events.push("first:settled")
      return "first"
    },
  })
  const second = runProjectedWorkerTurnExclusive({
    sessionID: "ses_serial_worker",
    run: async () => {
      events.push("second:owned")
      return "second"
    },
  })
  await observedFirstOwner
  expect(events).toEqual(["first:owned"])

  releaseFirst()
  expect(await Promise.all([first, second])).toEqual(["first", "second"])
  expect(events).toEqual(["first:owned", "first:settled", "second:owned"])
  await waitForProjectedWorkerTurnOwnersForTest()
})
