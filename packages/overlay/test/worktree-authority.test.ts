import { afterEach, expect, test } from "bun:test"
import { captureApiAuthority, renewApiAuthority } from "../src/services/api"
import { HOST_CAPABILITIES, type HostTransport, type TransportRequest, type TransportResponse } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { deleteProjectWorktrees, loadProjectWorktrees } from "../src/services/worktree"

afterEach(() => __setHostTransportForTest(undefined))

function install(reply: (request: TransportRequest) => TransportResponse<unknown>) {
  const requests: TransportRequest[] = []
  __setHostTransportForTest({
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    async request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
      requests.push(request)
      return reply(request) as TransportResponse<T>
    },
    openStream() { throw new Error("This fixture only implements HTTP requests") },
    async native() { throw new Error("This fixture only implements HTTP requests") },
  } satisfies HostTransport)
  return requests
}

const removed = { ok: true, status: "removed" }
const ok = (body: unknown): TransportResponse<unknown> => ({ status: 200, ok: true, headers: {}, body })

test("worktree list projects the canonical public rows from its exact captured project", async () => {
  const authority = captureApiAuthority()
  const rows = [{ name: "feature", directory: "/a/feature", status: "managed" as const, removable: true }]
  const requests = install(() => ok(rows))
  expect(await loadProjectWorktrees("/a", authority)).toEqual(rows)
  expect(requests.map((request) => ({ path: request.path, directory: request.query?.directory }))).toEqual([
    { path: "project/current/worktrees", directory: "/a" },
  ])
})

test("same-authority bulk deletion keeps successful count and exact ordinary failure aggregation", async () => {
  const requests = install((request) => {
    const body = request.body?.kind === "json" ? request.body.value as { directory: string } : undefined
    return body?.directory === "/a/blocked"
      ? { status: 409, ok: false, headers: {}, body: { message: "owned worktree is busy" } }
      : ok(removed)
  })
  await expect(deleteProjectWorktrees("/a", ["/a/blocked", "/a/ready"])).rejects.toMatchObject({
    name: "ProjectWorktreeBulkDeleteError", deleted: 1,
    failures: [{ directory: "/a/blocked", error: "API 409 project/current/worktrees?directory=%2Fa: owned worktree is busy" }],
  })
  expect(requests.map((request) => request.body)).toEqual([
    { kind: "json", value: { directory: "/a/blocked" } },
    { kind: "json", value: { directory: "/a/ready" } },
  ])
})

test("bulk retirement preserves the accepted original delete receipt and stops with its typed transport outcome", async () => {
  const requests = install(() => {
    renewApiAuthority()
    return ok(removed)
  })
  await expect(deleteProjectWorktrees("/a", ["/a/first", "/a/second"])).rejects.toMatchObject({
    name: "ApiAuthorityChangedError",
    outcome: { phase: "response", response: { status: 200, body: removed } },
  })
  expect(requests.map((request) => request.body)).toEqual([
    { kind: "json", value: { directory: "/a/first" } },
  ])
})

test("a retained logical authority gets the exact before-dispatch conflict after connection renewal", async () => {
  const authority = captureApiAuthority()
  renewApiAuthority()
  await expect(deleteProjectWorktrees("/a", ["/a/first"], authority)).rejects.toMatchObject({
    name: "ApiAuthorityChangedError", expectedRevision: authority.revision,
    outcome: { phase: "before_dispatch" },
  })
})
