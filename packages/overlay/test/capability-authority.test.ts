import { afterEach, beforeEach, expect, test } from "bun:test"
import { ApiAuthorityChangedError, captureApiAuthority, configure } from "../src/services/api"
import { HOST_CAPABILITIES, type TransportRequest, type TransportResponse } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { ensureMissionSkillDirectory, loadMissionSkillCatalog, loadMissionSkillSettings } from "../src/services/mission-skill"
import { loadConversationCapability, updateConversationCapability } from "../src/services/conversation-capability"
import { setAppStore } from "../src/store/app"
import type { ChatCapabilitySettings, WorkCapabilitySettings } from "@opencorvus-ai/sdk"

const scope = { kind: "project" as const, directory: "D:/owned/project" }
const response = (body: unknown): TransportResponse => ({ status: 200, ok: true, headers: {}, body })

function transport(respond: (request: TransportRequest) => Promise<TransportResponse> | TransportResponse) {
  __setHostTransportForTest({
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    async request<T>(request: TransportRequest) {
      return await respond(request) as TransportResponse<T>
    },
    openStream() { throw new Error("This local contract uses HTTP requests") },
    async native() { throw new Error("This local contract uses HTTP requests") },
  })
}

beforeEach(() => {
  configure({ serverUrl: "http://a.invalid", directory: scope.directory, password: "" })
  setAppStore({ connected: true })
})
afterEach(() => {
  __setHostTransportForTest(undefined)
  configure({ serverUrl: "http://127.0.0.1:7878", directory: "" })
  setAppStore({ connected: false })
})

for (const [kind, load] of [["catalog", loadMissionSkillCatalog], ["settings", loadMissionSkillSettings]] as const) {
  test(`local transport ${kind} keeps B's same-scope pending owner after A settles`, async () => {
    const a = captureApiAuthority()
    const aGate = Promise.withResolvers<TransportResponse>()
    const bGate = Promise.withResolvers<TransportResponse>()
    const seen: TransportRequest[] = []
    transport((request) => {
      seen.push(request)
      return request.authority?.revision === a.revision ? aGate.promise : bGate.promise
    })
    const old = load({ ...scope, authority: a }).catch((error: unknown) => error)
    configure({ serverUrl: "http://b.invalid" })
    const b = captureApiAuthority()
    const current = load({ ...scope, authority: b })
    const body = (name: string) => kind === "catalog"
      ? { issues: [], mission_skills: [{ name, description: name, required_tools: [] }] }
      : { issues: [], mission_skills: [{ name, description: name, required_tools: [], source: "project" as const, location: scope.directory }], roots: { project: scope.directory, global: "D:/owned/global" } }
    const aResponse = response(body("a"))
    aGate.resolve(aResponse)
    const retired = await old
    expect(retired).toBeInstanceOf(ApiAuthorityChangedError)
    if (!(retired instanceof ApiAuthorityChangedError)) throw new Error("Expected typed retirement")
    expect(retired.outcome).toEqual({ phase: "response", response: aResponse })
    const joined = load({ ...scope, authority: b })
    const bBody = body("b")
    bGate.resolve(response(bBody))
    expect(await Promise.all([current, joined])).toEqual([bBody, bBody])
    expect(seen.map((request) => ({ path: request.path, query: request.query, authority: request.authority }))).toEqual([
      { path: `mission-skill/${kind}`, query: { directory: scope.directory }, authority: a },
      { path: `mission-skill/${kind}`, query: { directory: scope.directory }, authority: b },
    ])
  })
}

test("local transport directory mutation retains its original accepted response and current retry path", async () => {
  const a = captureApiAuthority()
  const gate = Promise.withResolvers<TransportResponse>()
  const seen: TransportRequest[] = []
  transport((request) => {
    seen.push(request)
    return request.authority?.revision === a.revision ? gate.promise : response({ path: "D:/owned/b/mission-skills" })
  })
  const old = ensureMissionSkillDirectory({ ...scope, authority: a }, "project").catch((error: unknown) => error)
  configure({ serverUrl: "http://b.invalid" })
  const accepted = response({ path: "D:/owned/a/mission-skills" })
  gate.resolve(accepted)
  const retired = await old
  expect(retired).toBeInstanceOf(ApiAuthorityChangedError)
  if (!(retired instanceof ApiAuthorityChangedError)) throw new Error("Expected typed retirement")
  expect(retired.outcome).toEqual({ phase: "response", response: accepted })
  const b = captureApiAuthority()
  expect(await ensureMissionSkillDirectory({ ...scope, authority: b }, "global")).toBe("D:/owned/b/mission-skills")
  expect(seen.map((request) => ({ method: request.method, body: request.body, authority: request.authority }))).toEqual([
    { method: "POST", body: { kind: "json", value: { source: "project" } }, authority: a },
    { method: "POST", body: { kind: "json", value: { source: "global" } }, authority: b },
  ])
})

test("local capability read and assignment carry one authority and preserve the actual retired assignment receipt", async () => {
  const a = captureApiAuthority()
  const assignment = { kind: "skill" as const, ref: "owned-skill", assigned: true }
  const initial: ChatCapabilitySettings = {
    agent_id: "chat", scope, skills: { assigned_refs: [], installed: [] },
    mcp: { assigned_server_refs: [], configured_server_refs: [] }, tools: { declared: [] },
  }
  const accepted = response({ ...initial, skills: { assigned_refs: [assignment.ref], installed: [] } })
  const work: WorkCapabilitySettings = { ...initial, agent_id: "work", skills: { assigned_refs: [assignment.ref], installed: [] } }
  const gate = Promise.withResolvers<TransportResponse>()
  const seen: TransportRequest[] = []
  transport((request) => {
    seen.push(request)
    if (request.path === "work/capability") return response(work)
    return request.method === "PATCH" ? gate.promise : response(initial)
  })
  expect(await loadConversationCapability(scope.directory, "chat", a)).toEqual(initial)
  const old = updateConversationCapability(scope.directory, "chat", assignment, a).catch((error: unknown) => error)
  configure({ serverUrl: "http://b.invalid" })
  gate.resolve(accepted)
  const retired = await old
  expect(retired).toBeInstanceOf(ApiAuthorityChangedError)
  if (!(retired instanceof ApiAuthorityChangedError)) throw new Error("Expected typed retirement")
  expect(retired.outcome).toEqual({ phase: "response", response: accepted })
  expect(seen.map((request) => ({ path: request.path, method: request.method, body: request.body, authority: request.authority }))).toEqual([
    { path: "chat/capability", method: "GET", body: undefined, authority: a },
    { path: "chat/capability", method: "PATCH", body: { kind: "json", value: assignment }, authority: a },
  ])
  const b = captureApiAuthority()
  expect(await updateConversationCapability(scope.directory, "work", assignment, b)).toEqual(work)
  expect(seen.at(-1)?.authority).toEqual(b)
  expect(seen.at(-1)?.path).toBe("work/capability")
})

test("all logical entries preserve explicit stale authority through credential ABA as before-dispatch errors", async () => {
  const authority = captureApiAuthority()
  configure({ password: "dummy-local-marker" })
  configure({ password: "" })
  const current = captureApiAuthority()
  const input = { ...scope, authority }
  const operations = [
    loadMissionSkillCatalog(input),
    loadMissionSkillSettings(input),
    ensureMissionSkillDirectory(input, "project"),
    loadConversationCapability(scope.directory, "chat", authority),
    updateConversationCapability(scope.directory, "work", { kind: "skill", ref: "owned-skill", assigned: true }, authority),
  ]
  for (const operation of operations) {
    await expect(operation).rejects.toMatchObject({
      name: "ApiAuthorityChangedError",
      phase: "before_dispatch",
      expectedRevision: authority.revision,
      currentRevision: current.revision,
    })
  }
})
