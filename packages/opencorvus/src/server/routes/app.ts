import { Bus } from "@/bus"
import { BusEvent } from "@/bus/bus-event"
import { GlobalBus } from "@/bus/global"
import { NativeAgentInfoSchema } from "@/agent/native-agent-info"
import { PrimaryAssistantRegistry } from "@/agent/primary-assistant-registry"
import { Global } from "@/global"
import { Vcs } from "@/project/vcs"
import { streamCommitMessage } from "@/project/vcs-commit-message"
import { Instance } from "@/project/instance"
import { LSP } from "@/lsp"
import { Command } from "@/command"
import { Format } from "@/format"
import { Log } from "@/util/log"
import { buildLogSupportBundle } from "@/util/log-support-bundle"
import { Env } from "@/runtime/env"
import { Hono } from "hono"
import { describeRoute, openAPIRouteHandler, resolver, validator } from "hono-openapi"
import { streamGlobalSSE, streamProjectSSE } from "../sse"
import { VcsCommitMessageStreamEvent } from "@opencorvus-ai/transport-protocol"
import z from "zod"
import { OwnedPromptControllersResponse, errors, namedErrorResponse } from "../error"
import { ProjectRoutes } from "./project"
import { ConfigRoutes } from "./config"
import { ExperimentalRoutes, resetExperimentalRouteFactoriesForOpenApi } from "./experimental"
import { SessionRoutes } from "./session"
import { PermissionRoutes } from "./permission"
import { QuestionRoutes } from "./question"
import { ChannelRoutes } from "./channel"
import { ProviderRoutes } from "./provider"
import { FileRoutes } from "./file"
import { McpRoutes } from "./mcp"
import { SkillRoutes } from "./skill"
import { MissionSkillRoutes } from "./mission-skill"
import { ExpertSquadRoutes } from "./expert-squad"
import { ConversationCapabilityRoutes } from "./conversation-capability"
import { PtyRoutes } from "./pty"
import { ExportRoutes } from "./export"
import { EngineRoutes } from "./orchestrator"
import { PanelRoutes } from "./panel"
import { CodingRoutes } from "./coding"
import { TerminalRoutes } from "./terminal"
import { AttachmentRoutes } from "./attachment"
import { GatewayRoutes } from "./gateway"
import { MissionRoutes } from "./mission"
import { WorkLedgerRoutes } from "./work-ledger"
import { MailboxRoutes } from "./mailbox"
import { BrowserPreviewRoutes } from "./browser-preview"
import { InteractiveArtifactRoutes } from "./interactive-artifact"
import { PluginRoutes } from "./plugin"
import { ComputerRoutes } from "./computer"
import { QuickNoteRoutes } from "@/quicknote/routes"
import {
  ServerLifecycleOccurrenceResponse,
  admitServerRestart,
  admitServerShutdown,
  serverLifecycleOccurrence,
} from "../lifecycle-occurrence"
import { AppDocumentation } from "./documentation"
import { requestID, serverErrorResponse } from "../error-handler"
import { writeVcsCommitMessageStreamError } from "../vcs-stream-error"
import { Event as ServerEvent, payload as serverEventPayload } from "../event"

const log = Log.create({ service: "server" })
const ShutdownUnavailableResponse = {
  description: "Shutdown handler unavailable",
  content: {
    "application/json": {
      schema: resolver(z.object({ ok: z.boolean() })),
    },
  },
} as const

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

type ProjectEventSSEInput = {
  directory?: string
  payload?: { type?: string }
}

export function createProjectEventSSEListener(input: {
  directory: string
  write(data: string): Promise<unknown>
  closeAfterDelivery(): void
}): (event: ProjectEventSSEInput) =>
  | { status: "ignored" }
  | { status: "accepted"; eventType: string } {
  let writes: Promise<unknown> | undefined
  return (event) => {
    if (event.directory !== input.directory || !event.payload) return { status: "ignored" }
    const eventType = typeof event.payload.type === "string" ? event.payload.type : ""
    const data = JSON.stringify(event.payload)
    writes = writes ? writes.then(() => input.write(data)) : Promise.resolve(input.write(data))
    if (eventType === Bus.InstanceDisposed.type) {
      void writes.then(() => input.closeAfterDelivery())
    }
    return { status: "accepted", eventType }
  }
}

const LogReadResponse = z.object({
  directory: z.string(),
  path: z.string(),
  file: z.string(),
  lines: z.string().array(),
})
const LogFileInfo = z.object({
  name: z.string(),
  path: z.string(),
  size: z.number(),
  modified: z.string(),
  current: z.boolean(),
})
const LogFilesResponse = z.object({
  directory: z.string(),
  current: z.string(),
  files: LogFileInfo.array(),
})
const VcsCommitInput = z.object({
  message: z.string().trim().min(1).max(2_000),
})
const VcsCommitMessageInput = z.object({
  taskID: z.string().trim().min(1).optional(),
  sessionID: z.string().trim().min(1).optional(),
})
const LogReadQuery = z.object({
  file: Log.FileName.optional(),
  n: z.coerce.number().int().min(1).max(5000).default(500),
})

export function resetAppRouteFactoriesForOpenApi() {
  ProjectRoutes.reset()
  ConfigRoutes.reset()
  ChannelRoutes.reset()
  resetExperimentalRouteFactoriesForOpenApi()
  SessionRoutes.reset()
  PermissionRoutes.reset()
  QuestionRoutes.reset()
  ProviderRoutes.reset()
  QuickNoteRoutes.reset()
  BrowserPreviewRoutes.reset()
  InteractiveArtifactRoutes.reset()
  EngineRoutes.reset()
  MailboxRoutes.reset()
  ExportRoutes.reset()
  FileRoutes.reset()
  AttachmentRoutes.reset()
  McpRoutes.reset()
  PtyRoutes.reset()
}

export function AppRoutes(root: Hono) {
  return new Hono()
    .onError(serverErrorResponse)
    .get(
      "/doc",
      openAPIRouteHandler(root, {
        documentation: AppDocumentation,
      }),
    )
    .route("/project", ProjectRoutes())
    .route("/terminal", TerminalRoutes())
    .route("/config", ConfigRoutes())
    .route("/channel", ChannelRoutes())
    .route("/experimental", ExperimentalRoutes())
    .route("/session", SessionRoutes())
    .route("/permission", PermissionRoutes())
    .route("/question", QuestionRoutes())
    .route("/provider", ProviderRoutes())
    .route("/skill", SkillRoutes())
    .route("/mission-skill", MissionSkillRoutes())
    .route("/expert-squad", ExpertSquadRoutes())
    .route("/computer", ComputerRoutes())
    .route("/chat", ConversationCapabilityRoutes("chat"))
    .route("/work", ConversationCapabilityRoutes("work"))
    .route("/panel", PanelRoutes())
    .route("/coding", CodingRoutes())
    .route("/gateway", GatewayRoutes())
    .route("/mission", MissionRoutes())
    .route("/work-ledger", WorkLedgerRoutes())
    .route("/mailbox", MailboxRoutes())
    .route("/api/v1", QuickNoteRoutes())
    .route("/", BrowserPreviewRoutes())
    .route("/", InteractiveArtifactRoutes())
    .post(
      "/shutdown",
      describeRoute({
        summary: "Shutdown the server",
        description: "Gracefully abort live execution state and stop the current process.",
        operationId: "server.shutdown",
        responses: {
          200: {
            description: "Shutdown admitted",
            content: {
              "application/json": {
                schema: resolver(z.object({ ok: z.boolean(), occurrenceID: z.string().optional() })),
              },
            },
          },
          409: {
            description: "Supervisor identity mismatch, or a live lifecycle occurrence owns the process",
            content: {
              "application/json": {
                schema: resolver(z.object({ ok: z.boolean(), occurrenceID: z.string().optional() })),
              },
            },
          },
          503: ShutdownUnavailableResponse,
        },
      }),
      async (c) => {
        const declaredSource = c.req.header("x-opencorvus-shutdown-source")
        const source = declaredSource === "tauri-supervisor" ? declaredSource : "http-client"
        const processOccurrenceID = c.req.header("x-opencorvus-process-occurrence")?.trim()
        if (
          source === "tauri-supervisor" &&
          (!processOccurrenceID || processOccurrenceID !== Env.snapshot().OPENCORVUS_PROCESS_OCCURRENCE_ID)
        ) {
          log.warn("shutdown supervisor occurrence identity mismatch", { processOccurrenceID })
          return c.json({ ok: false }, 409)
        }
        const admission = admitServerShutdown({
          source,
          reason: "http.shutdown",
          ...(processOccurrenceID ? { processOccurrenceID } : {}),
        })
        if (!admission.admitted) {
          if (admission.reason === "unavailable") {
            log.warn("shutdown requested without registered shutdown handler")
            return c.json({ ok: false }, 503)
          }
          log.warn("shutdown refused by a live lifecycle occurrence", { live: admission.live })
          return c.json({ ok: false, occurrenceID: admission.live.id }, 409)
        }
        log.info("shutdown admitted", { source, processOccurrenceID, occurrenceID: admission.occurrence.id })
        return c.json({ ok: true, occurrenceID: admission.occurrence.id })
      },
    )
    .post(
      "/restart",
      describeRoute({
        summary: "Restart the server",
        description: "Spawn a new server process with the same arguments, then exit.",
        operationId: "server.restart",
        responses: {
          200: {
            description: "Restart admitted",
            content: {
              "application/json": {
                schema: resolver(z.object({ ok: z.boolean(), occurrenceID: z.string().optional() })),
              },
            },
          },
          409: {
            description: "A live lifecycle occurrence owns the process",
            content: {
              "application/json": {
                schema: resolver(z.object({ ok: z.boolean(), occurrenceID: z.string().optional() })),
              },
            },
          },
          503: ShutdownUnavailableResponse,
        },
      }),
      async (c) => {
        const admission = admitServerRestart("server.restart")
        if (!admission.admitted) {
          if (admission.reason === "unavailable") {
            log.warn("restart requested without registered restart handler")
            return c.json({ ok: false }, 503)
          }
          log.warn("restart refused by a live lifecycle occurrence", { live: admission.live })
          return c.json({ ok: false, occurrenceID: admission.live.id }, 409)
        }
        log.info("restart admitted; spawning replacement after the HTTP response releases the listener", {
          occurrenceID: admission.occurrence.id,
        })
        c.header("connection", "close")
        return c.json({ ok: true, occurrenceID: admission.occurrence.id })
      },
    )
    .get(
      "/lifecycle/:occurrenceID",
      describeRoute({
        summary: "Get a server lifecycle occurrence",
        description:
          "Return the state of an admitted shutdown or restart occurrence. A completed shutdown is unobservable from inside the process, so `executing` is the last state a successful one shows.",
        operationId: "server.lifecycle",
        responses: {
          200: {
            description: "Lifecycle occurrence state",
            content: {
              "application/json": {
                schema: resolver(ServerLifecycleOccurrenceResponse),
              },
            },
          },
          404: {
            description: "Unknown lifecycle occurrence",
            content: {
              "application/json": {
                schema: resolver(z.object({ ok: z.boolean() })),
              },
            },
          },
        },
      }),
      async (c) => {
        const occurrence = serverLifecycleOccurrence(c.req.param("occurrenceID"))
        if (!occurrence) return c.json({ ok: false }, 404)
        return c.json(ServerLifecycleOccurrenceResponse.parse(occurrence))
      },
    )
    .route("/", EngineRoutes())
    .route("/export", ExportRoutes())
    .route("/", FileRoutes())
    .route("/attachment", AttachmentRoutes())
    .route("/mcp", McpRoutes())
    .route("/pty", PtyRoutes())
    .route("/plugin", PluginRoutes())
    .post(
      "/instance/dispose",
      describeRoute({
        summary: "Dispose instance",
        description: "Clean up and dispose the current OpenCorvus instance, releasing all resources.",
        operationId: "instance.dispose",
        responses: {
          200: {
            description: "Instance disposed",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          409: OwnedPromptControllersResponse,
        },
      }),
      async (c) => {
        const { ownedPromptControllersError, hasProjectOwnedPromptControllers } = await import("@/engine/runtime")
        if (hasProjectOwnedPromptControllers()) {
          throw ownedPromptControllersError("instance.dispose")
        }
        await Instance.dispose()
        return c.json(true)
      },
    )
    .get(
      "/path",
      describeRoute({
        summary: "Get paths",
        description: "Retrieve the current working directory and related path information for the OpenCorvus instance.",
        operationId: "path.get",
        responses: {
          200: {
            description: "Path",
            content: {
              "application/json": {
                schema: resolver(
                  z
                    .object({
                      home: z.string(),
                      state: z.string(),
                      config: z.string(),
                      worktree: z.string(),
                      directory: z.string(),
                    })
                    .meta({
                      ref: "Path",
                    }),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json({
          home: Global.Path.home,
          state: Global.Path.state,
          config: Global.Path.config,
          worktree: Instance.worktree,
          directory: Instance.directory,
        })
      },
    )
    .get(
      "/vcs",
      describeRoute({
        summary: "Get VCS info",
        description:
          "Retrieve version control system (VCS) information for the current project, such as git branch and working tree status.",
        operationId: "vcs.get",
        responses: {
          200: {
            description: "VCS info",
            content: {
              "application/json": {
                schema: resolver(Vcs.Info),
              },
            },
          },
          ...errors(500),
        },
      }),
      async (c) => {
        return c.json(await Vcs.info())
      },
    )
    .get(
      "/vcs/branches",
      describeRoute({
        summary: "List local VCS branches",
        description: "List the exact local Git branches for the current project and identify the active branch.",
        operationId: "vcs.branches",
        responses: {
          200: {
            description: "Local VCS branches",
            content: {
              "application/json": {
                schema: resolver(Vcs.Branch.array()),
              },
            },
          },
          412: namedErrorResponse("VCS branch prerequisite is not satisfied", "VcsPrerequisiteError"),
          ...errors(500),
        },
      }),
      async (c) => {
        return c.json(await Vcs.branches())
      },
    )
    .post(
      "/vcs/branch",
      describeRoute({
        summary: "Switch local VCS branch",
        description:
          "Switch the current project checkout to an exact existing local Git branch without discarding working-tree changes.",
        operationId: "vcs.switchBranch",
        responses: {
          200: {
            description: "Updated VCS information",
            content: {
              "application/json": {
                schema: resolver(Vcs.Info),
              },
            },
          },
          412: namedErrorResponse("VCS branch prerequisite is not satisfied", "VcsPrerequisiteError"),
          ...errors(500),
        },
      }),
      validator(
        "json",
        z.object({
          branch: Vcs.Branch.shape.name.min(1),
        }),
      ),
      async (c) => {
        const body = c.req.valid("json")
        return c.json(await Vcs.switchBranch(body.branch))
      },
    )
    .post(
      "/vcs/commit",
      describeRoute({
        summary: "Commit current VCS changes",
        description:
          "Stage every current project working-tree change and create one Git commit with the exact supplied message.",
        operationId: "vcs.commit",
        responses: {
          200: {
            description: "Created Git commit and refreshed VCS information",
            content: {
              "application/json": {
                schema: resolver(Vcs.CommitResult),
              },
            },
          },
          412: namedErrorResponse("VCS commit prerequisite is not satisfied", "VcsPrerequisiteError"),
          ...errors(500),
        },
      }),
      validator("json", VcsCommitInput),
      async (c) => {
        return c.json(await Vcs.commit(c.req.valid("json").message))
      },
    )
    .post(
      "/vcs/push",
      describeRoute({
        summary: "Push current VCS branch",
        description:
          "Push the current Git branch through its configured upstream without creating or changing remotes.",
        operationId: "vcs.push",
        responses: {
          200: {
            description: "Git push completed and VCS information refreshed",
            content: {
              "application/json": {
                schema: resolver(Vcs.PushResult),
              },
            },
          },
          412: namedErrorResponse("VCS push prerequisite is not satisfied", "VcsPrerequisiteError"),
          ...errors(500),
        },
      }),
      async (c) => {
        return c.json(await Vcs.push())
      },
    )
    .post(
      "/vcs/commit-message/stream",
      describeRoute({
        summary: "Generate a Git commit message with streaming AI",
        description:
          "Use the configured helper model to stream one editable Git commit subject from the current project diff and recent subject style.",
        operationId: "vcs.commitMessage.stream",
        responses: {
          200: {
            description: "Streaming Git commit-message events",
            content: {
              "text/event-stream": {
                schema: resolver(VcsCommitMessageStreamEvent),
              },
            },
          },
          ...errors(500),
        },
      }),
      validator("json", VcsCommitMessageInput),
      async (c) => {
        const input = c.req.valid("json")
        const streamRequestID = requestID(c)
        c.header("x-opencorvus-request-id", streamRequestID)
        c.header("X-Accel-Buffering", "no")
        c.header("X-Content-Type-Options", "nosniff")
        return streamProjectSSE(c, Instance.directory, async (stream) => {
          try {
            const message = await streamCommitMessage({
              taskID: input.taskID,
              sessionID: input.sessionID,
              signal: c.req.raw.signal,
              onDelta: async (delta) => {
                const event = VcsCommitMessageStreamEvent.parse({ type: "delta", delta })
                await stream.writeSSE({ data: JSON.stringify(event) })
              },
            })
            const event = VcsCommitMessageStreamEvent.parse({ type: "done", message })
            await stream.writeSSE({ data: JSON.stringify(event) })
          } catch (error) {
            await writeVcsCommitMessageStreamError({
              stream,
              error,
              requestID: streamRequestID,
              logError: (message, fields) => log.error(message, fields),
            })
          }
        })
      },
    )
    .get(
      "/vcs/diff",
      describeRoute({
        summary: "Get VCS diff",
        description: "Retrieve the current git diff for the working tree or against the default branch.",
        operationId: "vcs.diff",
        responses: {
          200: {
            description: "VCS diff",
            content: {
              "application/json": {
                schema: resolver(Vcs.FileDiff.array()),
              },
            },
          },
          412: namedErrorResponse("VCS diff prerequisite is not satisfied", "VcsPrerequisiteError"),
          ...errors(500),
        },
      }),
      validator(
        "query",
        z.object({
          mode: Vcs.Mode.default("git"),
          context: z.coerce.number().int().nonnegative().optional(),
          directory: z.string().optional(),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        return c.json(await Vcs.diff(query.mode, { context: query.context }))
      },
    )
    .get(
      "/command",
      describeRoute({
        summary: "List commands",
        description: "Get a list of all available commands in the OpenCorvus system.",
        operationId: "command.list",
        responses: {
          200: {
            description: "List of commands",
            content: {
              "application/json": {
                schema: resolver(Command.Info.array()),
              },
            },
          },
          500: namedErrorResponse("Command list failed", "UnknownError"),
        },
      }),
      async (c) => {
        const commands = await Command.list()
        return c.json(commands)
      },
    )
    .post(
      "/log",
      describeRoute({
        summary: "Write log batch",
        description: "Write one bounded ordered batch of log entries to the server logs.",
        operationId: "app.log",
        responses: {
          200: {
            description: "Log entry written successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "json",
        z
          .object({
            entries: z
              .array(
                z
                  .object({
                    service: z.string().meta({ description: "Service name for the log entry" }),
                    level: z.enum(["debug", "info", "error", "warn"]).meta({ description: "Log level" }),
                    message: z.string().meta({ description: "Log message" }),
                    extra: z
                      .record(z.string(), z.unknown())
                      .optional()
                      .meta({ description: "Additional metadata for the log entry" }),
                  })
                  .strict(),
              )
              .min(1)
              .max(50),
          })
          .strict(),
      ),
      async (c) => {
        for (const { service, level, message, extra } of c.req.valid("json").entries) {
          const logger = Log.create({ service })
          switch (level) {
            case "debug":
              logger.debug(message, extra)
              break
            case "info":
              logger.info(message, extra)
              break
            case "error":
              logger.error(message, extra)
              break
            case "warn":
              logger.warn(message, extra)
              break
          }
        }

        return c.json(true)
      },
    )
    .get(
      "/log",
      describeRoute({
        summary: "Read logs",
        description: "Read the last N lines from the current or named server log file in the unified log directory.",
        operationId: "log.read",
        responses: {
          200: {
            description: "Log lines",
            content: {
              "application/json": {
                schema: resolver(LogReadResponse),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("query", LogReadQuery),
      async (c) => {
        const query = c.req.valid("query")
        return c.json(await Log.read({ file: query.file, lines: query.n }))
      },
    )
    .get(
      "/log/files",
      describeRoute({
        summary: "List log files",
        description: "List server log files from the unified log directory.",
        operationId: "log.files",
        responses: {
          200: {
            description: "Log files",
            content: {
              "application/json": {
                schema: resolver(LogFilesResponse),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json({
          directory: Log.directory(),
          current: Log.file(),
          files: await Log.files(),
        })
      },
    )
    .get(
      "/log/export",
      describeRoute({
        summary: "Export log support bundle",
        description:
          "Download every retained server log as a ZIP containing byte-exact raw files, formatted human-readable copies, and a structured diagnostic manifest.",
        operationId: "log.export",
        responses: {
          200: {
            description: "Log support bundle ZIP",
            content: {
              "application/zip": {
                schema: resolver(z.string()),
              },
            },
          },
        },
      }),
      async () => {
        log.info("log support bundle export requested")
        const bundle = await buildLogSupportBundle()
        return new Response(bundle.bytes, {
          status: 200,
          headers: {
            "content-type": "application/zip",
            "content-disposition": `attachment; filename="${bundle.filename}"`,
            "content-length": String(bundle.bytes.byteLength),
            "x-opencorvus-log-file-count": String(bundle.manifest.totals.fileCount),
            "x-opencorvus-log-line-count": String(bundle.manifest.totals.lineCount),
          },
        })
      },
    )
    .get(
      "/log/tail",
      describeRoute({
        summary: "Read recent logs",
        description: "Read the last N lines from the current server log file.",
        operationId: "log.tail",
        responses: {
          200: {
            description: "Log lines",
            content: {
              "application/json": {
                schema: resolver(LogReadResponse),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator(
        "query",
        z.object({
          n: z.coerce.number().int().min(1).max(5000).default(500),
        }),
      ),
      async (c) => {
        const n = c.req.valid("query").n
        return c.json(await Log.read({ lines: n }))
      },
    )
    .get(
      "/agent",
      describeRoute({
        summary: "List primary assistants",
        description: "Get the product-facing primary assistants available for direct user sessions.",
        operationId: "app.agents",
        responses: {
          200: {
            description: "List of primary assistants",
            content: {
              "application/json": {
                schema: resolver(NativeAgentInfoSchema.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(await PrimaryAssistantRegistry.list())
      },
    )
    .get(
      "/lsp",
      describeRoute({
        summary: "Get LSP status",
        description: "Compatibility endpoint. Language Server Protocol runtimes are disabled, so this returns an empty array.",
        operationId: "lsp.status",
        responses: {
          200: {
            description: "LSP server status",
            content: {
              "application/json": {
                schema: resolver(LSP.Status.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(await LSP.status())
      },
    )
    .get(
      "/formatter",
      describeRoute({
        summary: "Get formatter status",
        description: "Get formatter status",
        operationId: "formatter.status",
        responses: {
          200: {
            description: "Formatter status",
            content: {
              "application/json": {
                schema: resolver(Format.Status.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(await Format.status())
      },
    )
    .get(
      "/event",
      describeRoute({
        summary: "Subscribe to events",
        description: "Get events",
        operationId: "event.subscribe",
        responses: {
          200: {
            description: "Event stream",
            content: {
              "text/event-stream": {
                schema: resolver(BusEvent.payloads()),
              },
            },
          },
        },
      }),
      async (c) => {
        log.info("event connected")
        const directory = Instance.directory
        c.header("X-Accel-Buffering", "no")
        c.header("X-Content-Type-Options", "nosniff")
        return streamGlobalSSE(c, async (stream, bind) => {
          let heartbeat: ReturnType<typeof setInterval> | undefined
          let unsub = () => {}
          let finishStream = () => {}
          let closed = false
          const cleanup = (input?: { closeStream?: boolean; error?: unknown }) => {
            if (closed) return
            closed = true
            if (heartbeat) clearInterval(heartbeat)
            unsub()
            if (input?.error) {
              log.warn("event stream write failed", { error: errorMessage(input.error) })
            }
            if (input?.closeStream) stream.close()
            finishStream()
          }
          const finished = new Promise<void>((resolve) => {
            finishStream = resolve
          })
          let writes = Promise.resolve()
          const writeData = (data: string) => {
            writes = writes
              .then(() => {
                if (closed) return
                return stream.writeSSE({ data })
              })
              .catch((error) => {
                cleanup({ closeStream: true, error })
              })
            return writes
          }
          const listener = bind(
            createProjectEventSSEListener({
              directory,
              write: writeData,
              closeAfterDelivery: () => cleanup({ closeStream: true }),
            }),
          )
          GlobalBus.on("event", listener)
          unsub = () => GlobalBus.off("event", listener)

          await writeData(JSON.stringify(serverEventPayload(ServerEvent.Connected, {})))
          if (closed) {
            await writes
            return
          }

          heartbeat = setInterval(
            bind(() => {
              void writeData(JSON.stringify(serverEventPayload(ServerEvent.Heartbeat, {})))
            }),
            10_000,
          )

          stream.onAbort(() => {
            cleanup()
            log.info("event disconnected")
          })
          await finished
          await writes
        })
      },
    )
}
