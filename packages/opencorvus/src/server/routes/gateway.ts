import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { ChannelId } from "@/channel/catalog"
import { ChannelIngress, ChannelIngressInput, ChannelIngressResult } from "@/channel/ingress"
import { ChannelSupervisor } from "@/channel/supervisor"
import { ControlMessage } from "@/control/message"
import { ControlMessageInput, ControlMessageResult } from "@/control/message-schema"
import { EngineService } from "@/task-api"
import { Instance } from "@/project/instance"
import { PanelActionSchema, PanelCapabilityResponse, panelCapabilities } from "@/panel/capability"
import { createPanelUIRequestToolContext, PanelTool } from "@/tool/panel"
import { requestID as resolveRequestID } from "@/server/error-handler"

const GatewayControlMessageInput = ControlMessageInput.omit({ surface: true }).extend({
  surface: z.literal("gateway").optional(),
})

const GatewayStatsQuery = z.object({
  directory: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
})

const GatewayActionResult = z.object({
  title: z.string(),
  output: z.string(),
  metadata: z.record(z.string(), z.unknown()),
})

const GatewayStats = z.object({
  generatedAt: z.number(),
  project: z.object({
    id: z.string(),
    name: z.string().optional(),
    worktree: z.string(),
    directory: z.string(),
  }),
  tasks: z.object({
    total: z.number(),
    status: z.record(z.string(), z.number()),
    summary: z.unknown(),
    recent: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        status: z.string(),
        priority: z.string().optional(),
        directory: z.string().optional(),
        updated: z.number().optional(),
      }),
    ),
  }),
  capabilities: z.object({
    total: z.number(),
    queries: z.number(),
    mutations: z.number(),
  }),
  channelRuntime: z.object({
    running: z.boolean(),
    status: z.string(),
    channels: z.array(z.string()),
    detail: z.string().optional(),
  }),
})

// Lazy schema factory — defers `ChannelIngressInput.omit(...)` evaluation so
// the construction does NOT run at module load. The eager top-level `const`
// previously crashed when something imported `ChannelIngress` (or other
// channel/ingress.ts members) before `gateway.ts` finished its own load: at
// that moment `ChannelIngressInput` is still in TDZ inside channel/ingress.ts
// and `.omit()` throws ReferenceError. The fix is structural — call the
// factory inside the route registration, where the import cycle has settled.
let _gatewayChannelMessageInputCache: ReturnType<typeof buildGatewayChannelMessageInput> | undefined
function buildGatewayChannelMessageInput() {
  return ChannelIngressInput.omit({ platform: true }).extend({
    platform: ChannelId.optional(),
  })
}
function getGatewayChannelMessageInput() {
  if (!_gatewayChannelMessageInputCache) {
    _gatewayChannelMessageInputCache = buildGatewayChannelMessageInput()
  }
  return _gatewayChannelMessageInputCache
}

function countByStatus(tasks: Array<{ task?: { status?: string } }>) {
  const result: Record<string, number> = {}
  for (const item of tasks) {
    const status = item.task?.status ?? "unknown"
    result[status] = (result[status] ?? 0) + 1
  }
  return result
}

async function gatewayStats(input: z.infer<typeof GatewayStatsQuery>) {
  const [board, runtime] = await Promise.all([
    EngineService.getGlobalTaskBoard({ directory: input.directory, limit: input.limit }),
    ChannelSupervisor.status(),
  ])
  const actions = panelCapabilities("gateway").actions
  return GatewayStats.parse({
    generatedAt: Date.now(),
    project: {
      id: Instance.project.id,
      name: Instance.project.name,
      worktree: Instance.project.worktree,
      directory: Instance.directory,
    },
    tasks: {
      total: board.tasks.length,
      status: countByStatus(board.tasks),
      summary: board.summary,
      recent: board.tasks.slice(0, 12).map((item) => ({
        id: item.task.id,
        title: item.task.title,
        status: item.task.status,
        priority: item.task.priority,
        directory: item.task.directory,
        updated: item.task.time?.updated,
      })),
    },
    capabilities: {
      total: actions.length,
      queries: actions.filter((item) => item.kind === "query").length,
      mutations: actions.filter((item) => item.kind === "mutation").length,
    },
    channelRuntime: {
      running: runtime.running,
      status: runtime.status,
      channels: runtime.channels,
      detail: runtime.detail,
    },
  })
}

export function GatewayRoutes() {
  return new Hono()
    .get(
      "/capabilities",
      describeRoute({
        summary: "List gateway capabilities",
        description: "Return control-plane actions available to remote/mobile gateway clients.",
        operationId: "gateway.capabilities",
        responses: {
          200: {
            description: "Gateway capabilities",
            content: { "application/json": { schema: resolver(PanelCapabilityResponse) } },
          },
        },
      }),
      async (c) => c.json(panelCapabilities("gateway")),
    )
    .get(
      "/stats",
      describeRoute({
        summary: "Get gateway stats",
        description: "Read-only project/task/channel summary for gateway panels.",
        operationId: "gateway.stats",
        responses: {
          200: {
            description: "Gateway stats",
            content: { "application/json": { schema: resolver(GatewayStats) } },
          },
        },
      }),
      validator("query", GatewayStatsQuery),
      async (c) => c.json(await gatewayStats(c.req.valid("query"))),
    )
    .post(
      "/control/message",
      describeRoute({
        summary: "Handle gateway control message",
        description: "Route a remote/mobile natural-language control message through the shared control plane.",
        operationId: "gateway.control.message",
        responses: {
          200: {
            description: "Control message handled",
            content: { "application/json": { schema: resolver(ControlMessageResult) } },
          },
        },
      }),
      validator("json", GatewayControlMessageInput),
      async (c) => {
        const input = c.req.valid("json")
        return c.json(
          await ControlMessage.handle({
            ...input,
            surface: "gateway",
            source: input.source ?? "gateway",
          }),
        )
      },
    )
    .post(
      "/control/action",
      describeRoute({
        summary: "Run gateway control action",
        description: "Execute a structured gateway capability action without LLM interpretation.",
        operationId: "gateway.control.action",
        responses: {
          200: {
            description: "Action result",
            content: { "application/json": { schema: resolver(GatewayActionResult) } },
          },
        },
      }),
      validator("json", PanelActionSchema),
      async (c) => {
        const action = c.req.valid("json")
        const allowed = new Set(panelCapabilities("gateway").actions.map((item) => item.action))
        if (!allowed.has(action.action)) {
          throw new HTTPException(403, { message: `Gateway action is not allowed: ${action.action}` })
        }
        const requestID = resolveRequestID(c)
        c.header("x-opencorvus-request-id", requestID)
        const tool = await PanelTool.init({ agentID: "panel_ui" })
        const result = await tool.execute(
          action,
          createPanelUIRequestToolContext({
            surface: "gateway",
            requestID,
          }),
        )
        return c.json(
          GatewayActionResult.parse({
            title: result.title,
            output: result.output,
            metadata: result.metadata ?? {},
          }),
        )
      },
    )
    .post(
      "/channel/:platform/message",
      describeRoute({
        summary: "Handle gateway channel message",
        description: "Bridge an external channel message through gateway routing into the shared channel ingress path.",
        operationId: "gateway.channel.message",
        responses: {
          200: {
            description: "Channel message handled",
            content: { "application/json": { schema: resolver(ChannelIngressResult) } },
          },
        },
      }),
      validator("json", getGatewayChannelMessageInput()),
      async (c) => {
        const platform = ChannelId.parse(c.req.param("platform"))
        const input = c.req.valid("json")
        return c.json(
          await ChannelIngress.message({
            ...input,
            platform,
            source: input.source ?? `gateway:${platform}`,
          }),
        )
      },
    )
}
