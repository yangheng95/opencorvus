import { describe, expect, test } from "bun:test"
import { Bus } from "../src/bus"
import { createProjectEventSSEListener } from "../src/server/routes/app"

describe("project event SSE acceptance", () => {
  test("accepts a matching event without waiting for the client write and preserves serialized payload", async () => {
    let settleWrite!: () => void
    const writeSettled = new Promise<void>((resolve) => {
      settleWrite = resolve
    })
    const writes: string[] = []
    const listener = createProjectEventSSEListener({
      directory: "C:\\isolated\\project",
      write(data) {
        writes.push(data)
        return writeSettled
      },
      closeAfterDelivery() {},
    })

    expect(
      listener({
        directory: "C:\\isolated\\project",
        payload: { type: "message.part.updated" },
      }),
    ).toEqual({ status: "accepted", eventType: "message.part.updated" })
    expect(writes).toEqual([JSON.stringify({ type: "message.part.updated" })])
    settleWrite()
    await writeSettled
  })

  test("closes an Instance-disposed client only after its accepted delivery settles", async () => {
    let settleWrite!: () => void
    const writeSettled = new Promise<void>((resolve) => {
      settleWrite = resolve
    })
    let closeCount = 0
    const listener = createProjectEventSSEListener({
      directory: "C:\\isolated\\project",
      write: () => writeSettled,
      closeAfterDelivery: () => {
        closeCount += 1
      },
    })

    expect(
      listener({
        directory: "C:\\isolated\\project",
        payload: { type: Bus.InstanceDisposed.type },
      }),
    ).toEqual({ status: "accepted", eventType: Bus.InstanceDisposed.type })
    expect(closeCount).toBe(0)
    settleWrite()
    await writeSettled
    await Promise.resolve()
    expect(closeCount).toBe(1)
  })
})
