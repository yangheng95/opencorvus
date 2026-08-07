import { findInteractiveArtifact, McpAppLifecycleChanged } from "@/interactive-artifact/persist"
import { InteractiveArtifactRecord } from "@/interactive-artifact/schema"
import { handleMcpAppHostRequest, McpAppHostRequest } from "@/interactive-artifact/mcp-app-host"
import { GlobalBus } from "@/bus/global"
import { MCP } from "@/mcp"
import { Instance } from "@/project/instance"
import { NotFoundError } from "@/storage/db"
import { lazy } from "@/util/lazy"
import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { errors, namedErrorResponse } from "../error"
import { streamProjectSSE } from "../sse"

const McpAppHostEvent = z
  .object({
    type: z.enum([
      "mcp-app.connected",
      "mcp-app.heartbeat",
      "mcp-app.lifecycle_changed",
      "tools/list_changed",
      "resources/list_changed",
      "prompts/list_changed",
    ]),
    serverID: z.string().optional(),
    artifactID: z.string().optional(),
  })
  .strict()
  .meta({ ref: "McpAppHostEvent" })

export const InteractiveArtifactRoutes = lazy(() =>
  new Hono()
    .get(
      "/session/:sessionID/interactive-artifact/:artifactID",
      describeRoute({
        summary: "Read session interactive artifact",
        description:
          "Return one message-owned interactive artifact from the producing session. The artifact payload is the only renderer content source.",
        operationId: "interactiveArtifact.readSessionArtifact",
        responses: {
          200: {
            description: "Interactive artifact",
            content: {
              "application/json": {
                schema: resolver(InteractiveArtifactRecord),
              },
            },
          },
          ...errors(400, 404),
          500: namedErrorResponse("Interactive artifact payload is corrupt", "InteractiveArtifactCorruptionError"),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().min(1),
          artifactID: z.string().min(1),
        }),
      ),
      async (c) => {
        const { sessionID, artifactID } = c.req.valid("param")
        const artifact = findInteractiveArtifact({
          sessionID,
          artifactID,
          projectID: Instance.project.id,
        })
        if (!artifact) throw new NotFoundError({ message: `Interactive artifact not found: ${artifactID}` })
        c.header("Cache-Control", "no-store")
        return c.json(artifact)
      },
    )
    .post(
      "/session/:sessionID/interactive-artifact/:artifactID/mcp-app/request",
      describeRoute({
        summary: "Forward an MCP App request",
        description:
          "Forward one stable MCP Apps request through the exact MCP server binding owned by the message artifact. The client cannot select a server.",
        operationId: "interactiveArtifact.requestMcpApp",
        responses: {
          200: {
            description: "MCP protocol result",
            content: {
              "application/json": {
                schema: resolver(z.unknown()),
              },
            },
          },
          ...errors(400, 404, 500),
          403: namedErrorResponse("MCP App request is outside the bound authority", "McpAppHostForbiddenError"),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().min(1),
          artifactID: z.string().min(1),
        }),
      ),
      validator("json", McpAppHostRequest),
      async (c) => {
        const { sessionID, artifactID } = c.req.valid("param")
        return c.json(
          await handleMcpAppHostRequest({
            sessionID,
            artifactID,
            request: c.req.valid("json"),
            signal: c.req.raw.signal,
          }),
        )
      },
    )
    .get(
      "/session/:sessionID/interactive-artifact/:artifactID/mcp-app/events",
      describeRoute({
        summary: "Subscribe to MCP App capability changes",
        description:
          "Authorize with one message-owned MCP App artifact, then stream session artifact lifecycle changes and project MCP capability changes for Overlay-side exact artifact and server filtering.",
        operationId: "interactiveArtifact.eventsMcpApp",
        responses: {
          200: {
            description: "MCP App Host event stream",
            content: { "text/event-stream": { schema: resolver(McpAppHostEvent) } },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionID: z.string().min(1),
          artifactID: z.string().min(1),
        }),
      ),
      async (c) => {
        const { sessionID, artifactID } = c.req.valid("param")
        const artifact = findInteractiveArtifact({
          sessionID,
          artifactID,
          projectID: Instance.project.id,
        })
        if (!artifact) throw new NotFoundError({ message: `Interactive artifact not found: ${artifactID}` })
        if (artifact.payload.renderer !== "mcp-app@1") {
          throw new NotFoundError({ message: `Interactive artifact is not an MCP App: ${artifactID}` })
        }
        const directory = Instance.directory
        c.header("X-Accel-Buffering", "no")
        c.header("X-Content-Type-Options", "nosniff")
        return streamProjectSSE(c, directory, async (stream, bind) => {
          let heartbeat: ReturnType<typeof setInterval> | undefined
          let finishStream = () => {}
          let closed = false
          const stops: Array<() => void> = []
          const finished = new Promise<void>((resolve) => {
            finishStream = resolve
          })
          let writes = Promise.resolve()
          const cleanup = (closeStream = false) => {
            if (closed) return
            closed = true
            if (heartbeat) clearInterval(heartbeat)
            for (const stop of stops) stop()
            if (closeStream) stream.close()
            finishStream()
          }
          const write = (event: z.output<typeof McpAppHostEvent>) => {
            writes = writes
              .then(() => {
                if (closed) return
                return stream.writeSSE({ data: JSON.stringify(event) })
              })
              .catch(() => cleanup(true))
          }
          const subscribe = (
            event: typeof MCP.ToolsChanged | typeof MCP.ResourcesChanged | typeof MCP.PromptsChanged,
            type: z.output<typeof McpAppHostEvent>["type"],
          ) => {
            const listener = bind((envelope: { directory?: string; payload: any }) => {
              if (envelope.directory !== directory) return
              if (envelope.payload?.type !== event.type) return
              const changedServerID = envelope.payload?.properties?.server
              if (typeof changedServerID !== "string") return
              write({ type, serverID: changedServerID })
            })
            GlobalBus.on("event", listener)
            stops.push(() => GlobalBus.off("event", listener))
          }
          subscribe(MCP.ToolsChanged, "tools/list_changed")
          subscribe(MCP.ResourcesChanged, "resources/list_changed")
          subscribe(MCP.PromptsChanged, "prompts/list_changed")
          {
            const listener = bind((envelope: { directory?: string; payload: any }) => {
              if (envelope.directory !== directory) return
              if (envelope.payload?.type !== McpAppLifecycleChanged.type) return
              if (envelope.payload?.properties?.sessionID !== sessionID) return
              const changedArtifactID = envelope.payload?.properties?.artifactID
              if (typeof changedArtifactID !== "string") return
              write({ type: "mcp-app.lifecycle_changed", artifactID: changedArtifactID })
            })
            GlobalBus.on("event", listener)
            stops.push(() => GlobalBus.off("event", listener))
          }
          write({ type: "mcp-app.connected" })
          heartbeat = setInterval(bind(() => write({ type: "mcp-app.heartbeat" })), 10_000)
          stream.onAbort(() => cleanup())
          await finished
          await writes
        })
      },
    ),
)
