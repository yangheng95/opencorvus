import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import type { Config } from "@/config/config"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { createInstanceState } from "@/project/instance-state"
import { Database, eq, NotFoundError } from "@/storage/db"
import { PermissionTable } from "@/session/session.sql"
import { fn } from "@/util/fn"
import { Log } from "@/util/log"
import { Wildcard } from "@/util/wildcard"
import os from "os"
import z from "zod"
import { entries, values as objectValues } from "@/util/object"
import { Reply as _Reply } from "./types"
import type { Reply as _ReplyType } from "./types"

export namespace PermissionNext {
  const log = Log.create({ service: "permission" })

  function expand(pattern: string): string {
    const home = os.homedir()
    const userProfile = process.env.USERPROFILE || home

    if (pattern.startsWith("~/")) return home + pattern.slice(1)
    if (pattern === "~") return home
    if (pattern.startsWith("$HOME/")) return home + pattern.slice(5)
    if (pattern.startsWith("$HOME")) return home + pattern.slice(5)

    const userProfileToken = "%USERPROFILE%"
    if (pattern.localeCompare(userProfileToken, undefined, { sensitivity: "accent" }) === 0) {
      return userProfile
    }
    if (pattern.toUpperCase().startsWith(userProfileToken)) {
      const suffix = pattern.slice(userProfileToken.length)
      if (!suffix || suffix.startsWith("/") || suffix.startsWith("\\")) return userProfile + suffix
    }

    return pattern
  }

  export const Action = z.enum(["allow", "deny", "ask"]).meta({
    ref: "PermissionAction",
  })
  export type Action = z.infer<typeof Action>

  export const Rule = z
    .object({
      permission: z.string(),
      pattern: z.string(),
      action: Action,
    })
    .meta({
      ref: "PermissionRule",
    })
  export type Rule = z.infer<typeof Rule>

  export const Ruleset = Rule.array().meta({
    ref: "PermissionRuleset",
  })
  export type Ruleset = z.infer<typeof Ruleset>

  export function fromConfig(permission: Config.Permission) {
    if (typeof permission === "string") {
      return [{ permission: "*", pattern: "*", action: permission as Action }]
    }
    const ruleset: Ruleset = []
    for (const [key, value] of entries(permission)) {
      if (typeof value === "string") {
        ruleset.push({
          permission: key,
          action: value as "allow" | "ask" | "deny",
          pattern: "*",
        })
        continue
      }
      ruleset.push(
        ...entries(value).map(([pattern, action]) => ({
          permission: key,
          pattern: expand(pattern),
          action: action as "allow" | "ask" | "deny",
        })),
      )
    }
    return ruleset
  }

  /** Merge any number of rulesets. Undefined entries are silently skipped so
   *  callers can pass `agent.permission` from fixed registry entries that do not
   *  define permission overrides without `?? []` boilerplate at every site. */
  export function merge(...rulesets: (Ruleset | undefined)[]): Ruleset {
    return rulesets.flatMap((r) => r ?? [])
  }

  export function matches(permission: string, pattern: string, rule: Rule): boolean {
    return Wildcard.match(permission, rule.permission) && Wildcard.match(pattern, rule.pattern)
  }

  export const Request = z
    .object({
      id: Identifier.schema("permission"),
      sessionID: Identifier.schema("session"),
      permission: z.string(),
      patterns: z.string().array(),
      metadata: z.record(z.string(), z.any()),
      always: z.string().array(),
      tool: z
        .object({
          messageID: z.string(),
          callID: z.string(),
        })
        .optional(),
    })
    .meta({
      ref: "PermissionRequest",
    })

  export type Request = z.infer<typeof Request>

  // Re-exported from ./types so schema-only consumers (engine/model) can
  // import directly without pulling in Bus/Instance. External callers using
  // the `PermissionNext.Reply` namespace form keep working unchanged.
  export const Reply = _Reply
  export type Reply = _ReplyType

  export const Approval = z.object({
    projectID: z.string(),
    patterns: z.string().array(),
  })

  export const Event = {
    Asked: BusEvent.define("permission.asked", Request),
    Replied: BusEvent.define(
      "permission.replied",
      z.object({
        sessionID: z.string(),
        requestID: z.string(),
        reply: Reply,
        autoReply: z.boolean(),
      }),
    ),
    Abandoned: BusEvent.define(
      "permission.abandoned",
      z.object({
        sessionID: z.string(),
        requestID: z.string(),
        origin: z.literal("infrastructure"),
        timeResolved: z.number().int().positive(),
      }),
    ),
  }

  const state = createInstanceState(
    () => {
      const projectID = Instance.project.id
      const row = Database.use((db) =>
        db.select().from(PermissionTable).where(eq(PermissionTable.project_id, projectID)).get(),
      )
      const stored = row?.data ?? ([] as Ruleset)

      const pending: Record<
        string,
        {
          info: Request
          resolve: () => void
          reject: (e: any) => void
          timer: ReturnType<typeof setTimeout> | undefined
        }
      > = {}

      return {
        pending,
        approved: stored,
      }
    },
    async (s) => {
      for (const id of Object.keys(s.pending)) {
        const pending = s.pending[id]
        clearTimeout(pending.timer)
        delete s.pending[id]
        await Bus.publish(Event.Abandoned, {
          sessionID: pending.info.sessionID,
          requestID: pending.info.id,
          origin: "infrastructure",
          timeResolved: Date.now(),
        })
      }
    },
    "permission",
  )

  const PERMISSION_MIN_TIMEOUT_MS = 1000
  const PERMISSION_REJECT_TIMEOUT_MS = Math.max(
    parseInt(process.env.OPENCORVUS_PERMISSION_TIMEOUT_MS || "300000", 10),
    PERMISSION_MIN_TIMEOUT_MS,
  )

  export const ask = fn(
    Request.partial({ id: true }).extend({
      ruleset: Ruleset,
      timeoutMs: z.number().int().positive().optional(),
    }),
    async (input) => {
      const s = await state()
      const { ruleset, timeoutMs, ...request } = input
      let shouldAsk = false
      for (const pattern of request.patterns ?? []) {
        const rule = evaluateRequest(request.permission, pattern, ruleset, s.approved)
        log.info("evaluated", { permission: request.permission, pattern, action: rule })
        if (rule.action === "deny")
          throw new DeniedError(ruleset.filter((r) => Wildcard.match(request.permission, r.permission)))
        if (rule.action === "ask") shouldAsk = true
        if (rule.action === "allow") continue
      }
      if (!shouldAsk) return

      const id = input.id ?? Identifier.ascending("permission")
      const timeout = Math.max(timeoutMs ?? PERMISSION_REJECT_TIMEOUT_MS, PERMISSION_MIN_TIMEOUT_MS)
      return new Promise<void>((resolve, reject) => {
        const info: Request = {
          id,
          ...request,
        }
        const timer = setTimeout(() => {
          if (!s.pending[id]) return
          log.info("permission timeout rejected", {
            id,
            permission: request.permission,
            patterns: request.patterns,
          })
          delete s.pending[id]
          Bus.publish(Event.Replied, {
            sessionID: request.sessionID,
            requestID: id,
            reply: "reject",
            autoReply: true,
          })
          reject(new RejectedError())
        }, timeout)
        s.pending[id] = {
          info,
          resolve,
          reject,
          timer,
        }
        Bus.publish(Event.Asked, info)
      })
    },
  )

  export const reply = fn(
    z.object({
      requestID: Identifier.schema("permission"),
      reply: Reply,
      autoReply: z.boolean(),
      message: z.string().optional(),
    }),
    async (input) => {
      const s = await state()
      const existing = s.pending[input.requestID]
      if (!existing) throw new NotFoundError({ message: `Permission request not found: ${input.requestID}` })
      clearTimeout(existing.timer)
      delete s.pending[input.requestID]
      Bus.publish(Event.Replied, {
        sessionID: existing.info.sessionID,
        requestID: existing.info.id,
        reply: input.reply,
        autoReply: input.autoReply,
      })
      if (input.reply === "reject") {
        existing.reject(input.message ? new CorrectedError(input.message) : new RejectedError())
        // Reject all other pending permissions for this session
        const sessionID = existing.info.sessionID
        for (const [id, pending] of entries(s.pending)) {
          if (pending.info.sessionID === sessionID) {
            clearTimeout(pending.timer)
            delete s.pending[id]
            Bus.publish(Event.Replied, {
              sessionID: pending.info.sessionID,
              requestID: pending.info.id,
              reply: "reject",
              autoReply: true,
            })
            pending.reject(new RejectedError())
          }
        }
        return
      }
      if (input.reply === "once") {
        existing.resolve()
        return
      }
      if (input.reply === "always") {
        for (const pattern of existing.info.always) {
          s.approved.push({
            permission: existing.info.permission,
            pattern,
            action: "allow",
          })
        }

        existing.resolve()

        const sessionID = existing.info.sessionID
        for (const [id, pending] of entries(s.pending)) {
          if (pending.info.sessionID !== sessionID) continue
          const ok = pending.info.patterns.every(
            (pattern) => evaluate(pending.info.permission, pattern, s.approved).action === "allow",
          )
          if (!ok) continue
          clearTimeout(pending.timer)
          delete s.pending[id]
          Bus.publish(Event.Replied, {
            sessionID: pending.info.sessionID,
            requestID: pending.info.id,
            reply: "always",
            autoReply: true,
          })
          pending.resolve()
        }

        Database.use((db) =>
          db
            .insert(PermissionTable)
            .values({ project_id: Instance.project.id, data: s.approved })
            .onConflictDoUpdate({
              target: PermissionTable.project_id,
              set: { data: s.approved },
            })
            .run(),
        )
        return
      }
    },
  )

  /**
   * Publish the terminal occurrence for a durable Permission whose owning
   * project Instance was replaced and therefore has no process-local waiter.
   */
  export async function abandonRecovered(input: {
    sessionID: string
    requestID: string
    timeResolved: number
  }): Promise<void> {
    log.warn("recovered permission abandoned by infrastructure", { requestID: input.requestID })
    await Bus.publish(Event.Abandoned, {
      sessionID: input.sessionID,
      requestID: input.requestID,
      origin: "infrastructure",
      timeResolved: input.timeResolved,
    })
  }

  /**
   * Hierarchical permission resolution. Rulesets stack (project → session →
   * agent), `findLast` wins, more specific layers shadow earlier ones. The
   * default for an unmatched permission is `allow` — built-in tools never
   * sit behind a confirmation wall, and operators who want to restrict a
   * tool add an explicit `deny` (or `ask` for human-approval workflows)
   * rule. Per rule 23 the system does not impose a hidden state machine
   * (untyped tool → ask → human → wait forever); LLM agents either run
   * the tool or get a clear `deny` they can react to.
   */
  export function evaluate(permission: string, pattern: string, ...rulesets: (Ruleset | undefined)[]): Rule {
    const merged = merge(...rulesets)
    log.debug("evaluate", { permission, pattern, ruleset: merged })
    const match = merged.findLast((rule) => matches(permission, pattern, rule))
    return match ?? { action: "allow", permission, pattern: "*" }
  }

  export function evaluateRequest(
    permission: string,
    pattern: string,
    currentRuleset: Ruleset,
    approvedRuleset: Ruleset | undefined,
  ): Rule {
    const currentRule = evaluate(permission, pattern, currentRuleset)
    if (currentRule.action === "deny" || currentRule.action === "ask") return currentRule
    return evaluate(permission, pattern, approvedRuleset, currentRuleset)
  }

  const EDIT_TOOLS = ["edit", "write", "patch", "multiedit"]

  /** Returns the set of tools that the ruleset explicitly bans (`pattern: "*",
   *  action: "deny"`). Undefined ruleset means "no rules" → empty set
   *  (consistent with stage agents that have no permission config). */
  export function disabled(tools: string[], ruleset: Ruleset | undefined): Set<string> {
    const result = new Set<string>()
    if (!ruleset) return result
    for (const tool of tools) {
      const permission = EDIT_TOOLS.includes(tool) ? "edit" : tool

      const rule = ruleset.findLast((r) => Wildcard.match(permission, r.permission))
      if (!rule) continue
      if (rule.pattern === "*" && rule.action === "deny") result.add(tool)
    }
    return result
  }

  /** User rejected without message - halts execution */
  export class RejectedError extends Error {
    constructor() {
      super(`The user rejected permission to use this specific tool call.`)
    }
  }

  /** User rejected with message - continues with guidance */
  export class CorrectedError extends Error {
    constructor(message: string) {
      super(`The user rejected permission to use this specific tool call with the following feedback: ${message}`)
    }
  }

  /** Auto-rejected by config rule - halts execution */
  export class DeniedError extends Error {
    constructor(public readonly ruleset: Ruleset) {
      super(
        `The user has specified a rule which prevents you from using this specific tool call. Here are some of the relevant rules ${JSON.stringify(ruleset)}`,
      )
    }
  }

  export async function list() {
    const s = await state()
    return objectValues(s.pending).map((x) => x.info)
  }
}
