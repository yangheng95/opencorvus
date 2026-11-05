/**
 * The prompt is the delivered history verbatim.
 *
 * A user Message persisted while the Session is answering an earlier one is
 * queued at write time (`pendingDelivery` on the Message itself — durable,
 * visible in debug bundles). The loop delivers every queued Message at the
 * next Turn boundary. There is no read-time slicing of the history at all.
 *
 * This replaced `promptMessagePrefix`, which hid later arrivals by cutting
 * the history around the reply target. One mid-Turn arrival then cut the
 * Turn's own Messages out of the prompt, freezing it byte-identical and
 * looping the model on one Tool call forever (Mission ses_-zUXWiACkzzlEtt8eqES,
 * 2026-08-17: `messagePayloadChars: 445377` unchanged across 29 steps).
 */
import { afterEach, describe, expect, test } from "bun:test"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { SessionLoop } from "@/session/loop"
import type { Message } from "@/session/message"
import { markPendingDeliveryIfTurnInFlight } from "@/session/prompt/parts"
import { SessionPromptState } from "@/session/prompt/state"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const { partitionPendingDelivery, currentUnacceptedInputBatch } = SessionLoop.TestHooks

function user(id: string, pendingDelivery?: boolean): Message.WithParts {
  return { info: { id, role: "user", ...(pendingDelivery ? { pendingDelivery } : {}) } as Message.Info, parts: [] }
}

function assistant(id: string, parentID: string): Message.WithParts {
  return { info: { id, role: "assistant", parentID } as Message.Info, parts: [] }
}

const ids = (messages: Message.WithParts[]) => messages.map((message) => message.info.id)

describe("partitionPendingDelivery", () => {
  test("a queued arrival stays out of the prompt while a delivered target is being answered", () => {
    const history = [
      user("u1"),
      assistant("a1", "u1"),
      user("u2"),
      assistant("a2", "u2"),
      user("u3-queued", true),
      assistant("a3", "u2"),
    ]

    const { visible } = partitionPendingDelivery(history, new Set(["u2", "u3-queued"]))

    // The Turn's own work stays visible — hiding it is what froze the prompt.
    expect(ids(visible)).toEqual(["u1", "a1", "u2", "a2", "a3"])
  })

  test("the prompt grows as the Turn produces work, so the context cannot freeze", () => {
    const base = [user("u1"), user("u2-queued", true)]
    const targets = new Set(["u1", "u2-queued"])
    const afterOne = partitionPendingDelivery([...base, assistant("a1", "u1")], targets)
    const afterTwo = partitionPendingDelivery([...base, assistant("a1", "u1"), assistant("a2", "u1")], targets)

    expect(ids(afterOne.visible)).toEqual(["u1", "a1"])
    expect(ids(afterTwo.visible)).toEqual(["u1", "a1", "a2"])
    expect(afterTwo.visible.length).toBeGreaterThan(afterOne.visible.length)
  })

  test("delivers every queued Message once no delivered target is in flight", () => {
    const history = [user("u1"), assistant("a1", "u1"), user("u2-queued", true), user("u3-queued", true)]

    const { visible, deliver } = partitionPendingDelivery(history, new Set(["u2-queued", "u3-queued"]))

    expect(ids(visible)).toEqual(["u1", "a1", "u2-queued", "u3-queued"])
    expect(ids(deliver)).toEqual(["u2-queued", "u3-queued"])
  })

  test("delivers queued Messages when nothing is attached at all", () => {
    const history = [user("u1"), assistant("a1", "u1"), user("u2-queued", true)]

    const { visible, deliver } = partitionPendingDelivery(history, new Set())

    expect(ids(visible)).toEqual(["u1", "a1", "u2-queued"])
    expect(ids(deliver)).toEqual(["u2-queued"])
  })

  test("a history with no queued Messages passes through untouched", () => {
    const history = [user("u1"), assistant("a1", "u1"), assistant("a2", "u1")]

    const { visible } = partitionPendingDelivery(history, new Set(["u1"]))

    expect(visible).toBe(history)
  })
})

describe("current input admission batch", () => {
  function admitted(history: Message.WithParts[], targets: string[] = []) {
    const { visible, deliver } = partitionPendingDelivery(history, new Set(targets))
    const lastUser = visible.findLast((message) => message.info.role === "user")!.info as Message.User
    return currentUnacceptedInputBatch(visible, lastUser, deliver)
  }

  test("accepts the moved participant and queued control as one ordered batch", () => {
    expect(
      admitted([user("previous"), assistant("reply", "previous"), user("participant"), user("control", true)]),
    ).toEqual(["participant", "control"])
  })

  test("accepts queued input before the previous final reply and new input after it", () => {
    expect(admitted([user("previous"), user("queued", true), assistant("reply", "previous"), user("new")])).toEqual([
      "queued",
      "new",
    ])
  })

  test("preserves timeline order for interleaved input kinds", () => {
    expect(
      admitted([
        user("previous"),
        user("queued-one", true),
        assistant("reply", "previous"),
        user("new-one"),
        user("queued-two", true),
        user("new-two"),
      ]),
    ).toEqual(["queued-one", "new-one", "queued-two", "new-two"])
  })

  test("accepts concurrent first inputs in the same Session", () => {
    expect(admitted([user("first"), user("second"), user("third", true)])).toEqual(["first", "second", "third"])
  })

  test("accepts the next input after completed history", () => {
    expect(admitted([user("previous"), assistant("reply", "previous"), user("next")])).toEqual(["next"])
  })

  test("retries the exact failed admission batch for an attached peer", () => {
    const failed = assistant("failed", "tail")
    failed.info = {
      ...failed.info,
      role: "assistant",
      parentID: "tail",
      acceptedInputMessageIDs: ["participant", "tail"],
      finish: "error",
      time: { created: 1, completed: 2 },
    } as Message.Assistant
    expect(
      SessionLoop.TestHooks.failedAcceptedInputBatch(
        [user("participant"), user("tail"), failed],
        new Set(["participant"]),
        "tail",
      ),
    ).toEqual(["participant", "tail"])
  })
})

describe("markPendingDeliveryIfTurnInFlight", () => {
  afterEach(async () => {
    await Instance.disposeAll()
    await resetMemoryDatabase()
  })

  function userInfo(sessionID: string): Message.Info {
    return {
      id: Identifier.ascending("message"),
      role: "user",
      sessionID,
      author: "operator",
      time: { created: Date.now() },
      agent: "conversation",
      model: { providerID: "test", modelID: "test" },
    } as Message.Info
  }

  test("queues a Message persisted while the Session is answering an earlier one", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "pending delivery write side" })
        const abort = SessionPromptState.start(session.id)
        const attached = SessionPromptState.attach(session.id, undefined, "reply", "msg_earlier-target")
        attached.catch(() => undefined)
        try {
          const info = userInfo(session.id)
          markPendingDeliveryIfTurnInFlight(info)
          expect(info.role === "user" && info.pendingDelivery).toBe(true)
        } finally {
          await SessionPromptState.finish(session.id, abort ?? undefined)
        }
      },
    })
  })

  test("preserves the authored identity on an idle Session", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "root", title: "pending delivery idle side" })
        const info = userInfo(session.id)
        markPendingDeliveryIfTurnInFlight(info)
        expect(info).toMatchObject({ role: "user", sessionID: session.id, author: "operator", agent: "conversation" })
      },
    })
  })
})
