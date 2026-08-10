import { describe, expect, test } from "bun:test"
import z from "zod"
import { extractBrowserPreviewUrlsFromText } from "../src/browser-preview/extract"
import { canonicalBrowserPreviewUrl } from "../src/browser-preview/url-identity"
import { SessionCompaction } from "../src/session/compaction"
import { Message } from "../src/session/message"
import { SessionPromptState } from "../src/session/prompt/state"

describe("algorithm repair contracts", () => {
  test("uses one URL identity while preserving path, query, and fragment case", () => {
    expect(canonicalBrowserPreviewUrl("HTTP://LOCALHOST:3000/Path?Query=Value#Fragment")).toBe(
      "http://localhost:3000/Path?Query=Value#Fragment",
    )
    expect(
      extractBrowserPreviewUrlsFromText(
        "ready http://LOCALHOST:3000/Path?Query=Value#Fragment and http://localhost:3000/path?query=value#fragment",
      ),
    ).toEqual([
      "http://localhost:3000/Path?Query=Value#Fragment",
      "http://localhost:3000/path?query=value#fragment",
    ])
  })

  test("projects every persisted JSON Tool input into a compaction value", () => {
    const state = Message.ToolState.parse({
      status: "pending",
      input: { nested: [null, true, 42, "value"] },
      raw: "{}",
      time: { start: 1 },
    })
    expect(SessionCompaction.TestHooks.compactToolInputProjection(state.input)).toEqual({
      nested: [null, true, 42, "value"],
    })
    expect(SessionCompaction.TestHooks.compactToolInputProjection(null)).toBeNull()
  })

  test("publishes the Tool input domain as the complete OpenAPI JSON value schema", () => {
    expect(z.toJSONSchema(Message.ToolInput)).toEqual({
      $schema: "https://json-schema.org/draft/2020-12/schema",
    })
  })

  test("unregisters a timed-out root wake idle waiter from its live queue", async () => {
    let settleWake!: () => void
    const wake = SessionPromptState.enqueueRootWake({
      rootSessionID: "root_waiter_contract",
      wakeID: "wake_waiter_contract",
      run: () => new Promise<void>((resolve) => (settleWake = resolve)),
    })
    await Promise.resolve()
    await SessionPromptState.waitForRootWakeQueueIdle("root_waiter_contract", 5).catch(() => undefined)
    expect(SessionPromptState.TestHooks.rootWakeQueueSnapshot("root_waiter_contract")).toEqual({
      entries: 1,
      idleWaiters: 0,
    })
    settleWake()
    await wake
  })

  test("reuses one durable wake identity only after its current physical owner settles", async () => {
    let settleCurrent!: () => void
    let currentStarted!: () => void
    const observedCurrentStart = new Promise<void>((resolve) => (currentStarted = resolve))
    const current = SessionPromptState.enqueueRootWake({
      rootSessionID: "root_wake_settlement_contract",
      wakeID: "wake_settlement_contract",
      run: async () => {
        currentStarted()
        await new Promise<void>((resolve) => (settleCurrent = resolve))
      },
    })
    await observedCurrentStart

    const nextDelivery = SessionPromptState.waitForRootWakeSettlement(
      "root_wake_settlement_contract",
      "wake_settlement_contract",
    ).then(() =>
      SessionPromptState.enqueueRootWake({
        rootSessionID: "root_wake_settlement_contract",
        wakeID: "wake_settlement_contract",
        run: async () => ({ phase: "terminal_delivery" as const }),
      }),
    )

    expect(SessionPromptState.TestHooks.rootWakeQueueSnapshot("root_wake_settlement_contract")).toEqual({
      entries: 1,
      idleWaiters: 0,
    })
    settleCurrent()
    await current
    expect(await nextDelivery).toEqual({ phase: "terminal_delivery" })
    expect(SessionPromptState.TestHooks.rootWakeQueueSnapshot("root_wake_settlement_contract")).toBeUndefined()
  })
})
