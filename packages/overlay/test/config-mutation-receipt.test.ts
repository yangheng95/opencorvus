import { describe, expect, test } from "bun:test"
import { ApiError } from "../src/services/api"
import { committedConfigFromError } from "../src/services/config"
import {
  configMutationReceiptDiagnostic,
  readConfigMutationReceipt,
  type ConfigMutationReceipt,
} from "../src/services/config-mutation-receipt"
import { formatErrorDetails } from "../src/utils/error-details"

const scopes = [
  {
    name: "GlobalConfigCommittedReconcileError",
    path: "global/config",
    message: "Global configuration committed, but one or more project runtime projections did not fully settle",
  },
  {
    name: "ProjectConfigCommittedReconcileError",
    path: "config?directory=owned-project",
    message: "Project configuration committed, but its runtime projection did not fully settle",
  },
] as const

// Every credential-shaped value here is fictional local test input.
function configuration() {
  return {
    provider: {
      owned: {
        name: "Owned provider",
        models: {},
        options: { apiKey: "fictional-provider-key", headers: { "X-Owned-Credential": "fictional-header-value" } },
      },
    },
    network: { proxy: { url: "http://127.0.0.1:1", username: "owned-user", password: "fictional-proxy-password" } },
  }
}

describe.each(scopes)("$name", (scope) => {
  function receipt(): ConfigMutationReceipt {
    return {
      name: scope.name,
      data: {
        committed: true,
        message: scope.message,
        config: configuration(),
        failures: ["MCP runtime reconciliation failed", "目录投影等待重试"],
      },
    }
  }

  test("decodes the complete receipt and preserves its exact business snapshot", () => {
    const body = receipt()
    const decoded = readConfigMutationReceipt(body)
    expect(decoded).toBe(body)
    expect(decoded?.data.config).toEqual(configuration())
    const error = new ApiError(409, scope.path, body, {}, "PATCH")
    expect(committedConfigFromError(error)).toBe(body.data.config)
    expect(error.body).toBe(body)
  })

  test("projects the explicit public diagnostic while preserving the original receipt", () => {
    const body = receipt()
    expect(configMutationReceiptDiagnostic(body)).toEqual({
      name: scope.name,
      data: {
        committed: true,
        message: scope.message,
        failures: ["MCP runtime reconciliation failed", "目录投影等待重试"],
      },
    })
    expect(body).toEqual(receipt())
  })

  test.each(["object", "utf8"] as const)(
    "formats the %s receipt with precise request identity and public details",
    (kind) => {
      const body = receipt()
      const error = new ApiError(
        409,
        scope.path,
        kind === "utf8" ? new TextEncoder().encode(JSON.stringify(body)) : body,
        { "X-OpenCorvus-Request-ID": "owned-config-request" },
        "PATCH",
      )
      const originalStack = `ApiError: caller-attached private snapshot ${JSON.stringify(body.data.config)}`
      error.stack = originalStack
      expect(formatErrorDetails(error)).toBe(
        `HTTP PATCH 409 ${scope.path}\n\nRequest ID: owned-config-request\n\n${scope.name}: ${scope.message}\n\nresponse body:\n` +
          `{
  "name": "${scope.name}",
  "data": {
    "committed": true,
    "message": "${scope.message}",
    "failures": [
      "MCP runtime reconciliation failed",
      "目录投影等待重试"
    ]
  }
}`,
      )
      expect(error.body).toEqual(body)
      expect(error.stack).toBe(originalStack)
      expect(committedConfigFromError(error)).toEqual(configuration())
    },
  )

  test("formats a directly supplied receipt as its exact public diagnostic", () => {
    const body = receipt()
    expect(JSON.parse(formatErrorDetails(body))).toEqual({
      name: scope.name,
      data: {
        committed: true,
        message: scope.message,
        failures: ["MCP runtime reconciliation failed", "目录投影等待重试"],
      },
    })
    expect(body.data.config).toEqual(configuration())
  })

  test("accepts the producer's empty configuration and failure list", () => {
    const body: ConfigMutationReceipt = {
      name: scope.name,
      data: { committed: true, message: scope.message, config: {}, failures: [] },
    }
    expect(readConfigMutationReceipt(body)).toEqual(body)
    expect(configMutationReceiptDiagnostic(body)).toEqual({
      name: scope.name,
      data: { committed: true, message: scope.message, failures: [] },
    })
  })
})

test("ordinary HTTP errors retain their exact response and diagnostic contract", () => {
  const body = { name: "ConfigCandidateValidationError", data: { message: "Referenced model requires a declaration" } }
  const error = new ApiError(400, "config", body, { "x-opencorvus-request-id": "owned-validation-request" }, "PATCH")
  error.stack = "ApiError: ordinary validation stack"
  expect(formatErrorDetails(error)).toBe(
    'HTTP PATCH 400 config\n\nRequest ID: owned-validation-request\n\nApiError: ordinary validation stack\n\nresponse body:\n{\n  "name": "ConfigCandidateValidationError",\n  "data": {\n    "message": "Referenced model requires a declaration"\n  }\n}',
  )
  expect(error.body).toBe(body)
  expect(error.stack).toBe("ApiError: ordinary validation stack")
})

test("ordinary thrown values preserve their explicit diagnostic representations", () => {
  const error = new Error("Ordinary local failure")
  error.stack = "Error: Ordinary local failure"
  expect(formatErrorDetails(error)).toBe("Error: Ordinary local failure")
  expect(formatErrorDetails("Plain local failure")).toBe("Plain local failure")
  expect(formatErrorDetails({ phase: "provider.reload", message: "Owned reload failure" })).toBe(
    '{\n  "phase": "provider.reload",\n  "message": "Owned reload failure"\n}',
  )
})
