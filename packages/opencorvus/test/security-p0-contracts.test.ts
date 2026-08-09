import { describe, expect, test } from "bun:test"
import { NamedError } from "@opencorvus-ai/util/error"
import { QueryMetricEvaluatorConfigSchema } from "@opencorvus-ai/plugin"
import { PermissionNext } from "../src/permission/next"
import { LLM } from "../src/session/llm"
import {
  oauthAuthorizationLogFields,
  oauthCallbackInvalidStateLogFields,
  oauthCallbackMissingStateLogFields,
  oauthCallbackReceivedLogFields,
} from "../src/mcp/oauth-log"
import { publicUnknownErrorMessage, serverErrorResponse } from "../src/server/error-handler"

const digest = "a".repeat(64)

describe("P0 security contract repairs", () => {
  test("current permission rules keep priority over persisted approvals", () => {
    const approved = [{ permission: "bash", pattern: "*", action: "allow" }] as const
    const currentDeny = [{ permission: "bash", pattern: "*", action: "deny" }] as const
    const currentAsk = [{ permission: "bash", pattern: "*", action: "ask" }] as const

    expect(PermissionNext.evaluateRequest("bash", "npm test", currentDeny, approved).action).toBe("deny")
    expect(PermissionNext.evaluateRequest("bash", "npm test", currentAsk, approved).action).toBe("ask")
    expect(PermissionNext.evaluateRequest("bash", "npm test", [], approved).action).toBe("allow")
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
    expect(
      oauthAuthorizationLogFields({
        mcpName: "github",
        authorizationUrl: "https://idp.example/oauth/authorize?code=secret-code&state=secret-state",
      }),
    ).toEqual({ mcpName: "github", authorizationHost: "idp.example" })
    expect(oauthCallbackReceivedLogFields({ code: "secret-code", error: null })).toEqual({
      hasCode: true,
      hasError: false,
      error: undefined,
    })
    expect(oauthCallbackMissingStateLogFields({ path: "/mcp/oauth/callback" })).toEqual({
      path: "/mcp/oauth/callback",
    })
    expect(oauthCallbackInvalidStateLogFields({ pendingCount: 2 })).toEqual({ pendingCount: 2 })
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
