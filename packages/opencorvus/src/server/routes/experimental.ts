import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import { ToolRegistry } from "../../tool/registry"
import { Worktree } from "../../worktree"
import { Workspace } from "../../workspace/workspace"
import { MCP } from "../../mcp"
import { Instance } from "../../project/instance"
import { Project } from "../../project/project"
import { TaskPlan } from "../../memory/task-plan"
import { SessionMemory } from "../../memory/session-memory"
import { EventService } from "../../scheduler/event-service"
import { Session } from "../../session"
import { zodToJsonSchema } from "zod-to-json-schema"
import { errors, namedErrorResponse } from "../error"
import { lazy } from "../../util/lazy"
import { NotFoundError } from "../../storage/db"
import { assertActiveProjectSession } from "../active-project-session"

// Workspace shape for the workspace sub-tree (mounted at /workspace)
const WorkspaceRoutes = lazy(() =>
  new Hono()
    .post(
      "/:id",
      describeRoute({
        summary: "Create workspace",
        description: "Create a workspace for the current project.",
        operationId: "experimental.workspace.create",
        responses: {
          200: {
            description: "Workspace created",
            content: { "application/json": { schema: resolver(Workspace.Info) } },
          },
          ...errors(400),
        },
      }),
      validator(
        "param",
        z.object({
          id: Workspace.Info.shape.id,
        }),
      ),
      validator("json", z.object({}).strict()),
      async (c) => {
        const { id } = c.req.valid("param")
        const workspace = await Workspace.create({
          id,
          projectID: Instance.project.id,
        })
        return c.json(workspace)
      },
    )
    .get(
      "/",
      describeRoute({
        summary: "List workspaces",
        description: "List all workspaces.",
        operationId: "experimental.workspace.list",
        responses: {
          200: {
            description: "Workspaces",
            content: { "application/json": { schema: resolver(z.array(Workspace.Info)) } },
          },
        },
      }),
      async (c) => {
        return c.json(Workspace.list(Instance.project))
      },
    )
    .delete(
      "/:id",
      describeRoute({
        summary: "Remove workspace",
        description: "Remove an existing workspace.",
        operationId: "experimental.workspace.remove",
        responses: {
          200: {
            description: "Workspace removed",
            content: { "application/json": { schema: resolver(Workspace.Info) } },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          id: Workspace.Info.shape.id,
        }),
      ),
      async (c) => {
        const { id } = c.req.valid("param")
        return c.json(await Workspace.remove({ id, projectID: Instance.project.id }))
      },
    ),
)

const EventJobView = z.object({
  id: z.string(),
  name: z.string(),
  eventType: z.string(),
  match: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  prompt: z.string(),
  enabled: z.boolean(),
  oneShot: z.boolean(),
  cooldownMs: z.number(),
  lastRun: z.number().nullable(),
  lastEvent: z.string().nullable(),
})

const ProjectScopedRouteQuery = z
  .object({
    directory: z.string().optional(),
  })
  .strict()

const CreateEventScheduleBody = z
  .object({
    name: z.string(),
    eventType: z.string(),
    match: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    prompt: z.string(),
    sessionId: z.string().optional(),
    oneShot: z.boolean().optional(),
    cooldownMs: z.number().int().min(0).optional(),
  })
  .strict()

export const ExperimentalRoutes = lazy(() =>
  new Hono()
    // === tool / worktree ===
    .get(
      "/tool/ids",
      describeRoute({
        summary: "List tool IDs",
        description: "Get the built-in core registry tool IDs. This is not an active runtime capability projection.",
        operationId: "tool.ids",
        responses: {
          200: {
            description: "Tool IDs",
            content: {
              "application/json": {
                schema: resolver(z.array(z.string()).meta({ ref: "ToolIDs" })),
              },
            },
          },
          ...errors(400),
        },
      }),
      async (c) => {
        return c.json(await ToolRegistry.ids())
      },
    )
    .get(
      "/tool",
      describeRoute({
        summary: "List tools",
        description:
          "Get built-in core registry tool definitions for a provider and model. Active package and MCP tools are projected separately at runtime.",
        operationId: "tool.list",
        responses: {
          200: {
            description: "Tools",
            content: {
              "application/json": {
                schema: resolver(
                  z
                    .array(
                      z
                        .object({
                          id: z.string(),
                          description: z.string(),
                          parameters: z.unknown(),
                        })
                        .meta({ ref: "ToolListItem" }),
                    )
                    .meta({ ref: "ToolList" }),
                ),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "query",
        z.object({
          provider: z.string(),
          model: z.string(),
        }),
      ),
      async (c) => {
        const { provider, model } = c.req.valid("query")
        const tools = await ToolRegistry.tools({ providerID: provider, modelID: model })
        return c.json(
          tools.map((t) => ({
            id: t.id,
            description: t.description,
            // Handle both Zod schemas and plain JSON schemas
            parameters: (t.parameters as any)?._def ? zodToJsonSchema(t.parameters as any) : t.parameters,
          })),
        )
      },
    )
    .post(
      "/worktree",
      describeRoute({
        summary: "Create worktree",
        description: "Create a new git worktree for the current project and run any configured startup scripts.",
        operationId: "worktree.create",
        responses: {
          200: {
            description: "Worktree created",
            content: { "application/json": { schema: resolver(Worktree.Info) } },
          },
          ...errors(400),
        },
      }),
      validator("json", Worktree.create.schema),
      async (c) => {
        const body = c.req.valid("json")
        const worktree = await Worktree.create(body)
        return c.json(worktree)
      },
    )
    .route("/workspace", WorkspaceRoutes())
    .get(
      "/worktree",
      describeRoute({
        summary: "List worktrees",
        description: "List all sandbox worktrees for the current project.",
        operationId: "worktree.list",
        responses: {
          200: {
            description: "List of worktree directories",
            content: { "application/json": { schema: resolver(z.array(z.string())) } },
          },
        },
      }),
      async (c) => {
        const sandboxes = await Project.sandboxes(Instance.project.id)
        return c.json(sandboxes)
      },
    )
    .delete(
      "/worktree",
      describeRoute({
        summary: "Remove worktree",
        description: "Remove a git worktree and delete its branch.",
        operationId: "worktree.remove",
        responses: {
          200: {
            description: "Worktree removed",
            content: { "application/json": { schema: resolver(z.boolean()) } },
          },
          ...errors(400, 404),
        },
      }),
      validator("json", Worktree.remove.schema),
      async (c) => {
        const body = c.req.valid("json")
        await Worktree.removeProjectWorktree(body)
        return c.json(true)
      },
    )
    .post(
      "/worktree/reset",
      describeRoute({
        summary: "Reset worktree",
        description: "Reset a worktree branch to the primary default branch.",
        operationId: "worktree.reset",
        responses: {
          200: {
            description: "Worktree reset",
            content: { "application/json": { schema: resolver(z.boolean()) } },
          },
          ...errors(400, 404),
        },
      }),
      validator("json", Worktree.reset.schema),
      async (c) => {
        const body = c.req.valid("json")
        await Worktree.resetProjectWorktree(body)
        return c.json(true)
      },
    )
    // === event schedule (delegates to scheduler service layer) ===
    .get(
      "/event-schedule",
      describeRoute({
        summary: "List event-triggered tasks",
        operationId: "experimental.eventschedule.list",
        responses: {
          200: {
            description: "Event-triggered tasks",
            content: { "application/json": { schema: resolver(z.array(EventJobView)) } },
          },
          ...errors(400),
        },
      }),
      validator("query", ProjectScopedRouteQuery),
      async (c) => {
        return c.json(EventService.list(Instance.project.id))
      },
    )
    .post(
      "/event-schedule",
      describeRoute({
        summary: "Create event-triggered task",
        operationId: "experimental.eventschedule.create",
        responses: {
          200: {
            description: "Created event task",
            content: {
              "application/json": {
                schema: resolver(z.object({ id: z.string(), name: z.string(), eventType: z.string() })),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("json", CreateEventScheduleBody),
      async (c) => {
        const body = c.req.valid("json")
        return c.json(await EventService.create({ ...body, projectId: Instance.project.id }))
      },
    )
    .delete(
      "/event-schedule/:id",
      describeRoute({
        summary: "Cancel event-triggered task",
        operationId: "experimental.eventschedule.delete",
        responses: {
          200: {
            description: "Cancelled",
            content: { "application/json": { schema: resolver(z.object({ ok: z.boolean() })) } },
          },
          ...errors(400, 404),
        },
      }),
      validator("query", ProjectScopedRouteQuery),
      async (c) => {
        const id = c.req.param("id")
        if (!EventService.remove(id, Instance.project.id)) {
          throw new NotFoundError({ message: `Event task not found: ${id}` })
        }
        return c.json({ ok: true })
      },
    )
    // === memory view (read-only inspection) ===
    .get(
      "/task-plan",
      describeRoute({
        summary: "List tasks for a session",
        operationId: "experimental.taskplan.list",
        responses: {
          200: {
            description: "Tasks",
            content: {
              "application/json": {
                schema: resolver(
                  z.array(
                    z.object({
                      id: z.string(),
                      goal: z.string(),
                      status: z.string(),
                      parentID: z.string().nullable(),
                      progressPct: z.number(),
                    }),
                  ),
                ),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("query", z.object({ sessionId: z.string() })),
      async (c) => {
        const { sessionId } = c.req.valid("query")
        await assertActiveProjectSession(sessionId)
        return c.json(TaskPlan.list(sessionId))
      },
    )
    .get(
      "/memory",
      describeRoute({
        summary: "Get the Session MEMORY.MD document",
        operationId: "experimental.memory.get",
        responses: {
          200: {
            description: "Session MEMORY.MD",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    filename: z.literal("MEMORY.MD"),
                    sourceMessageID: z.string().nullable(),
                    content: z.string(),
                    timeCreated: z.number().nullable(),
                    timeUpdated: z.number().nullable(),
                  }),
                ),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("query", z.object({ sessionId: z.string() })),
      async (c) => {
        const { sessionId } = c.req.valid("query")
        await assertActiveProjectSession(sessionId)
        const document = await SessionMemory.read(sessionId)
        return c.json({
          filename: SessionMemory.filename,
          sourceMessageID: document?.sourceMessageID ?? null,
          content: document?.content ?? "",
          timeCreated: document?.timeCreated ?? null,
          timeUpdated: document?.timeUpdated ?? null,
        })
      },
    )
    // === MCP resources ===
    .get(
      "/resource",
      describeRoute({
        summary: "Get MCP resources",
        description: "Get all available MCP resources from connected servers. Optionally filter by name.",
        operationId: "experimental.resource.list",
        responses: {
          200: {
            description: "MCP resources",
            content: { "application/json": { schema: resolver(z.record(z.string(), MCP.Resource)) } },
          },
          500: namedErrorResponse("MCP resources failed", "UnknownError"),
        },
      }),
      async (c) => {
        return c.json(await MCP.resources())
      },
    ),
)

export function resetExperimentalRouteFactoriesForOpenApi() {
  WorkspaceRoutes.reset()
  ExperimentalRoutes.reset()
}
