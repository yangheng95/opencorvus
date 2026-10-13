import { afterEach, beforeEach, expect, test } from "bun:test"
import { ApiError, ApiAuthorityChangedError, captureApiAuthority, configure } from "../src/services/api"
import {
  createContinuousGoal,
  loadContinuousGoal,
  updateContinuousGoal,
  type ContinuousGoal,
} from "../src/services/continuous-goal"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import {
  HOST_CAPABILITIES,
  type HostTransport,
  type TransportRequest,
  type TransportResponse,
} from "../src/services/host-transport"

const directory = "C:/private/goal scope"
const view: ContinuousGoal = {
  id: "goal-1",
  revision: "revision-2",
  owner: { kind: "task", id: "task-1" },
  objective: "Deliver a reviewed result",
  status: "paused",
  reason: "Operator pause",
  tokensUsed: 1400,
  turnsAccepted: 2,
  tokenBudget: 5000,
  turnBudget: 3,
  createdAt: 1000,
  updatedAt: 2000,
  sessionID: "session-1",
  projectID: "project-1",
  directory,
}
const ready = (body: unknown): TransportResponse => ({ status: 200, ok: true, headers: {}, body })
let requests: TransportRequest[] = []
let responder: (request: TransportRequest) => Promise<TransportResponse>

beforeEach(() => {
  configure({ serverUrl: "http://goal-contract.invalid", directory, password: "" })
  requests = []
  responder = async () => ready(view)
  const transport: HostTransport = {
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    async request<T>(request: TransportRequest) {
      requests.push(request)
      return (await responder(request)) as TransportResponse<T>
    },
    openStream() {
      throw new Error("This contract exercises the existing goal HTTP API")
    },
    async native() {
      throw new Error("This HTTP adapter has no native operations")
    },
  }
  __setHostTransportForTest(transport)
})
afterEach(() => __setHostTransportForTest(undefined))

for (const kind of ["chat", "task", "mission"] as const)
  test(`${kind} reads its exact encoded owner and project from the canonical API`, async () => {
    const owner = { kind, id: "owner/one", directory }
    responder = async () => ready({ ...view, owner: { kind, id: owner.id } })
    expect(await loadContinuousGoal(owner, captureApiAuthority())).toEqual({ ...view, owner: { kind, id: owner.id } })
    const url = new URL(requests[0]!.path, "http://goal-contract.invalid")
    expect({ path: url.pathname, directory: requests[0]!.query?.directory, method: requests[0]!.method }).toEqual({
      path: `/continuous-goal/${kind}/owner%2Fone`,
      directory,
      method: "GET",
    })
  })

test("an existing owner with no goal returns the explicit empty projection", async () => {
  responder = async () => ready(null)
  expect(await loadContinuousGoal({ kind: "chat", id: "session-1", directory }, captureApiAuthority())).toBeNull()
})

test("creation transmits the explicit objective, budgets and idempotent request identity", async () => {
  const input = { requestID: "create-once", objective: "Deliver a reviewed result", tokenBudget: 5000, turnBudget: 3 }
  expect(await createContinuousGoal({ kind: "task", id: "task-1", directory }, input, captureApiAuthority())).toEqual(
    view,
  )
  expect({ method: requests[0]!.method, body: requests[0]!.body }).toEqual({
    method: "POST",
    body: { kind: "json", value: input },
  })
})

test("a budget update uses the precise goal revision and returns cumulative usage", async () => {
  const input = {
    requestID: "resume-once",
    goalID: view.id,
    expectedRevision: view.revision,
    status: "active" as const,
    reason: "Explicit resume",
    tokenBudget: 8000,
  }
  responder = async () => ready({ ...view, revision: "revision-3", status: "active", tokenBudget: 8000 })
  expect(await updateContinuousGoal({ kind: "task", id: "task-1", directory }, input, captureApiAuthority())).toEqual({
    ...view,
    revision: "revision-3",
    status: "active",
    tokenBudget: 8000,
  })
  expect({ method: requests[0]!.method, body: requests[0]!.body }).toEqual({
    method: "PATCH",
    body: { kind: "json", value: input },
  })
})

test("a revision conflict preserves the named server error contract", async () => {
  const body = { name: "ContinuousGoalError", data: { code: "revision_conflict", message: "The goal changed" } }
  responder = async () => ({ status: 409, ok: false, headers: {}, body })
  const failed = loadContinuousGoal({ kind: "mission", id: "session-1", directory }, captureApiAuthority())
  const error = await failed.catch((error: unknown) => error)
  expect(error).toBeInstanceOf(ApiError)
  expect({ status: (error as ApiError).status, body: (error as ApiError).body }).toEqual({ status: 409, body })
})

test("a response arriving after connection retirement has an explicit response-phase authority error", async () => {
  const deferred = Promise.withResolvers<TransportResponse>()
  responder = () => deferred.promise
  const read = loadContinuousGoal({ kind: "chat", id: "session-1", directory }, captureApiAuthority())
  configure({ serverUrl: "http://new-authority.invalid" })
  deferred.resolve(ready(view))
  const error = await read.catch((error: unknown) => error)
  expect(error).toBeInstanceOf(ApiAuthorityChangedError)
  expect((error as ApiAuthorityChangedError).phase).toBe("response")
})
