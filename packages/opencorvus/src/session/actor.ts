import { Instance } from "../project/instance"
import { createInstanceState } from "../project/instance-state"
import { Log } from "../util/log"
import { Message } from "./message"
import { SessionStatus } from "./status"
import { Channel } from "@/util/channel"

export namespace SessionActor {
  export const log = Log.create({ service: "session.actor" })

  type Reply = { type: "result"; value: Message.WithParts } | { type: "error"; error: Error }

  type Command =
    | { type: "wait"; reply: Channel<Reply> }
    | { type: "resolve"; value: Message.WithParts }
    | { type: "reject"; error: unknown }
    | { type: "pending"; reply: Channel<number> }
    | { type: "close"; error: Error }

  type Info = {
    abort: AbortController
    inbox: Channel<Command>
    waiters: Channel<Reply>[]
    closing?: Error
  }

  const actors = createInstanceState(
    () => {
      const data: Record<string, Info> = {}
      return data
    },
    async (current) => {
      for (const [sessionID, actor] of Object.entries(current)) {
        close(sessionID, actor, new Error("Instance disposed"))
      }
    },
    "session-actor",
  )

  function error(input: unknown, message: string) {
    return input instanceof Error ? input : new Error(message)
  }

  function busy(sessionID: string) {
    return new Error(`Session ${sessionID} is busy`)
  }

  function settle(waiters: Channel<Reply>[], reply: Reply) {
    for (const waiter of waiters.splice(0)) {
      waiter.send(reply)
      waiter.close()
    }
  }

  async function serve(sessionID: string, actor: Info) {
    for await (const command of actor.inbox) {
      if (command.type === "wait") {
        if (actor.closing) {
          command.reply.send({ type: "error", error: actor.closing })
          command.reply.close()
          continue
        }
        actor.waiters.push(command.reply)
        continue
      }
      if (command.type === "resolve") {
        settle(actor.waiters, { type: "result", value: command.value })
        continue
      }
      if (command.type === "reject") {
        settle(actor.waiters, { type: "error", error: error(command.error, "Session failed") })
        continue
      }
      if (command.type === "pending") {
        command.reply.send(actor.waiters.length)
        command.reply.close()
        continue
      }
      actor.closing = command.error
      settle(actor.waiters, { type: "error", error: command.error })
    }
    settle(actor.waiters, { type: "error", error: actor.closing ?? new Error("Session closed") })
    if (actors()[sessionID] === actor) {
      delete actors()[sessionID]
      // Actor's serve() loop ran to natural completion. closing field reflects
      // whether an external close() injected an error before exit; if so the
      // session terminated with that error, otherwise it's a clean exit.
      const closing = actor.closing
      SessionStatus.set(
        sessionID,
        closing
          ? { type: "terminal", reason: "error", error: closing.message }
          : { type: "terminal", reason: "completed" },
      )
    }
  }

  function close(sessionID: string, actor: Info, reason: Error) {
    if (actor.closing) return
    actor.closing = reason
    actor.abort.abort()
    actor.inbox.send({ type: "close", error: reason })
    actor.inbox.close()
    delete actors()[sessionID]
    // Cancel sets reason to "Session cancelled" (see `cancel` below); other
    // close paths carry a real error.
    const aborted = reason.message === "Session cancelled"
    SessionStatus.set(
      sessionID,
      aborted ? { type: "terminal", reason: "aborted" } : { type: "terminal", reason: "error", error: reason.message },
    )
  }

  export function assertNotBusy(sessionID: string) {
    if (SessionStatus.get(sessionID).type === "streaming") throw busy(sessionID)
  }

  export function start(sessionID: string) {
    if (actors()[sessionID]) return
    const actor: Info = {
      abort: new AbortController(),
      inbox: new Channel<Command>(),
      waiters: [],
    }
    actors()[sessionID] = actor
    void serve(sessionID, actor).catch((cause) => {
      log.error("actor failed", { sessionID, cause })
      close(sessionID, actor, error(cause, "Session actor failed"))
    })
    return actor.abort.signal
  }

  export function resume(sessionID: string) {
    return actors()[sessionID]?.abort.signal
  }

  export async function wait(sessionID: string) {
    const actor = actors()[sessionID]
    if (!actor) throw new Error(`Session ${sessionID} not found`)
    const reply = new Channel<Reply>()
    if (!actor.inbox.send({ type: "wait", reply })) throw new Error(`Session ${sessionID} closed`)
    const result = await reply.recv()
    if (!result) throw new Error(`Session ${sessionID} closed`)
    if (result.type === "error") throw result.error
    return result.value
  }

  export function resolve(sessionID: string, value: Message.WithParts) {
    return actors()[sessionID]?.inbox.send({ type: "resolve", value }) ?? false
  }

  export function reject(sessionID: string, cause: unknown) {
    return actors()[sessionID]?.inbox.send({ type: "reject", error: cause }) ?? false
  }

  export async function pending(sessionID: string) {
    const actor = actors()[sessionID]
    if (!actor) return 0
    const reply = new Channel<number>()
    if (!actor.inbox.send({ type: "pending", reply })) return 0
    return (await reply.recv()) ?? 0
  }

  export function cancel(sessionID: string) {
    log.info("cancel", { sessionID })
    const actor = actors()[sessionID]
    if (!actor) {
      // No live actor — emit terminal aborted so overlay flips the card off
      // its spinner regardless of whether the actor ever started.
      SessionStatus.set(sessionID, { type: "terminal", reason: "aborted" })
      return
    }
    close(sessionID, actor, new Error("Session cancelled"))
  }

  export function owns(sessionID: string, signal: AbortSignal) {
    return actors()[sessionID]?.abort.signal === signal
  }
}
