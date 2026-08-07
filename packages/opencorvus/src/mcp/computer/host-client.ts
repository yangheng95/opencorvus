import { z } from "zod"
import type { ComputerBackend, ComputerBackendAction, ComputerBackendObservation } from "./backend"
import { ComputerError, ComputerErrorCode } from "./errors"

const HostResponse = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), result: z.unknown() }).strict(),
  z
    .object({
      ok: z.literal(false),
      error: z
        .object({
          code: ComputerErrorCode,
          message: z.string().min(1),
          details: z.record(z.string(), z.unknown()),
        })
        .strict(),
    })
    .strict(),
])

const Created = z.object({ computerId: z.string(), displayId: z.string(), driverVersion: z.string() }).strict()
const Observed = z.object({ computerId: z.string(), displayId: z.string(), pngBase64: z.string() }).strict()
const Acted = z.object({ accepted: z.literal(true), backendActionId: z.string() }).strict()
const Destroyed = z.object({ destroyed: z.literal(true) }).strict()

type OperationEffect = "read" | "effect"

export class HostComputerBackend implements ComputerBackend {
  constructor(
    private readonly endpoint: string,
    private readonly authorization: string,
    private readonly runtimeScope: string,
    private readonly requestFetch: typeof globalThis.fetch = globalThis.fetch,
  ) {}

  static fromEnvironment(environment: NodeJS.ProcessEnv = process.env) {
    const endpoint = environment.OPENCORVUS_COMPUTER_HOST_ENDPOINT?.trim()
    const authorization = environment.OPENCORVUS_COMPUTER_HOST_AUTHORIZATION?.trim()
    const runtimeScope = environment.OPENCORVUS_COMPUTER_RUNTIME_SCOPE?.trim()
    if (!endpoint || !authorization || !runtimeScope) {
      throw new ComputerError(
        "COMPUTER_BACKEND_ERROR",
        "Computer MCP adapter requires one host-owned runtime authority",
      )
    }
    return new HostComputerBackend(endpoint, authorization, runtimeScope)
  }

  private async request<T>(
    operation: string,
    params: Record<string, unknown>,
    schema: z.ZodType<T>,
    effect: OperationEffect,
  ): Promise<T> {
    let response: Response
    try {
      response = await this.requestFetch(this.endpoint, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.authorization}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ operation, params }),
      })
    } catch (error) {
      throw new ComputerError(
        effect === "effect" ? "COMPUTER_OUTCOME_UNKNOWN" : "COMPUTER_BACKEND_ERROR",
        "Computer host runtime response was lost",
        { operation, runtimeScope: this.runtimeScope },
        error instanceof Error ? { cause: error } : undefined,
      )
    }
    let body: z.infer<typeof HostResponse>
    try {
      body = HostResponse.parse(await response.json())
    } catch (error) {
      throw new ComputerError(
        effect === "effect" ? "COMPUTER_OUTCOME_UNKNOWN" : "COMPUTER_BACKEND_ERROR",
        "Computer host runtime returned an invalid response",
        { operation, runtimeScope: this.runtimeScope, status: response.status },
        error instanceof Error ? { cause: error } : undefined,
      )
    }
    if (!body.ok) {
      throw new ComputerError(body.error.code, body.error.message, body.error.details)
    }
    try {
      return schema.parse(body.result)
    } catch (error) {
      throw new ComputerError(
        effect === "effect" ? "COMPUTER_OUTCOME_UNKNOWN" : "COMPUTER_BACKEND_ERROR",
        "Computer host runtime result violated the adapter contract",
        { operation, runtimeScope: this.runtimeScope },
        error instanceof Error ? { cause: error } : undefined,
      )
    }
  }

  create() {
    return this.request("session_create", {}, Created, "effect")
  }

  observe(input: { computerId: string; displayId: string }): Promise<ComputerBackendObservation> {
    return this.request("observe", { computer_id: input.computerId, display_id: input.displayId }, Observed, "read")
  }

  act(action: ComputerBackendAction) {
    const { computerId, displayId, kind, ...params } = action
    return this.request(kind, { ...params, computer_id: computerId, display_id: displayId }, Acted, "effect")
  }

  destroy(input: { computerId: string }) {
    return this.request("session_destroy", { computer_id: input.computerId }, Destroyed, "effect")
  }

  // The host owns the native desktop session. Closing one MCP adapter only
  // releases that adapter's local controller state.
  async close() {}
}
