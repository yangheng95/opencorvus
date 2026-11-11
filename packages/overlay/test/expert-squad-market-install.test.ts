import { afterEach, beforeEach, expect, test } from "bun:test"
import { ApiError, configure } from "../src/services/api"
import {
  expertSquadCatalogRefreshToken,
  installExpertSquadMarketPackage,
  type ExpertSquadMarketInstallResult,
} from "../src/services/expert-squad"
import { HOST_CAPABILITIES, type TransportRequest, type TransportResponse } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"

const directory = "D:/owned/market-install"
const item = { id: "deep-research", namespace: "builtin" }
const inspection = {
  id: item.id,
  source: { kind: "installed_package", installation_scope: "project", namespace: item.namespace },
}

beforeEach(() => configure({ serverUrl: "http://owned.invalid", directory, password: "" }))
afterEach(() => __setHostTransportForTest(null))

function response(status: number, body: unknown, requestID: string): TransportResponse<unknown> {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { "x-opencorvus-request-id": requestID },
    body,
  }
}

function useTransport(handler: (request: TransportRequest) => TransportResponse<unknown>): void {
  __setHostTransportForTest({
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    async request<T>(request: TransportRequest) {
      return handler(request) as TransportResponse<T>
    },
    async native() {
      throw new Error("Local transport only")
    },
    openStream() {
      throw new Error("Local transport only")
    },
  })
}

test("a matching receipt is published as the installation result", async () => {
  const receipt: ExpertSquadMarketInstallResult = {
    operation: "installed",
    before: null,
    after: {
      ...item,
      installationScope: "project",
      projectDirectory: directory,
      version: "2026.10.14.1",
      targetRoot: directory + "/.opencorvus/expert-squads/builtin/deep-research",
      packageDigest: "a".repeat(64),
    },
  }
  useTransport(() => response(200, receipt, "owned-install"))
  const before = expertSquadCatalogRefreshToken()

  const outcome = await installExpertSquadMarketPackage(directory, item, "project")

  expect(outcome.kind).toBe("receipt")
  if (outcome.kind !== "receipt") throw new Error("Expected the original receipt")
  expect(outcome.receipt).toBe(receipt)
  expect(expertSquadCatalogRefreshToken()).toBe(before + 1)
})

test("an interrupted receipt confirms the exact project installation by inspection", async () => {
  const receiptError = new TypeError("Failed to fetch")
  const requests: TransportRequest[] = []
  useTransport((request) => {
    requests.push(request)
    if (request.method === "POST") throw receiptError
    return response(200, inspection, "owned-inspection")
  })
  const before = expertSquadCatalogRefreshToken()

  const outcome = await installExpertSquadMarketPackage(directory, item, "project")

  expect(outcome).toEqual({ kind: "confirmed", inspection, receiptError })
  expect(requests.map(({ method, path }) => [method, path])).toEqual([
    ["POST", "expert-squad/install-payload"],
    ["GET", "expert-squad/inspect"],
  ])
  expect(requests[1]?.query).toEqual({ directory, ...item, installationScope: "project" })
  expect(expertSquadCatalogRefreshToken()).toBe(before + 1)
})

test("an inconclusive inspection preserves the transport cause and exact public error", async () => {
  const receiptError = new TypeError("Failed to fetch")
  useTransport((request) => {
    if (request.method === "POST") throw receiptError
    return response(404, { name: "NotFoundError" }, "owned-inspection-unconfirmed")
  })

  const outcome = await installExpertSquadMarketPackage(directory, item, "project")

  expect(outcome.kind).toBe("unconfirmed")
  if (outcome.kind !== "unconfirmed") throw new Error("Expected an unconfirmed installation")
  expect(outcome.id).toBe(item.id)
  expect(outcome.receiptError).toBe(receiptError)
  expect(outcome.inspectionError).toBeInstanceOf(ApiError)
  expect(outcome.inspectionError).toMatchObject({ status: 404, requestID: "owned-inspection-unconfirmed", method: "GET" })
})

test("the server's explicit package conflict retains its response contract", async () => {
  const body = { name: "ExpertSquadPackageMutationConflictError" }
  useTransport(() => response(409, body, "owned-install-conflict"))

  const error = await installExpertSquadMarketPackage(directory, item, "project").catch((cause) => cause)

  expect(error).toBeInstanceOf(ApiError)
  expect(error).toMatchObject({ status: 409, requestID: "owned-install-conflict", method: "POST", body })
})
