import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import { Config } from "../../config/config"
import { ConfigCandidateValidationError } from "@/config/candidate-validation"
import { EffectiveConfig } from "@/config/effective"
import { EngineConfig } from "../../engine/config"
import { ConversationCapability } from "@/conversation/capability"
import { Provider } from "../../provider/provider"
import { PromptCatalog } from "../../config/prompt-catalog"
import { Instance } from "@/project/instance"
import { mapValues } from "remeda"
import { AuthReadUnavailableResponse, badRequestBody, errors, namedErrorResponse } from "../error"
import { Log } from "../../util/log"
import { lazy } from "../../util/lazy"
import { testNetworkProxy } from "../../util/network-proxy-test"
import { assertActiveProjectSession } from "../active-project-session"

const log = Log.create({ service: "server" })

const NetworkProxyTestRequest = z
  .object({
    proxy: Config.NetworkProxy,
  })
  .meta({ ref: "NetworkProxyTestRequest" })

const NetworkProxyTestResponse = z
  .object({
    ok: z.boolean(),
    status: z.enum(["connected", "error"]),
    targetUrl: z.string(),
    statusCode: z.number().optional(),
    durationMs: z.number(),
    message: z.string(),
  })
  .meta({ ref: "NetworkProxyTestResponse" })

async function configResponse() {
  const [raw, orch] = await Promise.all([Config.get(), EngineConfig.get()])
  const userAsst = raw.assistant || {}
  const assistant = {
    ...userAsst,
    max_executor_groups: userAsst.max_executor_groups ?? orch.max_executor_groups,
  }
  return { ...raw, assistant }
}

export const ConfigRoutes = lazy(() =>
  new Hono()
    .get(
      "/",
      describeRoute({
        summary: "Get configuration",
        description: "Retrieve the current OpenCorvus configuration settings and preferences.",
        operationId: "config.get",
        responses: {
          200: {
            description: "Get config info",
            content: {
              "application/json": {
                schema: resolver(Config.Info),
              },
            },
          },
          409: namedErrorResponse("Non-canonical configuration file", "NonCanonicalConfigFileError"),
          503: AuthReadUnavailableResponse,
        },
      }),
      async (c) => {
        return c.json(await configResponse())
      },
    )
    .patch(
      "/",
      describeRoute({
        summary: "Update configuration (JSON Merge Patch)",
        description:
          "Partially update OpenCorvus configuration per RFC 7396. Only include fields to change; set a field to null to delete it.",
        operationId: "config.update",
        responses: {
          200: {
            description: "Successfully updated config",
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
      // RFC 7396 patches can contain null deletion sentinels, so validate the
      // fully merged candidate instead of attempting to parse the sparse patch.
      validator("json", z.record(z.string(), z.unknown())),
      async (c) => {
        const partial = c.req.valid("json") as Record<string, unknown>
        try {
          await Config.updateProjectPatch(partial)
        } catch (error) {
          if (error instanceof Config.ProjectConfigCommittedReconcileError) {
            return c.json(Config.committedMutationReceipt(error), 409)
          }
          if (ConversationCapability.InvalidAssignmentError.isInstance(error)) {
            return c.json(badRequestBody(error.data.message), 400)
          }
          if (ConfigCandidateValidationError.isInstance(error)) {
            return c.json(badRequestBody(error.data.message), 400)
          }
          if (Config.InvalidError.isInstance(error)) {
            const issues = error.data.issues ?? []
            if (!issues) throw error
            const message = issues.map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`).join("; ")
            return c.json(badRequestBody(`config: ${message}`), 400)
          }
          throw error
        }
        return c.json(await configResponse())
      },
    )
    .post(
      "/proxy/test",
      describeRoute({
        summary: "Test network proxy",
        description:
          "Run a single HTTP request through the submitted network.proxy settings. This uses the edited proxy draft directly and never falls back to a direct request.",
        operationId: "config.proxy.test",
        responses: {
          200: {
            description: "Proxy test result",
            content: {
              "application/json": {
                schema: resolver(NetworkProxyTestResponse),
              },
            },
          },
          400: {
            description: "Proxy test result for an invalid proxy draft",
            content: {
              "application/json": {
                schema: resolver(NetworkProxyTestResponse),
              },
            },
          },
        },
      }),
      validator("json", NetworkProxyTestRequest),
      async (c) => {
        const { proxy } = c.req.valid("json")
        const result = await testNetworkProxy(proxy)
        if (!proxy.url?.trim()) return c.json(result, 400)
        return c.json(result)
      },
    )
    .get(
      "/prompt",
      describeRoute({
        summary: "List prompt catalog",
        description:
          "Returns all configurable prompt slots (system-scope and agent-scope) with their defaults and any user overrides from config.",
        operationId: "config.prompt",
        responses: {
          200: {
            description: "Prompt catalog entries",
            content: {
              "application/json": {
                schema: resolver(z.array(z.unknown())),
              },
            },
          },
          503: AuthReadUnavailableResponse,
        },
      }),
      validator(
        "query",
        z.object({
          sessionID: z
            .string()
            .optional()
            .meta({ description: "Optional root or child session id for session-effective prompt catalog view" }),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        if (!query.sessionID) return c.json(await PromptCatalog.list())
        await assertActiveProjectSession(query.sessionID)
        const config = await EffectiveConfig.effective({ sessionID: query.sessionID })
        return c.json(await PromptCatalog.list({ config }))
      },
    )
    .get(
      "/providers",
      describeRoute({
        summary: "List config providers",
        description: "Get a list of all configured AI providers and their default models.",
        operationId: "config.providers",
        responses: {
          200: {
            description: "List of providers",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    providers: Provider.Info.array(),
                    default: z.record(z.string(), z.string()),
                  }),
                ),
              },
            },
          },
          503: AuthReadUnavailableResponse,
        },
      }),
      async (c) => {
        using _ = log.time("providers")
        const providers = await Provider.list().then((x) => mapValues(x, (item) => item))
        return c.json({
          providers: Object.values(providers),
          default: mapValues(providers, (item) => Provider.sort(Object.values(item.models))[0].id),
        })
      },
    ),
)
