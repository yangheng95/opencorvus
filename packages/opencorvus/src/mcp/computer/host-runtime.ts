import { randomUUID } from "node:crypto"
import { z } from "zod"
import type { CuaDriverLike } from "@trycua/cua-driver"
import { createInstanceState } from "@/project/instance-state"
import {
  closeCuaDriver,
  createCuaDriver,
  CuaComputerBackend,
  type ComputerBackend,
  type ComputerBackendAction,
} from "./backend"
import { ComputerError, computerError } from "./errors"

const HostRequest = z
  .object({
    operation: z.enum([
      "session_create",
      "observe",
      "click",
      "type_text",
      "keypress",
      "scroll",
      "drag",
      "session_destroy",
    ]),
    params: z.record(z.string(), z.unknown()),
  })
  .strict()

const Target = z
  .object({
    computer_id: z.string().min(1),
    display_id: z.string().min(1),
  })
  .strict()

const Point = z.object({ x: z.number().int(), y: z.number().int() }).strict()

const HostOperationParams = {
  session_create: z.object({}).strict(),
  observe: Target,
  click: Target.extend({ x: z.number().int(), y: z.number().int(), button: z.enum(["left", "right"]) }).strict(),
  type_text: Target.extend({ text: z.string() }).strict(),
  keypress: Target.extend({ keys: z.array(z.string().min(1)).min(1) }).strict(),
  scroll: Target.extend({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    direction: z.enum(["up", "down", "left", "right"]),
    amount: z.number().int().positive(),
  }).strict(),
  drag: Target.extend({ from: Point, to: Point, durationMs: z.number().int().positive() }).strict(),
  session_destroy: z.object({ computer_id: z.string().min(1) }).strict(),
} satisfies Record<z.infer<typeof HostRequest>["operation"], z.ZodType>

type RuntimeIdentity = {
  computerId: string
  displayId: string
  driverVersion: string
}

type RuntimeEntry = {
  runtimeScope: string
  backend?: ComputerBackend
  identity?: RuntimeIdentity
  automationAuthorization?: string
  activeRequests: Set<Promise<unknown>>
}

type RuntimeState = {
  entries: Map<string, RuntimeEntry>
  authorizations: Map<string, RuntimeEntry>
  driver?: Promise<CuaDriverLike>
  server?: ReturnType<typeof Bun.serve>
}

export type ComputerHostAdapterConfig = {
  endpoint: string
  authorization: string
  runtimeScope: string
}

type BackendFactory = (input: { runtimeScope: string }) => ComputerBackend

function bearer(request: Request): string | undefined {
  const value = request.headers.get("authorization")
  return value?.startsWith("Bearer ") ? value.slice("Bearer ".length).trim() : undefined
}

function errorResponse(error: unknown, status = 400) {
  const normalized = computerError(error)
  return Response.json(
    {
      ok: false,
      error: { code: normalized.code, message: normalized.message, details: normalized.details },
    },
    { status },
  )
}

async function disposeEntry(entry: RuntimeEntry, destroyDesktopSession: boolean): Promise<void> {
  if (!entry.backend) return
  const operations: Promise<unknown>[] = []
  if (destroyDesktopSession && entry.identity) operations.push(entry.backend.destroy({ computerId: entry.identity.computerId }))
  const destroyResults = await Promise.allSettled(operations)
  const closeResult = await Promise.allSettled([entry.backend.close()])
  const failures = [...destroyResults, ...closeResult].flatMap((result) =>
    result.status === "rejected" ? [result.reason] : [],
  )
  if (failures.length === 1) throw computerError(failures[0])
  if (failures.length > 1) {
    throw computerError(new AggregateError(failures, "Computer desktop session destruction and cleanup failed"))
  }
}

export class ComputerHostRuntimeAuthority {
  constructor(
    private readonly state: RuntimeState,
    private readonly injectedBackendFactory?: BackendFactory,
  ) {}

  private createBackend(input: { runtimeScope: string }): ComputerBackend {
    if (this.injectedBackendFactory) return this.injectedBackendFactory(input)
    const driver = (this.state.driver ??= createCuaDriver())
    return new CuaComputerBackend(driver)
  }

  private entry(input: { runtimeScope: string }): RuntimeEntry {
    const current = this.state.entries.get(input.runtimeScope)
    if (current) return current
    const created: RuntimeEntry = {
      runtimeScope: input.runtimeScope,
      activeRequests: new Set(),
    }
    this.state.entries.set(input.runtimeScope, created)
    return created
  }

  private authorize(entry: RuntimeEntry): string {
    if (entry.automationAuthorization) return entry.automationAuthorization
    const authorization = randomUUID()
    entry.automationAuthorization = authorization
    this.state.authorizations.set(authorization, entry)
    return authorization
  }

  private revoke(entry: RuntimeEntry): void {
    if (entry.automationAuthorization) this.state.authorizations.delete(entry.automationAuthorization)
    delete entry.automationAuthorization
  }

  private ensureServer(): ReturnType<typeof Bun.serve> {
    if (this.state.server) return this.state.server
    this.state.server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: (request) => this.fetch(request),
    })
    return this.state.server
  }

  adapter(input: { runtimeScope: string }): ComputerHostAdapterConfig {
    const entry = this.entry(input)
    if (entry.identity && !entry.automationAuthorization) {
      throw new ComputerError("COMPUTER_RUN_REVOKED", "Computer automation is disconnected during human takeover", {
        runtimeScope: input.runtimeScope,
        computerId: entry.identity.computerId,
        displayId: entry.identity.displayId,
      })
    }
    const server = this.ensureServer()
    return {
      endpoint: `http://127.0.0.1:${server.port}/computer/runtime`,
      authorization: this.authorize(entry),
      runtimeScope: input.runtimeScope,
    }
  }

  identity(runtimeScope: string): RuntimeIdentity {
    const identity = this.state.entries.get(runtimeScope)?.identity
    if (!identity) {
      throw new ComputerError("COMPUTER_SESSION_NOT_FOUND", "Computer session does not exist", { runtimeScope })
    }
    return identity
  }

  async takeover(input: { runtimeScope: string; computerId: string; displayId: string }) {
    const entry = this.state.entries.get(input.runtimeScope)
    const identity = this.identity(input.runtimeScope)
    this.assertIdentity(identity, input)
    this.revoke(entry!)
    await Promise.allSettled([...entry!.activeRequests])
    const preservedIdentity = this.identity(input.runtimeScope)
    this.assertIdentity(preservedIdentity, input)
    return {
      ownership: "human" as const,
      computerId: preservedIdentity.computerId,
      displayId: preservedIdentity.displayId,
      driverVersion: preservedIdentity.driverVersion,
      desktopPreserved: true as const,
    }
  }

  status(input: { runtimeScope: string; computerId: string; displayId: string }) {
    const entry = this.state.entries.get(input.runtimeScope)!
    const identity = this.identity(input.runtimeScope)
    this.assertIdentity(identity, input)
    return {
      ownership: entry.automationAuthorization ? ("agent" as const) : ("human" as const),
      computerId: identity.computerId,
      displayId: identity.displayId,
      driverVersion: identity.driverVersion,
    }
  }

  returnControl(input: { runtimeScope: string; computerId: string; displayId: string }) {
    const entry = this.state.entries.get(input.runtimeScope)!
    const identity = this.identity(input.runtimeScope)
    this.assertIdentity(identity, input)
    if (entry.automationAuthorization) {
      throw new ComputerError("COMPUTER_BACKEND_ERROR", "Computer automation already owns the desktop session", {
        runtimeScope: input.runtimeScope,
      })
    }
    this.authorize(entry)
    return {
      ownership: "agent" as const,
      computerId: identity.computerId,
      displayId: identity.displayId,
      driverVersion: identity.driverVersion,
      freshObservationRequired: true as const,
    }
  }

  private assertIdentity(identity: RuntimeIdentity, input: { computerId: string; displayId: string }) {
    if (identity.computerId !== input.computerId || identity.displayId !== input.displayId) {
      throw new ComputerError("COMPUTER_SESSION_IDENTITY_MISMATCH", "Computer takeover identity does not match", {
        expected: { computerId: identity.computerId, displayId: identity.displayId },
        actual: { computerId: input.computerId, displayId: input.displayId },
      })
    }
  }

  private async perform(entry: RuntimeEntry, request: z.infer<typeof HostRequest>) {
    const params = HostOperationParams[request.operation].parse(request.params) as Record<string, unknown>
    const operations: Record<z.infer<typeof HostRequest>["operation"], () => Promise<unknown>> = {
      session_create: async () => {
        if (entry.identity) return entry.identity
        const backend = (entry.backend ??= this.createBackend({ runtimeScope: entry.runtimeScope }))
        const identity = await backend.create()
        entry.identity = identity
        return identity
      },
      observe: async () => {
        const target = params as z.infer<typeof Target>
        return entry.backend!.observe({ computerId: target.computer_id, displayId: target.display_id })
      },
      click: () => entry.backend!.act(this.action("click", params)),
      type_text: () => entry.backend!.act(this.action("type_text", params)),
      keypress: () => entry.backend!.act(this.action("keypress", params)),
      scroll: () => entry.backend!.act(this.action("scroll", params)),
      drag: () => entry.backend!.act(this.action("drag", params)),
      session_destroy: async () => {
        const computerId = params.computer_id as string
        const result = await entry.backend!.destroy({ computerId })
        await entry.backend!.close()
        delete entry.backend
        delete entry.identity
        return result
      },
    }
    return operations[request.operation]()
  }

  private action(kind: ComputerBackendAction["kind"], params: Record<string, unknown>): ComputerBackendAction {
    const { computer_id, display_id, ...action } = params
    return {
      kind,
      computerId: computer_id as string,
      displayId: display_id as string,
      ...action,
    } as ComputerBackendAction
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/computer/runtime") {
      return new Response("Not found", { status: 404 })
    }
    const authorization = bearer(request)
    const entry = authorization ? this.state.authorizations.get(authorization) : undefined
    if (!entry || entry.automationAuthorization !== authorization) {
      return errorResponse(
        new ComputerError("COMPUTER_RUN_REVOKED", "Computer automation run is no longer authoritative"),
        403,
      )
    }
    const operation = (async () => {
      const input = HostRequest.parse(await request.json())
      return this.perform(entry, input)
    })()
    entry.activeRequests.add(operation)
    try {
      try {
        return Response.json({ ok: true, result: await operation })
      } finally {
        entry.activeRequests.delete(operation)
      }
    } catch (error) {
      return errorResponse(error)
    }
  }

  async destroy(runtimeScope: string): Promise<void> {
    const entry = this.state.entries.get(runtimeScope)
    if (!entry) return
    this.revoke(entry)
    await Promise.allSettled([...entry.activeRequests])
    await disposeEntry(entry, true)
    this.state.entries.delete(runtimeScope)
  }

  async close(): Promise<void> {
    const entries = [...this.state.entries.values()]
    for (const entry of entries) this.revoke(entry)
    await Promise.allSettled(entries.flatMap((entry) => [...entry.activeRequests]))
    const results = await Promise.allSettled(entries.map((entry) => disposeEntry(entry, true)))
    if (this.state.driver) results.push(...(await Promise.allSettled([closeCuaDriver(this.state.driver)])))
    const failures = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []))
    if (failures.length === 0) {
      this.state.entries.clear()
      this.state.authorizations.clear()
      delete this.state.driver
      await this.state.server?.stop(true)
      delete this.state.server
      return
    }
    if (failures.length === 1) throw computerError(failures[0])
    throw computerError(new AggregateError(failures, "Computer host driver cleanup failed"))
  }
}

const hostRuntimeState = createInstanceState<RuntimeState>(
  () => ({ entries: new Map(), authorizations: new Map() }),
  async (state) => new ComputerHostRuntimeAuthority(state).close(),
  "computer-host-runtime",
)

function authority() {
  return new ComputerHostRuntimeAuthority(hostRuntimeState())
}

export namespace ComputerHostRuntime {
  export function adapter(input: { runtimeScope: string }) {
    return authority().adapter(input)
  }

  export function identity(runtimeScope: string) {
    return authority().identity(runtimeScope)
  }

  export function takeover(input: { runtimeScope: string; computerId: string; displayId: string }) {
    return authority().takeover(input)
  }

  export function status(input: { runtimeScope: string; computerId: string; displayId: string }) {
    return authority().status(input)
  }

  export function returnControl(input: { runtimeScope: string; computerId: string; displayId: string }) {
    return authority().returnControl(input)
  }

  export function destroy(runtimeScope: string) {
    return authority().destroy(runtimeScope)
  }
}
