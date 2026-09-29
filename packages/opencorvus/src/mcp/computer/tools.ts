import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { HostComputerBackend } from "./host-client"
import { ComputerController, type ComputerObservation } from "./controller"
import { ComputerError, computerError } from "./errors"
import { ComputerActions, type ComputerControlBackend } from "./actions"
import { builtinGuidance } from "../../skill/builtin-guidance"

const ok = <T extends Record<string, unknown>>(data: T) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data) }],
  structuredContent: data,
})
const fail = (error: unknown) => {
  const normalized = computerError(error)
  return {
    isError: true as const,
    ...ok({ ok: false, error: { code: normalized.code, message: normalized.message, details: normalized.details } }),
  }
}
function observationResult(observed: ComputerObservation) {
  return {
    computer_id: observed.computerId,
    display_id: observed.displayId,
    observation_id: observed.observationId,
    observation_digest: observed.observationDigest,
    width: observed.width,
    height: observed.height,
    mime_type: "image/png",
  }
}
const screenshot = (observed: ComputerObservation) => ({
  type: "image" as const,
  data: observed.pngBase64,
  mimeType: "image/png" as const,
})

export function createComputerMcpServer(options: { backend?: ComputerControlBackend } = {}) {
  const server = new McpServer({ name: "opencorvus-computer", version: "1.0.0" })
  const controller = new ComputerController(options.backend ?? HostComputerBackend.fromEnvironment())
  server.registerTool(
    "help",
    {
      description:
        "Read the computer-use Skill: desktop ownership, observation bindings, ordered action groups, key/coordinate conventions and outcome recovery. Read-only; use before first interaction or when instructions are missing from context.",
      inputSchema: {},
    },
    async () => ok({ skill: "computer-use", instructions: builtinGuidance("computer-use") }),
  )
  server.registerTool(
    "session_create",
    {
      description:
        "Attach this Agent run to its host-native desktop session and return the computer-use Skill instructions. Read the returned guide before input. This controls the current physical desktop. After human takeover returns control, attach again, then observe.",
      inputSchema: {},
    },
    async () => {
      try {
        const created = await controller.create()
        return ok({
          ok: true,
          computer_id: created.computerId,
          display_id: created.displayId,
          driver_version: created.driverVersion,
          instructions: builtinGuidance("computer-use"),
        })
      } catch (error) {
        return fail(error)
      }
    },
  )
  server.registerTool(
    "observe",
    {
      description:
        "Capture and inspect the current desktop after session_create. Returns a screenshot and an exact binding for one ordered act group. Use after an uncertain outcome; copy the returned IDs/digest verbatim and use its pixel dimensions for coordinates.",
      inputSchema: { computer_id: z.string().min(1), display_id: z.string().min(1) },
    },
    async ({ computer_id, display_id }) => {
      try {
        const observed = await controller.observe({ computerId: computer_id, displayId: display_id })
        const result = ok({ ok: true, ...observationResult(observed) })
        return { ...result, content: [screenshot(observed), ...result.content] }
      } catch (error) {
        return fail(error)
      }
    },
  )
  server.registerTool(
    "act",
    {
      description:
        "Execute an ordered group of predictable desktop inputs under one current observation binding, then return a fresh screenshot/binding. A single input uses a one-element array. End the group where another visual decision is needed. The receipt records the completed prefix and failed action; inspect it before continuing and never replay unknown effects. Respect the user's authorization for irreversible external actions.",
      inputSchema: {
        computer_id: z.string().min(1),
        display_id: z.string().min(1),
        observation_id: z.string().min(1),
        observation_digest: z.string().regex(/^[a-f0-9]{64}$/),
        actions: ComputerActions,
      },
    },
    async (input) => {
      try {
        const acted = await controller.act(
          {
            computerId: input.computer_id,
            displayId: input.display_id,
            observationId: input.observation_id,
            observationDigest: input.observation_digest,
          },
          input.actions,
        )
        const result = ok({
          ok: !acted.failedAction && !acted.observationError,
          computer_id: acted.computerId,
          display_id: acted.displayId,
          source_observation_id: acted.sourceObservationId,
          completed_actions: acted.completedActions,
          ...(acted.failedAction ? { failed_action: acted.failedAction } : {}),
          ...(acted.observationError ? { observation_error: acted.observationError } : {}),
          ...(acted.observation ? { observation: observationResult(acted.observation) } : {}),
        })
        return {
          ...result,
          ...(result.structuredContent.ok ? {} : { isError: true as const }),
          content: [...(acted.observation ? [screenshot(acted.observation)] : []), ...result.content],
        }
      } catch (error) {
        return fail(error)
      }
    },
  )
  server.registerTool(
    "session_destroy",
    {
      description:
        "End this exact logical desktop session and return its receipt. The user's apps remain open. The current adapter can create another logical session later.",
      inputSchema: { computer_id: z.string().min(1) },
    },
    async ({ computer_id }) => {
      try {
        return ok({ ok: true, ...(await controller.destroy({ computerId: computer_id })) })
      } catch (error) {
        return fail(error)
      }
    },
  )
  return { server, controller }
}
export function computerToolErrorCode(error: unknown): ComputerError["code"] {
  return computerError(error).code
}
