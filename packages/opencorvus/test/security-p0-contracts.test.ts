import { describe, expect, test } from "bun:test"
import { NamedError } from "@opencorvus-ai/util/error"
import { QueryMetricEvaluatorConfigSchema } from "@opencorvus-ai/plugin"
import { HTTPException } from "hono/http-exception"
import z from "zod"
import { mcpDebugCredentialStatus } from "../src/cli/cmd/mcp"
import { orderMetricSpecsForEvaluation } from "../src/metrics/executor"
import type { MetricSpec } from "../src/metrics/types"
import { PermissionNext } from "../src/permission/next"
import { LLM } from "../src/session/llm"
import {
  oauthAuthorizationLogFields,
  oauthCallbackInvalidStateLogFields,
  oauthCallbackMissingStateLogFields,
  oauthCallbackReceivedLogFields,
} from "../src/mcp/oauth-log"
import { publicUnknownErrorMessage, publicUnknownStreamError, serverErrorResponse } from "../src/server/error-handler"
import { parseFrontmatter, stringifyFrontmatter } from "../src/util/frontmatter"

const digest = "a".repeat(64)

describe("P0 security contract repairs", () => {
  test("current permission rules keep priority over persisted approvals", () => {
    const approved = [{ permission: "bash", pattern: "*", action: "allow" }] as const
    const currentDeny = [{ permission: "bash", pattern: "*", action: "deny" }] as const
    const currentAsk = [{ permission: "bash", pattern: "*", action: "ask" }] as const

    expect(PermissionNext.evaluateRequest("bash", "npm test", currentDeny, approved).action).toBe("deny")
    expect(PermissionNext.evaluateRequest("bash", "npm test", currentAsk, approved).action).toBe("ask")
    expect(PermissionNext.evaluateRequest("bash", "npm test", [], approved).action).toBe("allow")
    expect(
      PermissionNext.evaluateRequestPatterns({ permission: "bash", patterns: ["npm test"] }, currentAsk, approved)
        .action,
    ).toBe("ask")
  })

  test("LLM telemetry keeps operational metadata without input or output capture", () => {
    expect(LLM.telemetryConfig({ enabled: true, username: "alice", sessionID: "ses_1" })).toEqual({
      isEnabled: true,
      recordInputs: false,
      recordOutputs: false,
      metadata: {
        userId: "alice",
        sessionId: "ses_1",
      },
    })
  })

  test("OAuth log fields expose flow metadata only", () => {
    const correlationID = "ca2bb7a2-2103-48ce-b63c-2c55dd855a8a"
    expect(
      oauthAuthorizationLogFields({
        mcpName: "github",
        authorizationUrl: "https://idp.example/oauth/authorize?code=secret-code&state=secret-state",
        correlationID,
      }),
    ).toEqual({ mcpName: "github", authorizationHost: "idp.example", correlationID })
    expect(oauthCallbackReceivedLogFields({ code: "secret-code", error: null, correlationID })).toEqual({
      correlationID,
      hasCode: true,
      hasError: false,
      error: undefined,
    })
    expect(oauthCallbackMissingStateLogFields({ path: "/mcp/oauth/callback", correlationID })).toEqual({
      correlationID,
      path: "/mcp/oauth/callback",
    })
    expect(oauthCallbackInvalidStateLogFields({ pendingCount: 2, correlationID })).toEqual({
      correlationID,
      pendingCount: 2,
    })
  })

  test("public unknown errors use a generic body and request-id header", async () => {
    const headers = new Map<string, string>()
    const context = {
      req: {
        method: "GET",
        path: "/secret",
        header: () => undefined,
        raw: {},
      },
      res: new Response(null),
      header: (name: string, value: string) => headers.set(name, value),
      json: (body: unknown, init: { status: number }) => Response.json(body, init),
    }

    const response = serverErrorResponse(new Error("database password leaked"), context as never)

    expect(response.status).toBe(500)
    expect(headers.get("x-opencorvus-request-id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
    expect(await response.json()).toEqual({
      name: "UnknownError",
      data: { message: publicUnknownErrorMessage() },
    })

    const namedUnknownResponse = serverErrorResponse(
      new NamedError.Unknown({ message: "internal token leaked" }),
      context as never,
    )
    expect(namedUnknownResponse.status).toBe(500)
    expect(await namedUnknownResponse.json()).toEqual({
      name: "UnknownError",
      data: { message: publicUnknownErrorMessage() },
    })

    const PluginServiceRegistrationError = NamedError.create(
      "PluginServiceRegistrationError",
      z.object({ message: z.string(), pluginID: z.string() }),
    )
    const typedResponse = serverErrorResponse(
      new PluginServiceRegistrationError({ message: "registration failed", pluginID: "calendar" }),
      context as never,
    )
    expect(typedResponse.status).toBe(500)
    expect(await typedResponse.json()).toEqual({
      name: "PluginServiceRegistrationError",
      data: { message: "registration failed", pluginID: "calendar" },
    })
    expect(publicUnknownStreamError()).toEqual({
      type: "error",
      message: publicUnknownErrorMessage(),
    })
  })

  test("explicit HTTP errors preserve their public status and message", async () => {
    const context = {
      req: {
        method: "POST",
        path: "/operation",
        header: () => undefined,
        raw: {},
      },
      res: new Response(null),
      header: () => undefined,
      json: (body: unknown, init: { status: number }) => Response.json(body, init),
    }

    for (const [status, message] of [
      [403, "Gateway action is not allowed"],
      [409, "Queue revision conflict"],
      [422, "Invalid queued task ordering"],
      [503, "Task runtime is unavailable"],
    ] as const) {
      const response = serverErrorResponse(new HTTPException(status, { message }), context as never)
      expect(response.status).toBe(status)
      expect(await response.json()).toEqual({ name: "UnknownError", data: { message } })
    }
  })

  test("frontmatter uses the configured YAML codec for parse and stringify", () => {
    const encoded = stringifyFrontmatter("body\n", { title: "Contract", tags: ["p0", "yaml"] })
    const parsed = parseFrontmatter(encoded)
    expect(parsed.data).toEqual({ title: "Contract", tags: ["p0", "yaml"] })
    expect(parsed.content).toBe("body\n")
  })

  test("MCP debug credentials report presence without token material", () => {
    const status = mcpDebugCredentialStatus({
      tokens: { accessToken: "super-secret-access-token", refreshToken: "super-secret-refresh-token" },
      clientInfo: { clientId: "private-client-id", clientSecret: "private-client-secret" },
    })
    expect(status).toEqual({
      accessToken: "present",
      refreshToken: "present",
      clientID: "present",
      clientSecret: "present",
    })
  })

  test("same-iteration metric dependencies have deterministic evaluation order", () => {
    const common = {
      task_id: "task-1",
      scope: "global" as const,
      goal_id: null,
      description: "contract fixture",
      unit: "ratio",
      direction: "higher_better" as const,
      target: 1,
      floor: 0,
      weight: 1,
      observation_class: "quality" as const,
      source: "baseline" as const,
      frozen_at: 1,
      created_by: "architect" as const,
    }
    const source = {
      ...common,
      id: "source",
      name: "source",
      evaluator_kind: "query" as const,
      evaluator_config: { scorer_revision: digest, query: "constant_value", value: 1 },
    } satisfies MetricSpec
    const projection = {
      ...common,
      id: "projection",
      name: "projection",
      evaluator_kind: "query" as const,
      evaluator_config: {
        scorer_revision: digest,
        query: "metric_result_value",
        metric_spec_id: source.id,
        iteration_offset: 0,
        result_column: "raw_value",
      },
    } satisfies MetricSpec
    const aggregate = {
      ...common,
      id: "aggregate",
      name: "aggregate",
      evaluator_kind: "aggregator" as const,
      evaluator_config: {
        scorer_revision: digest,
        of: [projection.id],
        op: "mean",
        iteration_offset: 0,
      },
    } satisfies MetricSpec

    expect(orderMetricSpecsForEvaluation([aggregate, projection, source]).map((spec) => spec.id)).toEqual([
      "source",
      "projection",
      "aggregate",
    ])
  })

  test("query evaluator config is a typed named projection", () => {
    expect(
      QueryMetricEvaluatorConfigSchema.parse({
        scorer_revision: digest,
        query: "constant_value",
        value: 0.75,
      }),
    ).toEqual({
      scorer_revision: digest,
      query: "constant_value",
      value: 0.75,
    })
    expect(
      QueryMetricEvaluatorConfigSchema.parse({
        scorer_revision: digest,
        query: "metric_result_value",
        metric_spec_id: "metric-a",
        iteration_offset: -1,
        result_column: "normalized_value",
      }),
    ).toEqual({
      scorer_revision: digest,
      query: "metric_result_value",
      metric_spec_id: "metric-a",
      iteration_offset: -1,
      result_column: "normalized_value",
    })
  })
})
