import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { ComputerBackend } from "./backend"
import { HostComputerBackend } from "./host-client"
import { ComputerController, type ObservationBinding } from "./controller"
import { ComputerError, computerError } from "./errors"

const ok = <T extends Record<string, unknown>>(data: T) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data) }],
  structuredContent: data,
})

const fail = (error: unknown) => {
  const normalized = computerError(error)
  const data = {
    ok: false,
    error: {
      code: normalized.code,
      message: normalized.message,
      details: normalized.details,
    },
  }
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
    structuredContent: data,
  }
}

const bindingSchema = {
  computer_id: z.string().min(1),
  display_id: z.string().min(1),
  observation_id: z.string().min(1),
  observation_digest: z.string().regex(/^[a-f0-9]{64}$/),
}

const userAuthority =
  "Stop before any irreversible external effect and leave the final confirmation or control to the user on the current desktop."

function binding(input: {
  computer_id: string
  display_id: string
  observation_id: string
  observation_digest: string
}): ObservationBinding {
  return {
    computerId: input.computer_id,
    displayId: input.display_id,
    observationId: input.observation_id,
    observationDigest: input.observation_digest,
  }
}

function withError<T extends Record<string, unknown>>(run: () => Promise<T>) {
  return run().then(ok, fail)
}

export function createComputerMcpServer(options: { backend?: ComputerBackend } = {}) {
  const server = new McpServer({ name: "opencorvus-computer", version: "1.0.0" })
  const controller = new ComputerController(options.backend ?? HostComputerBackend.fromEnvironment())

  server.registerTool(
    "session_create",
    {
      description:
        "Establish this Agent run's OpenCorvus-owned CUA Driver session on the user's current desktop. On first use this creates the host-owned desktop session; after human takeover returns control, call this same visible tool to attach the new Agent run to the preserved session before observe. This creates logical Agent authority, not a Virtual Machine or a second desktop.",
      inputSchema: {},
    },
    async () =>
      withError(async () => {
        const created = await controller.create()
        return {
          ok: true,
          computer_id: created.computerId,
          display_id: created.displayId,
          driver_version: created.driverVersion,
        }
      }),
  )

  server.registerTool(
    "observe",
    {
      description:
        "Capture the current desktop. A new Agent run after human takeover must first attach with session_create, then observe before any input. Later input must repeat the exact returned computer, display, observation, and digest identities.",
      inputSchema: {
        computer_id: z.string().min(1),
        display_id: z.string().min(1),
      },
    },
    async ({ computer_id, display_id }) => {
      try {
        const observed = await controller.observe({ computerId: computer_id, displayId: display_id })
        const structuredContent = {
          ok: true,
          computer_id: observed.computerId,
          display_id: observed.displayId,
          observation_id: observed.observationId,
          observation_digest: observed.observationDigest,
          width: observed.width,
          height: observed.height,
          mime_type: "image/png",
        }
        return {
          content: [
            { type: "image" as const, data: observed.pngBase64, mimeType: "image/png" as const },
            { type: "text" as const, text: JSON.stringify(structuredContent) },
          ],
          structuredContent,
        }
      } catch (error) {
        return fail(error)
      }
    },
  )

  server.registerTool(
    "click",
    {
      description: `Send exactly one click to the exact observed desktop. This does not observe or retry. ${userAuthority}`,
      inputSchema: {
        ...bindingSchema,
        x: z.number().int().nonnegative(),
        y: z.number().int().nonnegative(),
        button: z.enum(["left", "right"]).default("left"),
      },
    },
    async (input) =>
      withError(async () => ({
        ok: true,
        ...(await controller.act(binding(input), {
          kind: "click",
          x: input.x,
          y: input.y,
          button: input.button,
        })),
      })),
  )

  server.registerTool(
    "type_text",
    {
      description: `Type exact text into the desktop bound to the exact latest observation. This does not observe or retry. ${userAuthority}`,
      inputSchema: { ...bindingSchema, text: z.string().max(100_000) },
    },
    async (input) =>
      withError(async () => ({
        ok: true,
        ...(await controller.act(binding(input), { kind: "type_text", text: input.text })),
      })),
  )

  server.registerTool(
    "keypress",
    {
      description: `Send one explicit key chord to the exact observed desktop. This does not observe or retry. ${userAuthority}`,
      inputSchema: { ...bindingSchema, keys: z.array(z.string().min(1)).min(1).max(8) },
    },
    async (input) =>
      withError(async () => ({
        ok: true,
        ...(await controller.act(binding(input), { kind: "keypress", keys: input.keys })),
      })),
  )

  server.registerTool(
    "scroll",
    {
      description: `Scroll once at an exact point on the observed desktop. This does not observe or retry. ${userAuthority}`,
      inputSchema: {
        ...bindingSchema,
        x: z.number().int().nonnegative(),
        y: z.number().int().nonnegative(),
        direction: z.enum(["up", "down", "left", "right"]),
        amount: z.number().int().min(1).max(100),
      },
    },
    async (input) =>
      withError(async () => ({
        ok: true,
        ...(await controller.act(binding(input), {
          kind: "scroll",
          x: input.x,
          y: input.y,
          direction: input.direction,
          amount: input.amount,
        })),
      })),
  )

  server.registerTool(
    "drag",
    {
      description: `Send one bounded drag to the exact observed desktop. This does not observe or retry. ${userAuthority}`,
      inputSchema: {
        ...bindingSchema,
        from_x: z.number().int().nonnegative(),
        from_y: z.number().int().nonnegative(),
        to_x: z.number().int().nonnegative(),
        to_y: z.number().int().nonnegative(),
        duration_ms: z.number().int().min(50).max(10_000).default(500),
      },
    },
    async (input) =>
      withError(async () => ({
        ok: true,
        ...(await controller.act(binding(input), {
          kind: "drag",
          from: { x: input.from_x, y: input.from_y },
          to: { x: input.to_x, y: input.to_y },
          durationMs: input.duration_ms,
        })),
      })),
  )

  server.registerTool(
    "session_destroy",
    {
      description:
        "End the exact CUA Driver desktop session. This does not disconnect the visible MCP adapter; the same Agent run may establish a new session later with session_create.",
      inputSchema: { computer_id: z.string().min(1) },
    },
    async ({ computer_id }) =>
      withError(async () => ({ ok: true, ...(await controller.destroy({ computerId: computer_id })) })),
  )

  return { server, controller }
}

export function computerToolErrorCode(error: unknown): ComputerError["code"] {
  return computerError(error).code
}
