import { z } from "zod"
import type { ComputerBackend, ComputerBackendObservation } from "./backend"
import { ComputerErrorCode, computerError } from "./errors"

const point = z.object({ x: z.number().int().nonnegative(), y: z.number().int().nonnegative() }).strict()
export const ComputerAction = z.discriminatedUnion("kind", [
  point.extend({ kind: z.literal("click"), button: z.enum(["left", "right"]).default("left") }).strict(),
  z.object({ kind: z.literal("type_text"), text: z.string().max(100_000) }).strict(),
  z.object({ kind: z.literal("keypress"), keys: z.array(z.string().min(1)).min(1).max(8) }).strict(),
  point
    .extend({
      kind: z.literal("scroll"),
      direction: z.enum(["up", "down", "left", "right"]),
      amount: z.number().int().min(1).max(100).describe("Number of lines to scroll."),
    })
    .strict(),
  z
    .object({
      kind: z.literal("drag"),
      from: point,
      to: point,
      durationMs: z.number().int().min(50).max(10_000).default(500),
    })
    .strict(),
])
export type ComputerAction = z.infer<typeof ComputerAction>
export const ComputerActions = z.array(ComputerAction).min(1)
const failure = z
  .object({ code: ComputerErrorCode, message: z.string(), details: z.record(z.string(), z.unknown()) })
  .strict()
export const BackendObservation = z
  .object({ computerId: z.string(), displayId: z.string(), pngBase64: z.string() })
  .strict()
export const ComputerActionResult = z
  .object({
    completedActions: z.array(
      z
        .object({
          index: z.number().int().nonnegative(),
          kind: z.enum(ComputerAction.options.map((action) => action.shape.kind.value)),
          backendActionId: z.string(),
        })
        .strict(),
    ),
    failedAction: z.object({ index: z.number().int().nonnegative(), error: failure }).strict().optional(),
    observation: BackendObservation.optional(),
    observationError: failure.optional(),
  })
  .strict()
export type ComputerActionResult = z.infer<typeof ComputerActionResult>
export type ComputerActionRequest = { computerId: string; displayId: string; actions: ComputerAction[] }

/** The MCP controller talks to a host-owned group transaction, not individual driver inputs. */
export interface ComputerControlBackend {
  create(): ReturnType<ComputerBackend["create"]>
  observe(input: { computerId: string; displayId: string }): Promise<ComputerBackendObservation>
  act(input: ComputerActionRequest): Promise<ComputerActionResult>
  destroy(input: { computerId: string }): ReturnType<ComputerBackend["destroy"]>
  close(): Promise<void>
}

function detail(error: unknown) {
  const value = computerError(error)
  return { code: value.code, message: value.message, details: value.details }
}

/** Called only while the host owns the desktop operation lease. Never retries an input. */
export async function performComputerActions(
  backend: ComputerBackend,
  input: ComputerActionRequest,
  signal?: AbortSignal,
): Promise<ComputerActionResult> {
  const result: ComputerActionResult = { completedActions: [] }
  for (const [index, action] of input.actions.entries()) {
    try {
      signal?.throwIfAborted()
      const receipt = await backend.act({ ...action, computerId: input.computerId, displayId: input.displayId })
      result.completedActions.push({ index, kind: action.kind, backendActionId: receipt.backendActionId })
    } catch (error) {
      result.failedAction = { index, error: detail(error) }
      break
    }
  }
  try {
    signal?.throwIfAborted()
    result.observation = await backend.observe(input)
  } catch (error) {
    result.observationError = detail(error)
  }
  return result
}
