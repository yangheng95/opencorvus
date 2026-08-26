import crypto from "node:crypto"
import path from "node:path"
import z from "zod"
import { Global } from "@/global"
import { Filesystem } from "@/util/filesystem"
import { withSharedJsonFactLock } from "@/util/process-lock"

/**
 * Durable Provider OAuth flow occurrences.
 *
 * A Provider authorization used to be one process-local slot per provider:
 * a second authorize silently replaced the first, restart lost both, and the
 * callback matched only the provider ID — it could not prove which method or
 * inputs produced the code it was handed. Each flow is now an occurrence with
 * its own identity, provider, scope, method, an inputs digest and a terminal
 * state, durable in the shared data root.
 *
 * What stays process-local is the plugin's callback closure — it carries live
 * PKCE material a restart cannot resurrect. The occurrence is what makes that
 * loss exact instead of silent: a callback for a flow whose executor died
 * finds a pending occurrence with no executor and fails with that fact,
 * rather than a generic "nothing pending".
 */
export namespace ProviderOAuthFlowStore {
  export const FlowID = z.string().trim().min(1)
  export const FlowState = z.enum(["pending", "superseded", "consumed", "failed"])
  export type FlowState = z.infer<typeof FlowState>

  export const Flow = z.object({
    id: FlowID,
    providerID: z.string().min(1),
    scope: z.enum(["project", "global"]),
    method: z.number().int().nonnegative(),
    /** SHA-256 of the canonicalized authorize inputs; raw inputs never land here. */
    inputsDigest: z.string(),
    state: FlowState,
    timeCreated: z.number(),
    timeSettled: z.number().optional(),
    error: z.string().optional(),
  })
  export type Flow = z.infer<typeof Flow>

  const Store = z.record(z.string(), Flow)

  /** Settled occurrences older than this are pruned on the next write. */
  const SETTLED_RETENTION_MS = 24 * 60 * 60 * 1000

  const locks = new Map<string, Promise<unknown>>()

  function filepath(): string {
    return path.join(Global.Path.data, "provider-oauth-flows.json")
  }

  export function digestInputs(inputs: Record<string, string> | undefined): string {
    const canonical = JSON.stringify(
      Object.fromEntries(Object.entries(inputs ?? {}).sort(([left], [right]) => left.localeCompare(right))),
    )
    return crypto.createHash("sha256").update(canonical).digest("hex")
  }

  async function read(): Promise<Record<string, Flow>> {
    try {
      return Store.parse(await Filesystem.readJson<unknown>(filepath()))
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        ((error as { code?: unknown }).code === "ENOENT" || (error as { code?: unknown }).code === "ENOTDIR")
      ) {
        return {}
      }
      throw error
    }
  }

  function mutate<T>(run: () => Promise<T>): Promise<T> {
    return withSharedJsonFactLock({ locks, filepath: filepath(), empty: "{}", mode: 0o600, run })
  }

  async function write(data: Record<string, Flow>): Promise<void> {
    const now = Date.now()
    for (const [id, flow] of Object.entries(data)) {
      if (flow.state !== "pending" && (flow.timeSettled ?? flow.timeCreated) < now - SETTLED_RETENTION_MS) {
        delete data[id]
      }
    }
    await Filesystem.writeAtomic(filepath(), JSON.stringify(data, null, 2), 0o600)
  }

  /**
   * Open a new flow occurrence, superseding any pending flow for the same
   * provider and scope. Supersession is a durable fact of the old occurrence,
   * not a silent replacement.
   */
  export async function open(input: {
    providerID: string
    scope: "project" | "global"
    method: number
    inputsDigest: string
  }): Promise<Flow> {
    const flow: Flow = Flow.parse({
      id: crypto.randomUUID(),
      providerID: input.providerID,
      scope: input.scope,
      method: input.method,
      inputsDigest: input.inputsDigest,
      state: "pending",
      timeCreated: Date.now(),
    })
    await mutate(async () => {
      const data = await read()
      for (const existing of Object.values(data)) {
        if (
          existing.state === "pending" &&
          existing.providerID === input.providerID &&
          existing.scope === input.scope
        ) {
          existing.state = "superseded"
          existing.timeSettled = Date.now()
        }
      }
      data[flow.id] = flow
      await write(data)
    })
    return flow
  }

  export const TestHooks = {
    /** Observe the pending occurrence without adding a production fallback lookup path. */
    async pendingFor(providerID: string, scope: "project" | "global"): Promise<Flow | undefined> {
      const data = await read()
      return Object.values(data).find(
        (flow) => flow.state === "pending" && flow.providerID === providerID && flow.scope === scope,
      )
    },
  }

  export async function get(id: string): Promise<Flow | undefined> {
    return (await read())[id]
  }

  /**
   * Settle one occurrence terminally. Returns the settled flow, or undefined
   * when the occurrence is not pending any more — the caller lost the race and
   * must not write a credential for it.
   */
  export async function settle(input: {
    id: string
    state: Exclude<FlowState, "pending">
    error?: string
  }): Promise<Flow | undefined> {
    return mutate(async () => {
      const data = await read()
      const flow = data[input.id]
      if (!flow || flow.state !== "pending") return undefined
      flow.state = input.state
      flow.timeSettled = Date.now()
      if (input.error) flow.error = input.error
      await write(data)
      return flow
    })
  }
}
