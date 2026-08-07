import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import { Config } from "../../config/config"
import { Auth } from "../../auth"
import { Provider } from "../../provider/provider"
import { discoverProviderModels, testProviderConnection } from "../../provider/operations"
import { NativeAgentRegistryLifecycle } from "@/agent/native-agent-registry-lifecycle"
import { ProviderAuth } from "../../provider/auth"
import { ProviderRemovalReceipt, removeProvider } from "../../provider/removal"
import { errors } from "../error"
import { lazy } from "../../util/lazy"
import { settleCanonicalProviderCatalogInvalidation, settleProviderRefreshInvalidation } from "../provider-refresh"
import { ProviderAccountUsage } from "../../provider/account-usage"

const ProviderAuthMutationResponse = z
  .object({
    ok: z.literal(true),
    issues: Provider.LoadIssue.array(),
  })
  .strict()

export const ProviderRoutes = lazy(() =>
  new Hono()
    .get(
      "/",
      describeRoute({
        summary: "List providers",
        description: "Get a list of all available AI providers, including both available and connected ones.",
        operationId: "provider.list",
        responses: {
          200: {
            description: "List of providers",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    all: Provider.Info.array(),
                    default: z.record(z.string(), z.string()),
                    connected: z.array(z.string()),
                    accountUsage: ProviderAccountUsage.Capabilities,
                    issues: Provider.LoadIssue.array(),
                  }),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        const configIssues: Provider.LoadIssue[] = []
        const config = await Config.get().catch((error) => {
          const authError = Auth.findReadError(error)
          configIssues.push({
            phase: authError ? "auth.read" : "config.read",
            message: authError?.message ?? (error instanceof Error ? error.message : String(error)),
          })
          return {} as Config.Info
        })
        const disabled = new Set(config.disabled_providers ?? [])
        const enabled = config.enabled_providers ? new Set(config.enabled_providers) : undefined

        // Source the complete provider database so locally registered
        // providers remain visible before credentials are configured.
        const loaded = await Provider.catalog({ config })
        const allProviders = loaded.database
        const filteredProviders: Record<string, (typeof allProviders)[string]> = {}
        for (const [key, value] of Object.entries(allProviders)) {
          if ((enabled ? enabled.has(key) : true) && !disabled.has(key)) {
            filteredProviders[key] = value
          }
        }

        const connected = loaded.providers
        const providers = Object.assign(filteredProviders, connected)
        return c.json({
          all: Object.values(providers),
          default: Object.fromEntries(
            Object.entries(providers).flatMap(([k, item]) => {
              const first = Provider.sort(Object.values(item.models))[0]
              return first ? [[k, first.id]] : []
            }),
          ),
          connected: Object.keys(connected),
          accountUsage: ProviderAccountUsage.capabilities(),
          issues: Provider.dedupeLoadIssues([...configIssues, ...loaded.issues]),
        })
      },
    )
    .get(
      "/auth",
      describeRoute({
        summary: "Get provider auth methods",
        description: "Retrieve available authentication methods for all AI providers.",
        operationId: "provider.auth",
        responses: {
          200: {
            description: "Provider auth methods",
            content: {
              "application/json": {
                schema: resolver(z.record(z.string(), z.array(ProviderAuth.Method))),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(await ProviderAuth.methods())
      },
    )
    .delete(
      "/:providerID",
      describeRoute({
        summary: "Delete a project provider",
        description:
          "Commit removal of the project provider declaration, provider model references, enabled or disabled references, and its saved credential under one durable mutation owner.",
        operationId: "provider.remove",
        responses: {
          200: {
            description: "Provider removal receipt",
            content: { "application/json": { schema: resolver(ProviderRemovalReceipt) } },
          },
          ...errors(400),
        },
      }),
      validator("param", z.object({ providerID: z.string().trim().min(1) })),
      async (c) =>
        c.json(
          await removeProvider({
            providerID: c.req.valid("param").providerID,
            scope: "project",
          }),
        ),
    )
    .post(
      "/refresh",
      describeRoute({
        summary: "Refresh the provider registry",
        description:
          "Pulls api.json from the configured registry URL and atomically replaces the durable canonical catalog declaration. Configured live model identities use the separate models refresh route. The runtime never refreshes implicitly.",
        operationId: "provider.refresh",
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
    .post(
      "/models/refresh",
      describeRoute({
        summary: "Refresh configured provider model lists",
        description:
          "Refresh live model identities for configured providers without refreshing the provider registry declaration, then reset provider state so downstream callers see the updated list.",
        operationId: "provider.models.refresh",
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
        },
      }),
      async (c) => {
        const result = await Provider.refreshModels()
        if (result.ok) {
          const issues = await settleCanonicalProviderCatalogInvalidation()
          return c.json({ ...result, ...(issues.length > 0 ? { issues } : {}) })
        }
        return c.json(result)
      },
    )
    .get(
      "/:providerID/account-usage",
      describeRoute({
        summary: "Get Provider account usage",
        description:
          "Fetch the selected Provider's normalized account usage using server-owned credentials without exposing credentials to the Overlay.",
        operationId: "provider.account.usage",
        responses: {
          200: {
            description: "Provider account usage lookup result",
            content: {
              "application/json": {
                schema: resolver(ProviderAccountUsage.Response),
              },
            },
          },
        },
      }),
      validator("param", z.object({ providerID: z.string().trim().min(1) })),
      async (c) => c.json(await ProviderAccountUsage.read(c.req.valid("param").providerID, await Config.get())),
    )
    .post(
      "/discover-models",
      describeRoute({
        summary: "Discover OpenAI-compatible provider models",
        description:
          "Fetches the explicit OpenAI-compatible /models endpoint for a user-supplied base URL. This route only runs when requested by the operator; provider startup remains offline-first.",
        operationId: "provider.discover.models",
        responses: {
          200: {
            description: "Discovered model IDs",
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
        },
      }),
      validator(
        "json",
        z.object({
          api: z.string().min(1).meta({ description: "OpenAI-compatible base URL, usually ending in /v1" }),
          apiKey: z.string().optional().meta({ description: "Optional API key used as a Bearer token" }),
          providerID: z
            .string()
            .optional()
            .meta({ description: "Optional provider ID whose saved auth key may be used" }),
        }),
      ),
      async (c) => {
        const result = await discoverProviderModels(c.req.valid("json"), {
          config: Config.get,
          global: false,
        })
        return c.json(result.body, result.status)
      },
    )
    .post(
      "/:providerID/test",
      describeRoute({
        summary: "Test provider connection",
        description: "Run a minimal live request against a provider using the selected or default model.",
        operationId: "provider.test",
        responses: {
          200: {
            description: "Provider test result",
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
        },
      }),
      validator(
        "param",
        z.object({
          providerID: z.string().meta({ description: "Provider ID" }),
        }),
      ),
      validator(
        "json",
        z
          .object({
            modelID: z.string().optional(),
          })
          .optional(),
      ),
      async (c) => {
        const result = await testProviderConnection(c.req.valid("param").providerID, c.req.valid("json")?.modelID, {
          config: Config.get,
          global: false,
        })
        return c.json(result.body, result.status)
      },
    )
    .post(
      "/:providerID/auth/prompts",
      describeRoute({
        summary: "Get auth prompts",
        description: "Return the prompts needed for a specific authentication method.",
        operationId: "provider.auth.prompts",
        responses: {
          200: {
            description: "Auth prompts",
            content: {
              "application/json": {
                schema: resolver(ProviderAuth.Prompt.array()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "param",
        z.object({
          providerID: z.string().meta({ description: "Provider ID" }),
        }),
      ),
      validator(
        "json",
        z.object({
          method: z.number().meta({ description: "Auth method index" }),
          inputs: z.record(z.string(), z.string()).optional().meta({ description: "Already collected inputs" }),
        }),
      ),
      async (c) => {
        const providerID = c.req.valid("param").providerID
        const { method, inputs } = c.req.valid("json")
        const result = await ProviderAuth.prompts({ providerID, method, inputs })
        return c.json(result)
      },
    )
    .post(
      "/:providerID/auth/execute",
      describeRoute({
        summary: "Execute auth method",
        description: "Execute an authentication method with collected inputs.",
        operationId: "provider.auth.execute",
        responses: {
          200: {
            description: "Auth executed successfully",
            content: {
              "application/json": {
                schema: resolver(ProviderAuthMutationResponse),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "param",
        z.object({
          providerID: z.string().meta({ description: "Provider ID" }),
        }),
      ),
      validator(
        "json",
        z.object({
          method: z.number().meta({ description: "Auth method index" }),
          inputs: z.record(z.string(), z.string()).optional().meta({ description: "Collected inputs" }),
        }),
      ),
      async (c) => {
        const providerID = c.req.valid("param").providerID
        const { method, inputs } = c.req.valid("json")
        await ProviderAuth.execute({ providerID, method, inputs })
        const issues = await settleProviderRefreshInvalidation([
          { phase: "cache.provider", run: Provider.reset },
          { phase: "cache.native-agents", run: NativeAgentRegistryLifecycle.reset },
        ])
        return c.json({ ok: true as const, issues })
      },
    )
    .post(
      "/:providerID/oauth/authorize",
      describeRoute({
        summary: "OAuth authorize",
        description: "Initiate OAuth authorization for a specific AI provider to get an authorization URL.",
        operationId: "provider.oauth.authorize",
        responses: {
          200: {
            description: "Authorization URL and method",
            content: {
              "application/json": {
                schema: resolver(ProviderAuth.Authorization.optional()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "param",
        z.object({
          providerID: z.string().meta({ description: "Provider ID" }),
        }),
      ),
      validator(
        "json",
        z.object({
          method: z.number().meta({ description: "Auth method index" }),
          inputs: z.record(z.string(), z.string()).optional().meta({ description: "Collected inputs" }),
        }),
      ),
      async (c) => {
        const providerID = c.req.valid("param").providerID
        const { method, inputs } = c.req.valid("json")
        const result = await ProviderAuth.authorize({
          providerID,
          method,
          inputs,
        })
        return c.json(result)
      },
    )
    .post(
      "/:providerID/oauth/callback",
      describeRoute({
        summary: "OAuth callback",
        description: "Handle the OAuth callback from a provider after user authorization.",
        operationId: "provider.oauth.callback",
        responses: {
          200: {
            description: "OAuth callback processed successfully",
            content: {
              "application/json": {
                schema: resolver(ProviderAuthMutationResponse),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "param",
        z.object({
          providerID: z.string().meta({ description: "Provider ID" }),
        }),
      ),
      validator(
        "json",
        z.object({
          method: z.number().meta({ description: "Auth method index" }),
          code: z.string().optional().meta({ description: "OAuth authorization code" }),
        }),
      ),
      async (c) => {
        const providerID = c.req.valid("param").providerID
        const { method, code } = c.req.valid("json")
        await ProviderAuth.callback({
          providerID,
          method,
          code,
        })
        const issues = await settleProviderRefreshInvalidation([
          { phase: "cache.provider", run: Provider.reset },
          { phase: "cache.native-agents", run: NativeAgentRegistryLifecycle.reset },
        ])
        return c.json({ ok: true as const, issues })
      },
    ),
)
