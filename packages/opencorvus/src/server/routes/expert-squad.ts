import { ExpertSquadPackageManager } from "@/expert-squad/manager"
import {
  authorizeEvolutionPackageMutation,
  executeEvolutionPackageMutation,
} from "@/expert-squad/evolution-mutation"
import {
  EvolutionHistoryAuthorityError,
  readEvolutionCampaignDetail,
  readEvolutionHistory,
} from "@/expert-squad/evolution-history"
import {
  EngineArtifactLocatorSchema,
  EvolutionCampaignDetailRequestSchema,
  EvolutionCampaignDetailResponseSchema,
  EvolutionHistoryListQuerySchema,
  EvolutionHistoryListResponseSchema,
  EvolutionMutationAuthorizationRequestSchema,
  EvolutionMutationAuthorizationResultSchema,
  EvolutionMutationRequestSchema,
  EvolutionPromotionReceiptSchema,
} from "@opencorvus-ai/plugin"
import { ExpertSquadPackageLocations } from "@/expert-squad/locations"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { Config } from "@/config/config"
import { EffectiveConfig } from "@/config/effective"
import { PromptProfile, PromptProfileConfigSchema } from "@/agent/prompt-profile"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { NamedError } from "@opencorvus-ai/util/error"
import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { errors, namedErrorResponse } from "../error"
import {
  ExpertSquadCatalogInspectionQuerySchema,
  ExpertSquadCatalogInspectionSchema,
  ExpertSquadCatalogPageSchema,
  ExpertSquadCatalogSchema,
  ExpertSquadCatalogSearchQuerySchema,
  ExpertSquadDiagnosticPageSchema,
  ExpertSquadInventoryStatusSchema,
  ExpertSquadSettingsDetailQuerySchema,
  ExpertSquadSettingsDetailSchema,
} from "@/expert-squad/catalog"
import {
  MulticaExpertSquadImport,
  MulticaImportPreviewSchema,
  MulticaOpenCorvusMappingSchema,
  MulticaSquadCatalogSchema,
} from "@/expert-squad/multica-import"
import { assertActiveProjectSession } from "../active-project-session"
import { ExpertSquadRegistry } from "@/expert-squad/registry"
import { Project } from "@/project/project"
import { updateGlobalConfigPatch } from "@/config/update-global"
import { BASE_EXPERT_SQUAD_ID } from "@/expert-squad/builtin"
import { PackageUpdateClient } from "@/package-update/client"
import {
  ExpertSquadConfigurationResponseSchema,
  ExpertSquadConfigurationStore,
  ExpertSquadConfigurationUpdateSchema,
} from "@/expert-squad/configuration"
import { ExpertSquadIDSchema, ExpertSquadNamespaceSchema } from "@/expert-squad/id"
import { NotFoundError } from "@/storage/db"
import { taskRootOwnsPackageRevisionBinding } from "@/engine/task-package-revision-binding"
import { taskPackageRevisionForSession } from "@/engine/task-package-projection"

export const ExpertSquadPackageError = NamedError.create(
  "ExpertSquadPackageError",
  z.object({
    message: z.string(),
  }),
)

const ImportFolderInput = z
  .object({
    sourceDirectory: z.string().min(1),
    expectedCurrentPackageDigest: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    installationScope: ExpertSquadPackageLocations.InstallationScopeSchema,
  })
  .strict()

const ValidateFolderInput = z
  .object({
    sourceDirectory: z.string().min(1),
  })
  .strict()

const ImportFileInput = z
  .object({
    archiveBase64: z.string().min(1),
    filename: z.string().min(1).optional(),
    expectedCurrentPackageDigest: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    installationScope: ExpertSquadPackageLocations.InstallationScopeSchema,
  })
  .strict()

const ImportExactFileInput = ImportFileInput.extend({
  expectedNamespace: ExpertSquadNamespaceSchema,
  expectedID: ExpertSquadIDSchema,
  expectedVersion: z.string().min(1),
  expectedPackageDigest: z.string().regex(/^[a-f0-9]{64}$/),
})

const ExportInput = z
  .object({
    id: z.string().min(1),
    installationScope: ExpertSquadPackageLocations.InstallationScopeSchema,
  })
  .strict()

const ReleasePayloadInput = z.object({}).strict()

const CatalogQuery = z.object({
  sessionID: z
    .string()
    .optional()
    .meta({ description: "Optional root or child session id for session-effective expert-squad catalog view" }),
})

const InstallPayloadInput = z
  .object({
    id: z.string().min(1),
    installationScope: ExpertSquadPackageLocations.InstallationScopeSchema,
  })
  .strict()

const UpdateInput = z
  .object({
    id: z.string().min(1),
    installationScope: ExpertSquadPackageLocations.InstallationScopeSchema,
    source: PackageUpdateClient.Source,
    expectedCurrentPackageDigest: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()

const UninstallInput = z
  .object({
    id: z.string().min(1),
    installationScope: ExpertSquadPackageLocations.InstallationScopeSchema,
    replacementID: z.literal(BASE_EXPERT_SQUAD_ID),
  })
  .strict()

const MulticaPreviewInput = z
  .object({
    squadID: z.string().uuid(),
    mapping: MulticaOpenCorvusMappingSchema,
  })
  .strict()

const InstalledPackageRevision = z.object({
  installationScope: ExpertSquadPackageLocations.InstallationScopeSchema,
  projectDirectory: z.string().nullable(),
  namespace: z.string(),
  id: z.string(),
  version: z
    .string()
    .nullable()
    .describe("Manifest version of the package bytes present at targetRoot after the operation."),
  packageDigest: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .describe("Canonical digest of the package bytes present at targetRoot after the operation."),
  targetRoot: z.string(),
}).strict()

const PackageMutationReceipt = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("installed"), before: z.null(), after: InstalledPackageRevision }).strict(),
  z.object({ operation: z.literal("unchanged"), before: InstalledPackageRevision, after: InstalledPackageRevision }).strict(),
  z.object({ operation: z.literal("replaced"), before: InstalledPackageRevision, after: InstalledPackageRevision }).strict(),
  z.object({ operation: z.literal("restored"), before: InstalledPackageRevision, after: InstalledPackageRevision }).strict(),
])

const ReleasePayloadResult = z.object({
  installed: z.array(PackageMutationReceipt),
  skipped: z.array(PackageMutationReceipt),
})

const PayloadMarketAgent = z
  .object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
    base_role: z.string(),
  })
  .strict()

const PayloadMarketItem = z
  .object({
    namespace: z.string(),
    id: z.string(),
    name: z.string(),
    label: z.string(),
    description: z.string().optional(),
    version: z.string(),
    package_digest: z.string().regex(/^[a-f0-9]{64}$/),
    selector_summary: z.string(),
    agents: z.array(PayloadMarketAgent),
    skill_count: z.number().int().nonnegative(),
    tool_count: z.number().int().nonnegative(),
    mcp_count: z.number().int().nonnegative(),
    installations: z.array(
      z
        .object({
          installation_scope: ExpertSquadPackageLocations.InstallationScopeSchema,
          installed_version: z.string().nullable(),
          installed_package_digest: z.string().regex(/^[a-f0-9]{64}$/),
          update_available: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict()

const PayloadMarketIndexItem = z
  .object({
    namespace: z.string().min(1).max(160),
    id: z.string().min(1).max(160),
    name: z.string().min(1).max(160),
    label: z.string().min(1).max(160),
    description: z.string().min(1).max(1_000).optional(),
    version: z.string().min(1).max(80),
    installation_scopes: z.array(ExpertSquadPackageLocations.InstallationScopeSchema).max(2),
  })
  .strict()
const PayloadMarketPage = z
  .object({
    catalog_revision: z.string().regex(/^[a-f0-9]{64}$/),
    entries: z.array(PayloadMarketIndexItem).max(20),
    next_cursor: z.string().nullable(),
    total_count: z.number().int().nonnegative(),
  })
  .strict()
const InstallPayloadResult = PackageMutationReceipt
const EvolutionMutationResult = z
  .object({
    locator: EngineArtifactLocatorSchema,
    receipt: EvolutionPromotionReceiptSchema,
  })
  .strict()
const UpdateResult = z
  .object({
    source: PackageUpdateClient.Source,
    receipt: PackageMutationReceipt,
  })
  .strict()
const UninstallResult = z
  .object({
    namespace: z.string(),
    id: z.string(),
    targetRoot: z.string(),
    installationScope: ExpertSquadPackageLocations.InstallationScopeSchema,
    replacementID: z.literal(BASE_EXPERT_SQUAD_ID),
    replacedReferences: z
      .object({
        global: z.number().int().nonnegative(),
        projects: z.number().int().nonnegative(),
        sessions: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict()

const ExportResult = z.object({
  namespace: z.string(),
  id: z.string(),
  version: z.string(),
  packageDigest: z.string().regex(/^[a-f0-9]{64}$/),
  filename: z.string(),
  archiveBase64: z.string(),
  archiveSha256: z.string().regex(/^[a-f0-9]{64}$/),
  fileCount: z.number().int().nonnegative(),
})

async function rootSession(sessionID: string): Promise<Session.Info> {
  let current = await Session.get(sessionID)
  for (let hops = 0; current.parentID; hops++) {
    if (hops >= 64) throw new Error(`Session parent chain for ${sessionID} exceeds 64 hops`)
    current = await Session.get(current.parentID)
  }
  return current
}

async function resolvedCatalog(query: z.output<typeof CatalogQuery>) {
  if (!query.sessionID) {
    const config = await Config.get()
    return await PromptProfileResolver.catalog({
      config,
      projectActive: PromptProfile.activeID(config),
      sessionOverride: null,
      scope: { kind: "project", directory: Instance.project.worktree },
    })
  }

  await assertActiveProjectSession(query.sessionID)
  const [projectConfig, effectiveConfig, projectDirectory, owner] = await Promise.all([
    EffectiveConfig.base({ sessionID: query.sessionID }),
    EffectiveConfig.effective({ sessionID: query.sessionID }),
    EffectiveConfig.capabilityProjectDirectory({ sessionID: query.sessionID }),
    rootSession(query.sessionID),
  ])
  return await PromptProfileResolver.catalog({
    config: effectiveConfig,
    projectActive: PromptProfile.activeID(projectConfig),
    sessionOverride: sessionPromptProfileOverride(owner),
    scope: { kind: "session", directory: projectDirectory, sessionID: owner.id },
    packageRevision: taskPackageRevisionForSession(owner.id),
  })
}

function sessionPromptProfileOverride(session: Session.Info): string | null {
  const stored = session.metadata?.configOverlay ?? {}
  const overlay = Config.Overlay.parse(stored)
  const active = overlay.prompt_profile?.active
  return typeof active === "string" ? active : null
}

async function packageRoute<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (
      error instanceof ExpertSquadPackageError ||
      error instanceof EvolutionHistoryAuthorityError ||
      error instanceof ExpertSquadPackageManager.ExpertSquadPackageMutationConflictError
    ) {
      throw error
    }
    throw new ExpertSquadPackageError(
      {
        message: error instanceof Error ? error.message : String(error),
      },
      { cause: error },
    )
  }
}

async function packageConfiguration(input: {
  id: string
  installationScope: ExpertSquadPackageLocations.InstallationScope
}) {
  const parsedID = ExpertSquadIDSchema.parse(input.id)
  const entry = (await ExpertSquadRegistry.discoverInstalledPackageIdentities(Instance.project.worktree)).find(
    (candidate) => candidate.id === parsedID && candidate.location === input.installationScope,
  )
  if (!entry) throw new Error(`Unknown ${input.installationScope} expert squad installation ${parsedID}`)
  const loaded = await ExpertSquadRegistry.loadCatalogPackage(entry.root)
  if (!loaded.manifest.configuration) throw new Error(`Expert squad ${parsedID} does not declare configuration`)
  return {
    identity: {
      installationScope: input.installationScope,
      projectID: input.installationScope === "project" ? Instance.project.id : null,
      namespace: entry.namespace,
      id: parsedID,
    },
    configuration: loaded.manifest.configuration,
  }
}

async function replacePackageReferences(input: {
  id: string
  installationScope: ExpertSquadPackageLocations.InstallationScope
  replacementID: typeof BASE_EXPERT_SQUAD_ID
  projectDirectory: string
}): Promise<{ global: number; projects: number; sessions: number }> {
  const replaced = { global: 0, projects: 0, sessions: 0 }
  const installed = await ExpertSquadRegistry.discoverInstalledPackageIdentities(input.projectDirectory)
  if (input.installationScope === "project") {
    const globalReplacement = installed.some((identity) => identity.id === input.id && identity.location === "global")
    if (globalReplacement) return replaced
  } else {
    const global = await Config.getGlobal()
    if (PromptProfileConfigSchema.parse(global.prompt_profile).active === input.id) {
      await updateGlobalConfigPatch({ prompt_profile: { active: input.replacementID } })
      replaced.global++
    }
  }
  const registeredProjects = [...Project.list()]
  if (!registeredProjects.some((project) => project.id === Instance.project.id)) {
    registeredProjects.push(Instance.project)
  }
  const projectTargets =
    input.installationScope === "project"
      ? [{ directory: input.projectDirectory, localOverride: false }]
      : await Promise.all(
          registeredProjects.map(async (project) => {
            const localOverride = (
              await ExpertSquadRegistry.discoverInstalledPackageIdentities(project.worktree)
            ).some((identity) => identity.id === input.id && identity.location === "project")
            return { directory: project.worktree, localOverride }
          }),
        )
  for (const target of projectTargets) {
    if (target.localOverride) continue
    await Instance.provide({
      directory: target.directory,
      fn: async () => {
        const projectConfig = await Config.getProject()
        if (PromptProfileConfigSchema.parse(projectConfig.prompt_profile).active === input.id) {
          await Config.updateProjectPatch({ prompt_profile: { active: input.replacementID } })
          replaced.projects++
        }
        for (const session of Session.list({ roots: true, limit: 10_000 })) {
          if (sessionPromptProfileOverride(session) === input.id) {
            if (taskRootOwnsPackageRevisionBinding({ projectID: Instance.project.id, sessionID: session.id })) continue
            await Session.mergeConfigOverlayInProject({
              sessionID: session.id,
              projectID: Instance.project.id,
              patch: { prompt_profile: { active: input.replacementID } },
            })
            replaced.sessions++
          }
        }
      },
    })
  }
  return replaced
}

async function assertEmptyJsonBody(input: {
  header: (name: string) => string | undefined
  json: () => Promise<unknown>
}) {
  const contentType = input.header("content-type") ?? ""
  if (!contentType.toLowerCase().includes("application/json")) return
  let body: unknown
  try {
    body = await input.json()
  } catch (error) {
    throw new ExpertSquadPackageError(
      {
        message: "Expert squad payload release requires valid JSON when the content type is application/json",
      },
      { cause: error },
    )
  }
  const parsed = ReleasePayloadInput.safeParse(body)
  if (!parsed.success) {
    throw new ExpertSquadPackageError({
      message: "Expert squad payload release does not accept request body fields",
    })
  }
}

export function ExpertSquadRoutes() {
  return new Hono()
    .get(
      "/catalog",
      describeRoute({
        summary: "Resolve the active expert-squad capability projection",
        description:
          "Returns only the active runtime projection for the current project or session. Use bounded search and exact inspection for inactive packages. Task sessions remain pinned to their creation-time package revision.",
        operationId: "expertSquad.catalog",
        responses: {
          200: {
            description: "Expert squad catalog",
            content: {
              "application/json": {
                schema: resolver(ExpertSquadCatalogSchema),
              },
            },
          },
          ...errors(400, 500),
          404: namedErrorResponse("Expert Squad not found", "NotFoundError"),
        },
      }),
      validator("query", CatalogQuery),
      async (c) => {
        return c.json(await resolvedCatalog(c.req.valid("query")))
      },
    )
    .get(
      "/search",
      describeRoute({
        summary: "Search expert-squad declarations",
        description:
          "Returns at most twenty manifest-derived entries and an opaque cursor. Rich selector guidance and full package detail require exact follow-up requests.",
        operationId: "expertSquad.search",
        responses: {
          200: {
            description: "Bounded expert-squad search page",
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
            projectDirectory: Instance.project.worktree,
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
      "/inventory-status",
      describeRoute({
        summary: "Get expert-squad inventory status",
        description:
          "Returns declaration and diagnostic counts without package bodies or unbounded diagnostic arrays.",
        operationId: "expertSquad.inventoryStatus",
        responses: {
          200: {
            description: "Expert-squad inventory status",
            content: { "application/json": { schema: resolver(ExpertSquadInventoryStatusSchema) } },
          },
          ...errors(400, 500),
        },
      }),
      async (c) => c.json(await PromptProfileResolver.settingsInventory(Instance.project.worktree)),
    )
    .get(
      "/inspect",
      describeRoute({
        summary: "Inspect one expert-squad declaration",
        description:
          "Returns bounded selector and workflow guidance for one exact effective or physical installation identity.",
        operationId: "expertSquad.inspect",
        responses: {
          200: {
            description: "Expert-squad declaration inspection",
            content: { "application/json": { schema: resolver(ExpertSquadCatalogInspectionSchema) } },
          },
          ...errors(400, 500),
          404: namedErrorResponse("Expert Squad not found", "NotFoundError"),
        },
      }),
      validator("query", ExpertSquadCatalogInspectionQuerySchema),
      async (c) => {
        const query = c.req.valid("query")
        const selected = await PromptProfileResolver.catalogInspection({
          projectDirectory: Instance.project.worktree,
          id: query.id,
          installationScope: "installationScope" in query ? query.installationScope : undefined,
          namespace: "namespace" in query ? query.namespace : undefined,
          workflowCursor: query.workflowCursor,
        })
        if (!selected) throw new NotFoundError({ message: `Expert squad not found: ${query.id}` })
        return c.json(selected)
      },
    )
    .get(
      "/diagnostics",
      describeRoute({
        summary: "Page Expert Squad discovery diagnostics",
        description: "Returns at most 20 discovery issues or override warnings from the current catalog snapshot.",
        operationId: "expertSquad.diagnostics",
        responses: {
          200: {
            description: "Bounded Expert Squad diagnostics",
            content: { "application/json": { schema: resolver(ExpertSquadDiagnosticPageSchema) } },
          },
          ...errors(400, 500),
        },
      }),
      validator(
        "query",
        z.object({ cursor: z.string().min(1).optional(), limit: z.coerce.number().int().min(1).max(20).default(20) }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        return c.json(
          await PromptProfileResolver.catalogDiagnostics({
            projectDirectory: Instance.project.worktree,
            cursor: query.cursor,
            limit: query.limit,
          }),
        )
      },
    )
    .get(
      "/settings/detail",
      describeRoute({
        summary: "Load one full expert-squad settings declaration",
        description:
          "Loads README, selector instructions, digest, and runtime declaration only for one exact selected identity.",
        operationId: "expertSquad.settingsDetail",
        responses: {
          200: {
            description: "Exact expert-squad settings detail",
            content: { "application/json": { schema: resolver(ExpertSquadSettingsDetailSchema) } },
          },
          ...errors(400, 500),
          404: namedErrorResponse("Expert Squad not found", "NotFoundError"),
        },
      }),
      validator("query", ExpertSquadSettingsDetailQuerySchema),
      async (c) => {
        const query = c.req.valid("query")
        const selected = await PromptProfileResolver.settingsDetail({
          projectDirectory: Instance.project.worktree,
          id: query.id,
          installationScope: query.installationScope,
          namespace: "namespace" in query ? query.namespace : undefined,
        })
        if (!selected) throw new NotFoundError({ message: `Expert squad not found: ${query.id}` })
        return c.json(
          ExpertSquadSettingsDetailSchema.parse({
            scope: { kind: "project", directory: Instance.project.worktree },
            selected,
          }),
        )
      },
    )
    .get(
      "/market",
      describeRoute({
        summary: "Browse bundled expert squads",
        description:
          "Returns a bounded manifest-derived page of bundled expert-squad payload packages. Rich package and update detail is loaded only for an exact selection.",
        operationId: "expertSquad.market",
        responses: {
          200: {
            description: "Expert squad market entries",
            content: {
              "application/json": {
                schema: resolver(PayloadMarketPage),
              },
            },
          },
          400: namedErrorResponse("Expert squad market rejected", "ExpertSquadPackageError"),
        },
      }),
      validator(
        "query",
        z.object({
          query: z.string().max(500).default(""),
          availability: z.enum(["all", "available", "installed"]).default("all"),
          cursor: z.string().min(1).optional(),
          limit: z.coerce.number().int().min(1).max(20).default(20),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        const page = await packageRoute(() =>
          ExpertSquadPackageManager.payloadMarketPage({
            projectDirectory: Instance.project.worktree,
            query: query.query,
            availability: query.availability,
            cursor: query.cursor,
            limit: query.limit,
          }),
        )
        return c.json(
          PayloadMarketPage.parse({
            catalog_revision: page.catalogRevision,
            entries: page.entries.map((item) => ({
              namespace: item.namespace,
              id: item.id,
              name: item.name,
              label: item.label,
              description: item.description,
              version: item.version,
              installation_scopes: item.installationScopes,
            })),
            next_cursor: page.nextCursor,
            total_count: page.totalCount,
          }),
        )
      },
    )
    .get(
      "/market/detail",
      describeRoute({
        summary: "Inspect one bundled expert squad",
        description:
          "Returns digest, selector, agents, capability counts, and exact installation revisions for one selection.",
        operationId: "expertSquad.marketDetail",
        responses: {
          200: {
            description: "Bundled expert-squad detail",
            content: { "application/json": { schema: resolver(PayloadMarketItem) } },
          },
          400: namedErrorResponse("Expert squad market rejected", "ExpertSquadPackageError"),
          404: namedErrorResponse("Expert Squad not found", "NotFoundError"),
        },
      }),
      validator("query", z.object({ id: ExpertSquadIDSchema })),
      async (c) => {
        const item = await packageRoute(() =>
          ExpertSquadPackageManager.payloadMarketDetail({
            projectDirectory: Instance.project.worktree,
            id: c.req.valid("query").id,
          }),
        )
        if (!item)
          throw new NotFoundError({ message: `Expert squad market package not found: ${c.req.valid("query").id}` })
        return c.json(
          PayloadMarketItem.parse({
            namespace: item.namespace,
            id: item.id,
            name: item.name,
            label: item.label,
            description: item.description,
            version: item.version,
            package_digest: item.packageDigest,
            selector_summary: item.selectorSummary,
            agents: item.agents.map((agent) => ({
              id: agent.id,
              label: agent.label,
              description: agent.description,
              base_role: agent.baseRole,
            })),
            skill_count: item.skillCount,
            tool_count: item.toolCount,
            mcp_count: item.mcpCount,
            installations: item.installations.map((installation) => ({
              installation_scope: installation.installationScope,
              installed_version: installation.installedVersion,
              installed_package_digest: installation.installedPackageDigest,
              update_available: installation.updateAvailable,
            })),
          }),
        )
      },
    )
    .get(
      "/configuration",
      describeRoute({
        summary: "Get expert squad configuration",
        description:
          "Returns declared configuration fields and redacted configured state for one installed expert squad. Secret values are never returned.",
        operationId: "expertSquad.configuration.get",
        responses: {
          200: {
            description: "Expert squad configuration",
            content: { "application/json": { schema: resolver(ExpertSquadConfigurationResponseSchema) } },
          },
          400: namedErrorResponse("Expert squad configuration rejected", "ExpertSquadPackageError"),
        },
      }),
      validator(
        "query",
        z.object({
          id: ExpertSquadIDSchema,
          installationScope: ExpertSquadPackageLocations.InstallationScopeSchema,
        }),
      ),
      async (c) => {
        const input = c.req.valid("query")
        return c.json(
          await packageRoute(async () => ExpertSquadConfigurationStore.inspect(await packageConfiguration(input))),
        )
      },
    )
    .put(
      "/configuration",
      describeRoute({
        summary: "Update expert squad configuration",
        description:
          "Atomically updates or clears declared user-global configuration fields for one installed expert squad. Secret values remain write-only.",
        operationId: "expertSquad.configuration.update",
        responses: {
          200: {
            description: "Updated expert squad configuration",
            content: { "application/json": { schema: resolver(ExpertSquadConfigurationResponseSchema) } },
          },
          400: namedErrorResponse("Expert squad configuration update rejected", "ExpertSquadPackageError"),
        },
      }),
      validator("json", ExpertSquadConfigurationUpdateSchema),
      async (c) => {
        const input = c.req.valid("json")
        return c.json(
          await packageRoute(async () => {
            const target = await packageConfiguration(input)
            return ExpertSquadConfigurationStore.update({
              ...target,
              updates: input.updates,
            })
          }),
        )
      },
    )
    .get(
      "/multica/squads",
      describeRoute({
        summary: "List Multica squads with expert-squad installation status",
        description:
          "Reads the official default local Multica configuration server-side and lists every workspace squad with complete members and authoritative exact-ID installation status from the global and current-project catalog, without exposing the personal access token to Overlay.",
        operationId: "expertSquad.multicaSquads",
        responses: {
          200: {
            description: "Multica squad catalog",
            content: {
              "application/json": {
                schema: resolver(MulticaSquadCatalogSchema),
              },
            },
          },
          400: namedErrorResponse("Multica squad catalog rejected", "ExpertSquadPackageError"),
        },
      }),
      async (c) =>
        c.json(
          await packageRoute(() => MulticaExpertSquadImport.catalog({ projectDirectory: Instance.project.worktree })),
        ),
    )
    .post(
      "/multica/preview",
      describeRoute({
        summary: "Preview a Multica squad import",
        description:
          "Fetches and validates the selected Multica squad graph and returns its canonical target identity, source digest, blockers, and non-portable evidence without writing project state.",
        operationId: "expertSquad.multicaPreview",
        responses: {
          200: {
            description: "Multica import preview",
            content: {
              "application/json": {
                schema: resolver(MulticaImportPreviewSchema),
              },
            },
          },
          400: namedErrorResponse("Multica squad preview rejected", "ExpertSquadPackageError"),
        },
      }),
      validator("json", MulticaPreviewInput),
      async (c) => {
        const input = c.req.valid("json")
        return c.json(
          await packageRoute(() =>
            MulticaExpertSquadImport.preview({
              projectDirectory: Instance.project.worktree,
              squadID: input.squadID,
              mapping: input.mapping,
            }),
          ),
        )
      },
    )
    .post(
      "/install-payload",
      describeRoute({
        summary: "Install one bundled expert squad",
        description:
          "Installs the selected bundled expert-squad payload package into the explicitly selected project or user-global catalog without activating or overwriting it. If that scope already contains the package, installed is false and version/packageDigest describe the existing bytes at targetRoot.",
        operationId: "expertSquad.installPayload",
        responses: {
          200: {
            description: "Expert squad package installation result",
            content: {
              "application/json": {
                schema: resolver(InstallPayloadResult),
              },
            },
          },
          400: namedErrorResponse("Expert squad market install rejected", "ExpertSquadPackageError"),
          409: namedErrorResponse("Expert squad package changed", "ExpertSquadPackageMutationConflictError"),
        },
      }),
      validator("json", InstallPayloadInput),
      async (c) => {
        const input = c.req.valid("json")
        return c.json(
          await packageRoute(() =>
            ExpertSquadPackageManager.installPayloadPackage({
              projectDirectory: Instance.project.worktree,
              id: input.id,
              installationScope: input.installationScope,
            }),
          ),
        )
      },
    )
    .post(
      "/update",
      describeRoute({
        summary: "Update an installed expert squad",
        description:
          "Atomically replaces one exact installed expert-squad package from the current application payload or configured update server without changing prompt_profile.active.",
        operationId: "expertSquad.update",
        responses: {
          200: {
            description: "Updated expert squad package",
            content: { "application/json": { schema: resolver(UpdateResult) } },
          },
          400: namedErrorResponse("Expert squad update rejected", "ExpertSquadPackageError"),
          409: namedErrorResponse("Expert squad package changed", "ExpertSquadPackageMutationConflictError"),
        },
      }),
      validator("json", UpdateInput),
      async (c) => {
        const input = c.req.valid("json")
        return c.json(
          await packageRoute(() =>
            ExpertSquadPackageManager.updatePackage({
              projectDirectory: Instance.project.worktree,
              id: input.id,
              installationScope: input.installationScope,
              source: input.source,
              expectedCurrentPackageDigest: input.expectedCurrentPackageDigest,
            }),
          ),
        )
      },
    )
    .post(
      "/evolution-authorization",
      describeRoute({
        summary: "Authorize an expert squad evolution mutation",
        description:
          "Revalidates immutable evolution evidence, records the exact confirmation as one ordinary visible Task-root user Turn, and wakes the existing Orchestrator conversation.",
        operationId: "expertSquad.evolutionAuthorization",
        responses: {
          200: {
            description: "Visible expert squad evolution authorization Message",
            content: { "application/json": { schema: resolver(EvolutionMutationAuthorizationResultSchema) } },
          },
          400: namedErrorResponse("Expert squad evolution authorization rejected", "ExpertSquadPackageError"),
        },
      }),
      validator("json", EvolutionMutationAuthorizationRequestSchema),
      async (c) => c.json(await packageRoute(() => authorizeEvolutionPackageMutation(c.req.valid("json")))),
    )
    .post(
      "/evolution-mutation",
      describeRoute({
        summary: "Execute an authorized expert squad evolution mutation",
        description:
          "Verifies one exact visible user confirmation and immutable evolution evidence, performs one package-manager compare-and-swap promotion or restoration, and publishes the Core-owned receipt.",
        operationId: "expertSquad.evolutionMutation",
        responses: {
          200: {
            description: "Authorized expert squad evolution mutation receipt",
            content: { "application/json": { schema: resolver(EvolutionMutationResult) } },
          },
          400: namedErrorResponse("Expert squad evolution mutation rejected", "ExpertSquadPackageError"),
          409: namedErrorResponse("Expert squad package changed", "ExpertSquadPackageMutationConflictError"),
        },
      }),
      validator("json", EvolutionMutationRequestSchema),
      async (c) => {
        const input = c.req.valid("json")
        return c.json(await packageRoute(() => executeEvolutionPackageMutation(input)))
      },
    )
    .get(
      "/evolution-history",
      describeRoute({
        summary: "Read expert squad evolution history",
        description:
          "Reads one current Project's immutable Evolution Artifact graph for an exact installed project or global expert-squad target at a frozen Artifact Catalog revision.",
        operationId: "expertSquad.evolutionHistory",
        responses: {
          200: {
            description: "Project-scoped expert squad evolution history",
            content: { "application/json": { schema: resolver(EvolutionHistoryListResponseSchema) } },
          },
          400: namedErrorResponse("Expert squad evolution history rejected", "ExpertSquadPackageError"),
        },
      }),
      validator("query", EvolutionHistoryListQuerySchema),
      async (c) => c.json(await packageRoute(() => readEvolutionHistory(c.req.valid("query")))),
    )
    .post(
      "/evolution-history/detail",
      describeRoute({
        summary: "Read one exact expert squad evolution campaign",
        description:
          "Validates one current-Project Campaign root before reading its exact Candidate, Comparison, run, evaluation, scorer, integrity, and mutation receipt graph inside one frozen Artifact Catalog snapshot.",
        operationId: "expertSquad.evolutionHistoryDetail",
        responses: {
          200: {
            description: "Exact expert squad evolution campaign detail",
            content: { "application/json": { schema: resolver(EvolutionCampaignDetailResponseSchema) } },
          },
          400: namedErrorResponse(
            "Expert squad evolution campaign detail rejected",
            "ExpertSquadPackageError",
            "EvolutionHistoryAuthorityError",
          ),
        },
      }),
      validator("json", EvolutionCampaignDetailRequestSchema),
      async (c) => c.json(await packageRoute(() => readEvolutionCampaignDetail(c.req.valid("json")))),
    )
    .post(
      "/uninstall",
      describeRoute({
        summary: "Uninstall an expert squad package",
        description:
          "Explicitly replaces exact global, registered-project, and root-session references with Base, then deletes one non-built-in package from its exact project or user-global installation scope.",
        operationId: "expertSquad.uninstall",
        responses: {
          200: {
            description: "Uninstalled expert squad package",
            content: { "application/json": { schema: resolver(UninstallResult) } },
          },
          400: namedErrorResponse("Expert squad uninstall rejected", "ExpertSquadPackageError"),
        },
      }),
      validator("json", UninstallInput),
      async (c) => {
        const input = c.req.valid("json")
        return c.json(
          await packageRoute(async () => {
            const result = await ExpertSquadPackageManager.uninstallPackage({
              projectDirectory: Instance.project.worktree,
              id: input.id,
              installationScope: input.installationScope,
              beforeRemove: () =>
                replacePackageReferences({
                  id: input.id,
                  installationScope: input.installationScope,
                  replacementID: input.replacementID,
                  projectDirectory: Instance.project.worktree,
                }),
            })
            return {
              namespace: result.namespace,
              id: result.id,
              targetRoot: result.targetRoot,
              installationScope: result.installationScope,
              replacementID: input.replacementID,
              replacedReferences: result.beforeRemove,
            }
          }),
        )
      },
    )
    .post(
      "/release-payload",
      describeRoute({
        summary: "Release bundled expert-squad packages",
        description:
          "Explicitly provisions bundled expert-squad payload packages into the current project's namespaced .opencorvus expert-squads catalog without overwriting existing packages.",
        operationId: "expertSquad.releasePayload",
        responses: {
          200: {
            description: "Bundled expert-squad package release result",
            content: {
              "application/json": {
                schema: resolver(ReleasePayloadResult),
              },
            },
          },
          400: namedErrorResponse("Expert squad package release rejected", "ExpertSquadPackageError"),
          409: namedErrorResponse("Expert squad package changed", "ExpertSquadPackageMutationConflictError"),
        },
      }),
      async (c) => {
        await assertEmptyJsonBody(c.req)
        return c.json(
          await packageRoute(() =>
            ExpertSquadPackageManager.releasePayloadPackages({
              projectDirectory: Instance.project.worktree,
            }),
          ),
        )
      },
    )
    .post(
      "/validate-folder",
      describeRoute({
        summary: "Validate an expert squad source folder",
        description:
          "Validates a local expert-squad source folder through the runtime registry without installing, activating, or mutating a project package.",
        operationId: "expertSquad.validateFolder",
        responses: {
          200: {
            description: "Validated expert squad manifest",
            content: {
              "application/json": {
                schema: resolver(ExpertSquadRegistry.ManifestSchema),
              },
            },
          },
          400: namedErrorResponse("Expert squad package validation rejected", "ExpertSquadPackageError"),
        },
      }),
      validator("json", ValidateFolderInput),
      async (c) => {
        const input = c.req.valid("json")
        return c.json(
          await packageRoute(() =>
            ExpertSquadPackageManager.validateDirectory({
              projectDirectory: Instance.project.worktree,
              sourceDirectory: input.sourceDirectory,
            }),
          ),
        )
      },
    )
    .post(
      "/import-folder",
      describeRoute({
        summary: "Import an expert squad folder",
        description:
          "Validate and install a local expert-squad package folder into the explicitly selected project or user-global expert-squad catalog.",
        operationId: "expertSquad.importFolder",
        responses: {
          200: {
            description: "Imported expert squad package",
            content: {
              "application/json": {
                schema: resolver(PackageMutationReceipt),
              },
            },
          },
          400: namedErrorResponse("Expert squad package import rejected", "ExpertSquadPackageError"),
          409: namedErrorResponse("Expert squad package changed", "ExpertSquadPackageMutationConflictError"),
        },
      }),
      validator("json", ImportFolderInput),
      async (c) => {
        const input = c.req.valid("json")
        return c.json(
          await packageRoute(() =>
            ExpertSquadPackageManager.importDirectory({
              projectDirectory: Instance.project.worktree,
              sourceDirectory: input.sourceDirectory,
              installationScope: input.installationScope,
              expectedCurrentPackageDigest: input.expectedCurrentPackageDigest,
            }),
          ),
        )
      },
    )
    .post(
      "/import-file",
      describeRoute({
        summary: "Import an expert squad ZIP archive",
        description:
          "Validate and install a dropped expert-squad ZIP archive into the explicitly selected project or user-global expert-squad catalog.",
        operationId: "expertSquad.importFile",
        responses: {
          200: {
            description: "Imported expert squad package",
            content: {
              "application/json": {
                schema: resolver(PackageMutationReceipt),
              },
            },
          },
          400: namedErrorResponse("Expert squad package import rejected", "ExpertSquadPackageError"),
          409: namedErrorResponse("Expert squad package changed", "ExpertSquadPackageMutationConflictError"),
        },
      }),
      validator("json", ImportFileInput),
      async (c) => {
        const input = c.req.valid("json")
        return c.json(
          await packageRoute(() =>
            ExpertSquadPackageManager.importArchive({
              projectDirectory: Instance.project.worktree,
              archiveBase64: input.archiveBase64,
              filename: input.filename,
              installationScope: input.installationScope,
              expectedCurrentPackageDigest: input.expectedCurrentPackageDigest,
            }),
          ),
        )
      },
    )
    .post(
      "/import-exact-file",
      describeRoute({
        summary: "Import an exact hosted expert squad ZIP revision",
        description:
          "Validate and install one downloaded ZIP only when its exact namespace, id, version, and canonical package digest match the web-to-client handoff target.",
        operationId: "expertSquad.importExactFile",
        responses: {
          200: {
            description: "Imported exact expert squad package revision",
            content: { "application/json": { schema: resolver(PackageMutationReceipt) } },
          },
          400: namedErrorResponse("Expert squad package import rejected", "ExpertSquadPackageError"),
          409: namedErrorResponse("Expert squad package changed", "ExpertSquadPackageMutationConflictError"),
        },
      }),
      validator("json", ImportExactFileInput),
      async (c) => {
        const input = c.req.valid("json")
        return c.json(
          await packageRoute(() =>
            ExpertSquadPackageManager.importArchive({
              projectDirectory: Instance.project.worktree,
              archiveBase64: input.archiveBase64,
              filename: input.filename,
              installationScope: input.installationScope,
              expectedCurrentPackageDigest: input.expectedCurrentPackageDigest,
              expectedNamespace: input.expectedNamespace,
              expectedID: input.expectedID,
              expectedVersion: input.expectedVersion,
              expectedPackageDigest: input.expectedPackageDigest,
            }),
          ),
        )
      },
    )
    .post(
      "/export",
      describeRoute({
        summary: "Export an expert squad ZIP archive",
        description:
          "Validate and pack a canonical expert-squad package discovered from the global or current-project expert-squad catalog.",
        operationId: "expertSquad.export",
        responses: {
          200: {
            description: "Exported expert squad archive",
            content: {
              "application/json": {
                schema: resolver(ExportResult),
              },
            },
          },
          400: namedErrorResponse("Expert squad package export rejected", "ExpertSquadPackageError"),
        },
      }),
      validator("json", ExportInput),
      async (c) => {
        const input = c.req.valid("json")
        const exported = await packageRoute(() =>
          ExpertSquadPackageManager.exportArchive({
            projectDirectory: Instance.project.worktree,
            id: input.id,
            installationScope: input.installationScope,
          }),
        )
        return c.json({
          namespace: exported.namespace,
          id: exported.id,
          version: exported.version,
          packageDigest: exported.packageDigest,
          filename: exported.filename,
          archiveBase64: Buffer.from(exported.bytes).toString("base64"),
          archiveSha256: exported.archiveSha256,
          fileCount: exported.fileCount,
        })
      },
    )
}
