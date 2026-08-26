import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import { streamGlobalSSE } from "../sse"
import z from "zod"
import { BusEvent } from "@/bus/bus-event"
import { GlobalBus } from "@/bus/global"
import { Event as ServerEvent, globalEnvelope } from "../event"
import { Instance } from "../../project/instance"
import { Project } from "../../project/project"
import { Installation } from "@/installation"
import { Log } from "../../util/log"
import { lazy } from "../../util/lazy"
import { Config } from "../../config/config"
import { Auth } from "../../auth"
import { ConfigCandidateValidationError } from "@/config/candidate-validation"
import { Provider } from "../../provider/provider"
import { ProviderAuth } from "../../provider/auth"
import { ProviderRemovalReceipt, removeProvider } from "../../provider/removal"
import { discoverProviderModels, testProviderConnection } from "../../provider/operations"
import { updateGlobalConfigPatch } from "../../config/update-global"
import { PrimaryAssistantRegistry } from "@/agent/primary-assistant-registry"
import { NativeAgentInfoSchema } from "@/agent/native-agent-info"
import { Database } from "../../storage/db"
import {
  AuthReadUnavailableResponse,
  OwnedPromptControllersResponse,
  badRequestBody,
  errors,
  namedErrorResponse,
} from "../error"
import { GlobalConversationService } from "@/chat/global-chat-service"
import { RightSidebarConversationSessionResponse } from "@/chat/session"
import { ImplicitProject } from "@/project/implicit-project"
import { SkillManager } from "@/skill/manager"
import {
  MysqlTransferFullExport,
  MysqlTransferImportResult,
  MysqlTransferSchemaExport,
  MysqlTransferSnapshot,
  MysqlTransferValidationError,
  applyMysqlTransferPlan,
  exportMysqlTransferPackage,
  mysqlSchemaExport,
  preflightMysqlTransferSnapshot,
} from "@/storage/mysql-transfer"
import { settleCanonicalProviderCatalogInvalidation, settleProviderRefreshInvalidation } from "../provider-refresh"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { ExpertSquadCatalogPageSchema, ExpertSquadCatalogSearchQuerySchema } from "@/expert-squad/catalog"
import { MissionSkillCatalog } from "@/mission-skill/catalog"
import { Skill } from "@/skill/skill"
import { AutomationRunOutcomes, AutomationService } from "@/scheduler/automation-service"
import { ProviderAccountUsage } from "@/provider/account-usage"
import { UsageStats } from "@/usage"

const log = Log.create({ service: "server" })

const GlobalProviderAuthMutationResponse = z
  .object({
    ok: z.literal(true),
    issues: Provider.LoadIssue.array(),
  })
  .strict()

const GlobalConversationCreateRequest = z
  .object({
    model: Config.ModelId.optional(),
  })
  .strict()

const AutomationTarget = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("session"), sessionId: z.string().min(1) }).strict(),
  z.object({ scope: z.literal("project"), projectIds: z.array(z.string().min(1)).min(1) }).strict(),
  z.object({ scope: z.literal("global") }).strict(),
])

const AutomationView = z
  .object({
    id: z.string(),
    name: z.string(),
    target: AutomationTarget,
    recurrence: z.string(),
    executionMode: z.enum(["local", "worktree"]),
    model: z.object({ providerID: z.string(), modelID: z.string() }).nullable(),
    reasoningEffort: z.string().nullable(),
    prompt: z.string(),
    status: z.enum(["active", "paused"]),
    lastRun: z.number().nullable(),
    nextRun: z.number(),
    failureCount: z.number(),
    lastError: z.string().nullable(),
  })
  .strict()

export const AutomationRunViewSchema = z
  .object({
    id: z.string(),
    automationId: z.string(),
    fireId: z.string(),
    targetScope: z.enum(["session", "project", "global"]),
    targetProjectId: z.string().nullable(),
    session: z
      .object({
        id: z.string(),
        title: z.string(),
        directory: z.string(),
        kind: z.string(),
        experience: z.enum(["chat", "work"]).nullable(),
        productPillar: z.enum(["code", "work"]).nullable(),
      })
      .nullable(),
    outcome: z.enum(AutomationRunOutcomes),
    startedAt: z.number(),
    completedAt: z.number().nullable(),
    error: z.string().nullable(),
  })
  .strict()

const CreateAutomationBody = z
  .object({
    name: z.string().min(1),
    target: AutomationTarget,
    recurrence: z.string().min(1),
    executionMode: z.enum(["local", "worktree"]).optional(),
    model: z.object({ providerID: z.string().min(1), modelID: z.string().min(1) }).optional(),
    reasoningEffort: z.string().min(1).optional(),
    prompt: z.string().min(1),
  })
  .strict()

const UpdateAutomationBody = CreateAutomationBody.partial()
  .extend({
    model: z
      .object({ providerID: z.string().min(1), modelID: z.string().min(1) })
      .nullable()
      .optional(),
    reasoningEffort: z.string().min(1).nullable().optional(),
    status: z.enum(["active", "paused"]).optional(),
  })
  .strict()

const GlobalComposerReferencesResponse = z
  .object({
    skills: z
      .object({
        skills: Skill.Summary.array(),
        issues: Skill.Warning.array(),
      })
      .strict(),
    expert_squads: z
      .object({
        page: ExpertSquadCatalogPageSchema,
      })
      .strict(),
    mission_skills: MissionSkillCatalog.Response,
  })
  .strict()

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export const GlobalRoutes = lazy(() =>
  new Hono()
    .get(
      "/usage",
      describeRoute({
        summary: "Get natural-period Provider usage",
        description:
          "Aggregate persisted streamed Provider calls across all projects by their event time for one IANA calendar period.",
        operationId: "global.usage",
        responses: {
          200: {
            description: "Natural-period Token, cost, Provider, model, comparison, and time-series statistics",
            content: { "application/json": { schema: resolver(UsageStats.Response) } },
          },
          ...errors(400),
        },
      }),
      validator("query", UsageStats.Query),
      async (c) => c.json(await UsageStats.read(c.req.valid("query"))),
    )
    .get(
      "/automations",
      describeRoute({
        summary: "List scheduled automations",
        operationId: "global.automations.list",
        responses: {
          200: {
            description: "Scheduled automations with explicit targets",
            content: { "application/json": { schema: resolver(z.array(AutomationView)) } },
          },
          ...errors(400),
        },
      }),
      (c) => c.json(AutomationService.list()),
    )
    .post(
      "/automations",
      describeRoute({
        summary: "Create a scheduled automation",
        operationId: "global.automations.create",
        responses: {
          201: {
            description: "Created scheduled automation",
            content: {
              "application/json": {
                schema: resolver(z.object({ id: z.string(), name: z.string(), nextRun: z.number() })),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("json", CreateAutomationBody),
      async (c) => c.json(await AutomationService.create(c.req.valid("json")), 201),
    )
    .patch(
      "/automations/:id",
      describeRoute({
        summary: "Update a scheduled automation",
        operationId: "global.automations.update",
        responses: {
          200: {
            description: "Updated scheduled automation",
            content: { "application/json": { schema: resolver(AutomationView) } },
          },
          ...errors(400, 404, 409),
        },
      }),
      validator("json", UpdateAutomationBody),
      async (c) => c.json(await AutomationService.update({ ...c.req.valid("json"), id: c.req.param("id") })),
    )
    .post(
      "/automations/:id/run",
      describeRoute({
        summary: "Run a scheduled automation now",
        operationId: "global.automations.run",
        responses: {
          200: {
            description: "One completed run per target",
            content: { "application/json": { schema: resolver(z.array(AutomationRunViewSchema)) } },
          },
          ...errors(400, 404, 409),
        },
      }),
      async (c) => c.json(await AutomationService.runNow(c.req.param("id"))),
    )
    .get(
      "/automations/:id/runs",
      describeRoute({
        summary: "List scheduled automation runs",
        operationId: "global.automations.runs",
        responses: {
          200: {
            description: "Scheduled automation run history",
            content: { "application/json": { schema: resolver(z.array(AutomationRunViewSchema)) } },
          },
          ...errors(400, 404),
        },
      }),
      (c) => c.json(AutomationService.listRuns(c.req.param("id"))),
    )
    .delete(
      "/automations/:id",
      describeRoute({
        summary: "Delete a scheduled automation",
        operationId: "global.automations.delete",
        responses: {
          200: {
            description: "Deleted scheduled automation receipt",
            content: {
              "application/json": { schema: resolver(z.object({ id: z.string(), name: z.string() }).strict()) },
            },
          },
          ...errors(400, 404, 409),
        },
      }),
      (c) => c.json(AutomationService.remove(c.req.param("id"))),
    )
    .post(
      "/chat",
      describeRoute({
        summary: "Create Chat in a temporary project",
        description:
          "Create one dated UUID project under the OpenCorvus data directory and one right-sidebar Chat session owned by it.",
        operationId: "global.chat.create",
        responses: {
          201: {
            description: "Chat session with concrete temporary project ownership",
            content: { "application/json": { schema: resolver(RightSidebarConversationSessionResponse) } },
          },
          ...errors(400),
        },
      }),
      validator("json", GlobalConversationCreateRequest.optional()),
      async (c) =>
        c.json(
          await GlobalConversationService.create({
            experience: "chat",
            model: c.req.valid("json")?.model,
          }),
          201,
        ),
    )
    .post(
      "/work",
      describeRoute({
        summary: "Create Work in a temporary project",
        description:
          "Create one dated UUID project under the OpenCorvus data directory and one right-sidebar Work session owned by it.",
        operationId: "global.work.create",
        responses: {
          201: {
            description: "Work session with concrete temporary project ownership",
            content: { "application/json": { schema: resolver(RightSidebarConversationSessionResponse) } },
          },
          ...errors(400),
        },
      }),
      validator("json", GlobalConversationCreateRequest.optional()),
      async (c) =>
        c.json(
          await GlobalConversationService.create({
            experience: "work",
            model: c.req.valid("json")?.model,
          }),
          201,
        ),
    )
    .get(
      "/composer-references",
      describeRoute({
        summary: "List global Composer references",
        description:
          "Return the built-in and user-global Skills, Expert Squads, and Mission Skills available before a project-backed Code or Work conversation exists. This read-only route does not create a Project or Session.",
        operationId: "global.composerReferences",
        responses: {
          200: {
            description: "Directory-free Composer reference catalog",
            content: { "application/json": { schema: resolver(GlobalComposerReferencesResponse) } },
          },
          ...errors(500),
        },
      }),
      async (c) => {
        const [skills, expertSquadPage, missionSkills] = await Promise.all([
          Skill.globalSummaries(),
          PromptProfileResolver.searchCatalog({ limit: 20 }),
          MissionSkillCatalog.globalSummaries(),
        ])
        return c.json(
          GlobalComposerReferencesResponse.parse({
            skills,
            expert_squads: {
              page: expertSquadPage,
            },
            mission_skills: missionSkills,
          }),
        )
      },
    )
    .get(
      "/composer-expert-squads",
      describeRoute({
        summary: "Search global Composer expert squads",
        description:
          "Returns a bounded page of built-in and user-global Expert Squads without creating a Project or Session.",
        operationId: "global.composerExpertSquads",
        responses: {
          200: {
            description: "Bounded global Composer Expert Squad page",
            content: { "application/json": { schema: resolver(ExpertSquadCatalogPageSchema) } },
          },
          ...errors(400, 500),
        },
      }),
      validator("query", ExpertSquadCatalogSearchQuerySchema),
      async (c) => {
        const query = c.req.valid("query")
        return c.json(
          await PromptProfileResolver.searchCatalog({
            view: query.view,
            query: query.query,
            productPillar: query.productPillar,
            cursor: query.cursor,
            limit: query.limit,
          }),
        )
      },
    )
    .get(
      "/health",
      describeRoute({
        summary: "Get health",
        description:
          "Get health information about the OpenCorvus server, including its durable database availability, runtime-resolved on-disk paths, and optional evidence that this process backed up a stale database before creating a fresh database. This control-plane route does not open SQLite. The DB path is resolved by `Database.Path()` and is the current SQLite location for this server process — UIs should read this rather than rebuilding the path from a template.",
        operationId: "global.health",
        responses: {
          200: {
            description: "Health information",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    healthy: z.boolean(),
                    version: z.string(),
                    paths: z.object({
                      database: z.string(),
                      data: z.string(),
                      home: z.string(),
                    }),
                    databaseUnavailable: z
                      .object({
                        message: z.string(),
                        path: z.string(),
                        operation: z.string(),
                        code: z.string(),
                        errno: z.number().optional(),
                        byteOffset: z.number().optional(),
                      })
                      .optional(),
                  }),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        const { Global } = await import("../../global")
        const databaseUnavailable = Database.unavailable()
        return c.json({
          healthy: databaseUnavailable === undefined,
          version: Installation.VERSION,
          paths: {
            database: Database.Path(),
            data: Global.Path.data,
            home: Global.Path.home,
          },
          ...(databaseUnavailable ? { databaseUnavailable } : {}),
        })
      },
    )
    .get(
      "/agents",
      describeRoute({
        summary: "List primary assistants for global configuration",
        description: "Resolve primary assistants from global configuration without requiring an active project.",
        operationId: "global.agents.list",
        responses: {
          200: {
            description: "Global primary assistant list",
            content: { "application/json": { schema: resolver(NativeAgentInfoSchema.array()) } },
          },
        },
      }),
      async (c) => {
        const config = await Config.getGlobal()
        return c.json(await PrimaryAssistantRegistry.list({ config }))
      },
    )
    .get(
      "/providers",
      describeRoute({
        summary: "List providers for a new global task",
        description:
          "Resolve the provider/model catalog from global configuration without requiring an active project.",
        operationId: "global.providers.list",
        responses: {
          200: {
            description: "Global provider catalog",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    catalog: z.object({
                      all: Provider.Info.array(),
                      default: z.record(z.string(), z.string()),
                      connected: z.array(z.string()),
                      accountUsage: ProviderAccountUsage.Capabilities,
                      issues: Provider.LoadIssue.array(),
                    }),
                  }),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        const configIssues: Provider.LoadIssue[] = []
        const config = await Config.getGlobal().catch((error) => {
          const authError = Auth.findReadError(error)
          configIssues.push({
            phase: authError ? "auth.read" : "config.read",
            message: authError?.message ?? (error instanceof Error ? error.message : String(error)),
          })
          return {} as Config.Info
        })
        const disabled = new Set(config.disabled_providers ?? [])
        const enabled = config.enabled_providers ? new Set(config.enabled_providers) : undefined
        const loaded = await Provider.catalogGlobal(config)
        const database = loaded.database
        const connected = loaded.providers
        const providers = Object.fromEntries(
          Object.entries({ ...database, ...connected }).filter(([id]) =>
            enabled ? enabled.has(id) && !disabled.has(id) : !disabled.has(id),
          ),
        )
        return c.json({
          catalog: {
            all: Object.values(providers),
            default: Object.fromEntries(
              Object.entries(providers).flatMap(([id, provider]) => {
                const first = Provider.sort(Object.values(provider.models))[0]
                return first ? [[id, first.id]] : []
              }),
            ),
            connected: Object.keys(connected).filter((id) => id in providers),
            accountUsage: ProviderAccountUsage.capabilities(),
            issues: Provider.dedupeLoadIssues([...configIssues, ...loaded.issues]),
          },
        })
      },
    )
    .get(
      "/providers/:providerID/account-usage",
      describeRoute({
        summary: "Get global Provider account usage",
        description:
          "Fetch normalized account usage with global Provider configuration without requiring an active project.",
        operationId: "global.providers.account.usage",
        responses: {
          200: {
            description: "Provider account usage lookup result",
            content: { "application/json": { schema: resolver(ProviderAccountUsage.Response) } },
          },
          503: AuthReadUnavailableResponse,
        },
      }),
      validator("param", z.object({ providerID: z.string().trim().min(1) })),
      async (c) => c.json(await ProviderAccountUsage.read(c.req.valid("param").providerID, await Config.getGlobal())),
    )
    .get(
      "/providers/auth",
      describeRoute({
        summary: "Get global Provider auth methods",
        description: "Retrieve built-in Provider authentication methods without requiring an active project.",
        operationId: "global.providers.auth",
        responses: {
          200: {
            description: "Global Provider auth methods",
            content: {
              "application/json": { schema: resolver(z.record(z.string(), z.array(ProviderAuth.Method))) },
            },
          },
        },
      }),
      async (c) => c.json(await ProviderAuth.methods("global")),
    )
    .post(
      "/providers/:providerID/auth/prompts",
      describeRoute({
        summary: "Get global Provider auth prompts",
        description: "Return prompts for a built-in Provider authentication method without a project.",
        operationId: "global.providers.auth.prompts",
        responses: {
          200: {
            description: "Provider auth prompts",
            content: { "application/json": { schema: resolver(ProviderAuth.Prompt.array()) } },
          },
          ...errors(400),
        },
      }),
      validator("param", z.object({ providerID: z.string() })),
      validator(
        "json",
        z.object({
          method: z.number(),
          inputs: z.record(z.string(), z.string()).optional(),
        }),
      ),
      async (c) => {
        const { providerID } = c.req.valid("param")
        const { method, inputs } = c.req.valid("json")
        return c.json(await ProviderAuth.prompts({ providerID, method, inputs, scope: "global" }))
      },
    )
    .post(
      "/providers/:providerID/auth/execute",
      describeRoute({
        summary: "Execute global Provider auth",
        description: "Execute a built-in Provider authentication method without a project.",
        operationId: "global.providers.auth.execute",
        responses: {
          200: {
            description: "Provider auth executed",
            content: { "application/json": { schema: resolver(GlobalProviderAuthMutationResponse) } },
          },
          ...errors(400),
          503: AuthReadUnavailableResponse,
        },
      }),
      validator("param", z.object({ providerID: z.string() })),
      validator(
        "json",
        z.object({
          method: z.number(),
          inputs: z.record(z.string(), z.string()).optional(),
        }),
      ),
      async (c) => {
        const { providerID } = c.req.valid("param")
        const { method, inputs } = c.req.valid("json")
        await ProviderAuth.execute({ providerID, method, inputs, scope: "global" })
        const issues = await settleProviderRefreshInvalidation([
          { phase: "cache.provider", run: Provider.resetAll },
          { phase: "cache.primary-assistants", run: PrimaryAssistantRegistry.resetAll },
        ])
        return c.json({ ok: true as const, issues })
      },
    )
    .post(
      "/providers/:providerID/oauth/authorize",
      describeRoute({
        summary: "Authorize a global Provider subscription",
        description: "Start built-in Provider OAuth without requiring an active project.",
        operationId: "global.providers.oauth.authorize",
        responses: {
          200: {
            description: "Provider authorization",
            content: { "application/json": { schema: resolver(ProviderAuth.Authorization.optional()) } },
          },
          ...errors(400),
        },
      }),
      validator("param", z.object({ providerID: z.string() })),
      validator(
        "json",
        z.object({
          method: z.number(),
          inputs: z.record(z.string(), z.string()).optional(),
        }),
      ),
      async (c) => {
        const { providerID } = c.req.valid("param")
        const { method, inputs } = c.req.valid("json")
        return c.json(await ProviderAuth.authorize({ providerID, method, inputs, scope: "global" }))
      },
    )
    .post(
      "/providers/:providerID/oauth/callback",
      describeRoute({
        summary: "Complete global Provider subscription authorization",
        description: "Complete built-in Provider OAuth without requiring an active project.",
        operationId: "global.providers.oauth.callback",
        responses: {
          200: {
            description: "Provider authorization completed",
            content: { "application/json": { schema: resolver(GlobalProviderAuthMutationResponse) } },
          },
          ...errors(400),
          503: AuthReadUnavailableResponse,
        },
      }),
      validator("param", z.object({ providerID: z.string() })),
      validator(
        "json",
        z.object({
          method: z.number(),
          code: z.string().optional(),
          flowID: z.string().optional(),
        }),
      ),
      async (c) => {
        const { providerID } = c.req.valid("param")
        const { method, code, flowID } = c.req.valid("json")
        await ProviderAuth.callback({ providerID, method, code, flowID, scope: "global" })
        const issues = await settleProviderRefreshInvalidation([
          { phase: "cache.provider", run: Provider.resetAll },
          { phase: "cache.primary-assistants", run: PrimaryAssistantRegistry.resetAll },
        ])
        return c.json({ ok: true as const, issues })
      },
    )
    .post(
      "/providers/discover-models",
      describeRoute({
        summary: "Discover global Provider models",
        description: "Fetch an explicit OpenAI-compatible model endpoint using global Provider configuration.",
        operationId: "global.providers.discover.models",
        responses: {
          200: {
            description: "Discovered model identifiers",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    ok: z.boolean(),
                    models: z.array(z.string()),
                    count: z.number(),
                    error: z.string().optional(),
                  }),
                ),
              },
            },
          },
          ...errors(400),
          503: AuthReadUnavailableResponse,
        },
      }),
      validator(
        "json",
        z.object({
          api: z.string().min(1),
          apiKey: z.string().optional(),
          providerID: z.string().optional(),
        }),
      ),
      async (c) => {
        const result = await discoverProviderModels(c.req.valid("json"), {
          config: Config.getGlobal,
          global: true,
        })
        return c.json(result.body, result.status)
      },
    )
    .post(
      "/providers/:providerID/test",
      describeRoute({
        summary: "Test a global Provider connection",
        description: "Run a minimal live Provider request using global configuration without an active project.",
        operationId: "global.providers.test",
        responses: {
          200: {
            description: "Provider connection result",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    ok: z.boolean(),
                    status: z.enum(["connected", "error"]),
                    providerID: z.string(),
                    modelID: z.string(),
                    message: z.string(),
                  }),
                ),
              },
            },
          },
          ...errors(400),
          503: AuthReadUnavailableResponse,
        },
      }),
      validator("param", z.object({ providerID: z.string() })),
      validator("json", z.object({ modelID: z.string().optional() }).optional()),
      async (c) => {
        const result = await testProviderConnection(c.req.valid("param").providerID, c.req.valid("json")?.modelID, {
          config: Config.getGlobal,
          global: true,
        })
        return c.json(result.body, result.status)
      },
    )
    .post(
      "/providers/refresh",
      describeRoute({
        summary: "Refresh the global provider registry",
        description:
          "Refresh the canonical provider catalog declaration without requiring an active project. Configured live model identities use the separate models refresh route.",
        operationId: "global.providers.refresh",
        responses: {
          200: {
            description: "Refresh outcome",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    ok: z.boolean(),
                    fetchedAt: z.number().optional(),
                    error: z.string().optional(),
                    issues: Provider.LoadIssue.array().optional(),
                  }),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        const result = await Provider.refreshCatalog()
        if (result.ok) {
          const issues = await settleCanonicalProviderCatalogInvalidation()
          return c.json({ ...result, ...(issues.length > 0 ? { issues } : {}) })
        }
        return c.json(result)
      },
    )
    .delete(
      "/providers/:providerID",
      describeRoute({
        summary: "Delete a global provider",
        description:
          "Commit removal of the global provider declaration, provider model references, enabled or disabled references, and its saved credential under one durable mutation owner.",
        operationId: "global.providers.remove",
        responses: {
          200: {
            description: "Provider removal receipt",
            content: { "application/json": { schema: resolver(ProviderRemovalReceipt) } },
          },
          ...errors(400),
          503: AuthReadUnavailableResponse,
        },
      }),
      validator("param", z.object({ providerID: z.string().trim().min(1) })),
      async (c) =>
        c.json(
          await removeProvider({
            providerID: c.req.valid("param").providerID,
            scope: "global",
          }),
        ),
    )
    .post(
      "/providers/models/refresh",
      describeRoute({
        summary: "Refresh global configured provider model lists",
        description:
          "Refresh live model identities from saved global provider credentials without requiring an active project or refreshing the provider registry declaration.",
        operationId: "global.providers.models.refresh",
        responses: {
          200: {
            description: "Refresh result",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    ok: z.boolean(),
                    fetchedAt: z.number().optional(),
                    providers: z
                      .array(
                        z.object({
                          providerID: z.string(),
                          count: z.number(),
                          ids: z.array(z.string()),
                        }),
                      )
                      .optional(),
                    error: z.string().optional(),
                    issues: Provider.LoadIssue.array().optional(),
                  }),
                ),
              },
            },
          },
          503: AuthReadUnavailableResponse,
        },
      }),
      async (c) => {
        const result = await Provider.refreshModels(await Config.getGlobal())
        if (result.ok) {
          const issues = await settleCanonicalProviderCatalogInvalidation()
          return c.json({ ...result, ...(issues.length > 0 ? { issues } : {}) })
        }
        return c.json(result)
      },
    )
    .get(
      "/skill/market",
      describeRoute({
        summary: "List the global Skill market",
        description: "List the single current Skill Market provider without requiring an active project.",
        operationId: "global.skill.market",
        responses: {
          200: {
            description: "Skill market entries",
            content: { "application/json": { schema: resolver(SkillManager.MarketProvider.array()) } },
          },
        },
      }),
      async (c) => c.json(await SkillManager.market()),
    )
    .get(
      "/skill/market/search",
      describeRoute({
        summary: "Search the global Skill Market",
        description: "Search exact Skill candidates and project live global installation status.",
        operationId: "global.skill.market.search",
        responses: {
          200: {
            description: "Skill Market candidates",
            content: { "application/json": { schema: resolver(SkillManager.MarketEntry.array()) } },
          },
          ...errors(400, 502),
        },
      }),
      validator("query", SkillManager.MarketSearchInput),
      async (c) => c.json(await SkillManager.searchMarket(c.req.valid("query"))),
    )
    .get(
      "/skill/market/detail",
      describeRoute({
        summary: "Inspect a global Skill Market candidate",
        description: "Download and validate one exact candidate bundle without installing it.",
        operationId: "global.skill.market.detail",
        responses: {
          200: {
            description: "Validated Skill Market candidate detail",
            content: { "application/json": { schema: resolver(SkillManager.MarketDetail) } },
          },
          ...errors(400, 502),
        },
      }),
      validator("query", SkillManager.MarketInspectInput),
      async (c) => c.json(await SkillManager.inspectMarket(c.req.valid("query"))),
    )
    .post(
      "/skill/market/install",
      describeRoute({
        summary: "Install an inspected global Skill Market candidate",
        description: "Install exactly one candidate only when its current content matches the inspected digest.",
        operationId: "global.skill.market.install",
        responses: {
          200: {
            description: "Installed Skill Market candidate",
            content: { "application/json": { schema: resolver(SkillManager.MarketInstallResult) } },
          },
          ...errors(400, 502),
        },
      }),
      validator("json", SkillManager.MarketInstallInput),
      async (c) => c.json(await SkillManager.installMarket(c.req.valid("json"))),
    )
    .post(
      "/skill/install",
      describeRoute({
        summary: "Install a global Skill market source",
        description: "Install a git or URL Skill source into global configuration without an active project.",
        operationId: "global.skill.install",
        responses: {
          200: {
            description: "Installed Skill source",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    source: z.string(),
                    path: z.string().optional(),
                    kind: z.enum(["url", "git"]),
                  }),
                ),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "json",
        SkillManager.InstallInput.extend({
          kind: z.enum(["url", "git"]),
        }),
      ),
      async (c) => c.json(await SkillManager.install(c.req.valid("json"))),
    )
    .get(
      "/projects/discover",
      describeRoute({
        summary: "Discover local OpenCorvus projects",
        description:
          "List registered OpenCorvus project directories together with projects discovered in the server launch directory and its direct children. This is a control-plane discovery route and does not require an active project directory.",
        operationId: "global.projects.discover",
        responses: {
          200: {
            description: "Discovered projects",
            content: {
              "application/json": {
                schema: resolver(Project.Discovery),
              },
            },
          },
          ...errors(400, 500),
        },
      }),
      async (c) => c.json(await Project.discoverFromLaunchDirectory()),
    )
    .post(
      "/projects/anonymous",
      describeRoute({
        summary: "Create an anonymous project",
        description:
          "Create a dated anonymous Git project under the server-owned OpenCorvus application-data directory for a connected UI without an explicit project.",
        operationId: "global.projects.anonymous",
        responses: {
          201: {
            description: "Anonymous project",
            content: {
              "application/json": {
                schema: resolver(ImplicitProject.Anonymous),
              },
            },
          },
        },
      }),
      async (c) => c.json(ImplicitProject.Anonymous.parse(await ImplicitProject.create()), 201),
    )
    .get(
      "/event",
      describeRoute({
        summary: "Get global events",
        description: "Subscribe to global events from the OpenCorvus system using server-sent events.",
        operationId: "global.event",
        responses: {
          200: {
            description: "Event stream",
            content: {
              "text/event-stream": {
                schema: resolver(
                  z
                    .object({
                      directory: z.string(),
                      payload: BusEvent.payloads(),
                    })
                    .meta({
                      ref: "GlobalEvent",
                    }),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        log.info("global event connected")
        c.header("X-Accel-Buffering", "no")
        c.header("X-Content-Type-Options", "nosniff")
        return streamGlobalSSE(c, async (stream, bind) => {
          let heartbeat: ReturnType<typeof setInterval> | undefined
          let finishStream = () => {}
          let closed = false
          const cleanup = (input?: { closeStream?: boolean; error?: unknown }) => {
            if (closed) return
            closed = true
            if (heartbeat) clearInterval(heartbeat)
            GlobalBus.off("event", handler)
            if (input?.error) {
              log.warn("global event stream write failed", { error: errorMessage(input.error) })
            }
            if (input?.closeStream) stream.close()
            finishStream()
          }
          const finished = new Promise<void>((resolve) => {
            finishStream = resolve
          })
          let handler = (_event: any) => {}
          const writeData = (data: string) => {
            if (closed) return Promise.resolve()
            return stream.writeSSE({ data }).catch((error) => {
              cleanup({ closeStream: true, error })
            })
          }
          handler = bind((event: any) => {
            void writeData(JSON.stringify(event))
          })
          await writeData(JSON.stringify(globalEnvelope("global", ServerEvent.Connected, {})))
          if (closed) return
          GlobalBus.on("event", handler)

          // Send heartbeat every 10s to prevent stalled proxy streams.
          heartbeat = setInterval(
            bind(() => {
              void writeData(JSON.stringify(globalEnvelope("global", ServerEvent.Heartbeat, {})))
            }),
            10_000,
          )

          stream.onAbort(() => {
            cleanup()
            log.info("global event disconnected")
          })
          await finished
        })
      },
    )
    .get(
      "/config",
      describeRoute({
        summary: "Get global configuration",
        description: "Retrieve the current global OpenCorvus configuration settings and preferences.",
        operationId: "global.config.get",
        responses: {
          200: {
            description: "Get global config info",
            content: {
              "application/json": {
                schema: resolver(Config.Info),
              },
            },
          },
          409: namedErrorResponse("Non-canonical configuration file", "NonCanonicalConfigFileError"),
        },
      }),
      async (c) => {
        return c.json(await Config.getGlobal())
      },
    )
    .patch(
      "/config",
      describeRoute({
        summary: "Update global configuration",
        description: "Update global OpenCorvus configuration settings and preferences.",
        operationId: "global.config.update",
        responses: {
          200: {
            description: "Successfully updated global config",
            content: {
              "application/json": {
                schema: resolver(Config.Info),
              },
            },
          },
          ...errors(400),
          409: namedErrorResponse("Non-canonical configuration file", "NonCanonicalConfigFileError"),
          503: AuthReadUnavailableResponse,
        },
      }),
      validator("json", z.record(z.string(), z.unknown())),
      async (c) => {
        const partial = c.req.valid("json") as Config.ProjectMergePatch
        try {
          Config.assertNoProjectOwnedConfig(partial)
        } catch (error) {
          return c.json(badRequestBody(error instanceof Error ? error.message : String(error)), 400)
        }
        try {
          const next = await updateGlobalConfigPatch(partial)
          return c.json(next)
        } catch (error) {
          if (error instanceof Config.GlobalConfigCommittedReconcileError) {
            return c.json(Config.committedMutationReceipt(error), 409)
          }
          if (ConfigCandidateValidationError.isInstance(error)) {
            return c.json(badRequestBody(error.data.message), 400)
          }
          if (Config.InvalidError.isInstance(error)) {
            const issues = error.data.issues ?? []
            if (!issues) throw error
            const message = issues.map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`).join("; ")
            return c.json(badRequestBody(`global config: ${message}`), 400)
          }
          throw error
        }
      },
    )
    .post(
      "/dispose",
      describeRoute({
        summary: "Dispose instance",
        description: "Clean up and dispose all OpenCorvus instances, releasing all resources.",
        operationId: "global.dispose",
        responses: {
          200: {
            description: "Global disposed",
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
        const { ownedPromptControllersError, hasAnyOwnedPromptControllers } = await import("@/engine/runtime")
        if (hasAnyOwnedPromptControllers()) {
          throw ownedPromptControllersError("global.dispose")
        }
        await Instance.disposeAll()
        GlobalBus.emit("event", {
          directory: "global",
          payload: {
            type: ServerEvent.Disposed.type,
            properties: {},
          },
        })
        return c.json(true)
      },
    )
    .get(
      "/db/mysql/schema",
      describeRoute({
        summary: "Export MySQL staging schema",
        description:
          "Export the current OpenCorvus SQLite table shape as MySQL-compatible staging DDL plus the strict transfer schema fingerprint used by /global/db/mysql/import.",
        operationId: "global.db.mysql.schema",
        responses: {
          200: {
            description: "MySQL transfer schema",
            content: {
              "application/json": {
                schema: resolver(MysqlTransferSchemaExport),
              },
            },
          },
        },
      }),
      async (c) => c.json(mysqlSchemaExport()),
    )
    .get(
      "/db/mysql/export",
      describeRoute({
        summary: "Export MySQL transfer snapshot",
        description:
          "Export MySQL-compatible staging DDL and a strict JSON snapshot of the current SQLite data. The snapshot can be posted back to /global/db/mysql/import to rebuild the local DB.",
        operationId: "global.db.mysql.export",
        responses: {
          200: {
            description: "MySQL transfer package",
            content: {
              "application/json": {
                schema: resolver(MysqlTransferFullExport),
              },
            },
          },
        },
      }),
      async (c) => c.json(exportMysqlTransferPackage()),
    )
    .post(
      "/db/mysql/import",
      describeRoute({
        summary: "Import MySQL transfer snapshot",
        description:
          "DESTRUCTIVE. Rebuild the local SQLite DB from a strict MySQL transfer snapshot. This does not make MySQL a runtime DB; it is a one-shot transfer/import surface.",
        operationId: "global.db.mysql.import",
        responses: {
          200: {
            description: "Import result",
            content: {
              "application/json": {
                schema: resolver(MysqlTransferImportResult),
              },
            },
          },
          ...errors(400),
          409: OwnedPromptControllersResponse,
        },
      }),
      validator("json", z.object({ snapshot: MysqlTransferSnapshot })),
      async (c) => {
        const { ownedPromptControllersError, hasAnyOwnedPromptControllers } = await import("@/engine/runtime")
        if (hasAnyOwnedPromptControllers()) {
          throw ownedPromptControllersError("global.db.mysql.import")
        }
        const { snapshot } = c.req.valid("json")
        let plan
        try {
          plan = preflightMysqlTransferSnapshot(snapshot)
        } catch (err) {
          if (!MysqlTransferValidationError.isInstance(err)) throw err
          return c.json(badRequestBody(err.data.message), 400)
        }
        await Instance.disposeAll()
        const result: MysqlTransferImportResult = applyMysqlTransferPlan(plan)
        log.warn("db import via /global/db/mysql/import", {
          schemaFingerprint: result.schemaFingerprint,
          tables: result.tables.length,
        })
        return c.json(result)
      },
    ),
)
