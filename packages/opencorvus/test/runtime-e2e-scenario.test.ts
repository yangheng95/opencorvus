import { expect, test } from "bun:test"
import path from "node:path"
import { RuntimeE2EScenarioSchema, scenarioFixturePath, runtimeDispatchSettlementFailures, runtimeAdapterCoverage } from "../script/runtime-e2e-scenario"
import { parseDispatchSettlementPayload } from "../src/engine/dispatch-settlement"
import { DispatchAdapterContractRegistry } from "../src/agent/dispatch-adapter-contract"
import { Identifier } from "../src/id/id"

test("a detached worker's final infrastructure failure becomes exact checker evidence", () => {
  const lineageID = Identifier.ascending("artifact")
  const failure = { kind: "infrastructure_failure" as const, operation: "execute-detached-worker", message: "Canonical binding input is undefined", session_id: "worker", recovery_authority: { occurrence_status: "occurrence_committed" as const, dispatch_lineage_id: lineageID, dispatch_id: "dispatch" } }
  const common = { task_id: "task", dispatch_lineage_id: lineageID, dispatch_id: "dispatch", session_id: "worker", time_created: 1 }
  const rows = [
    { id: "earlier-success", payload: parseDispatchSettlementPayload({ ...common, dispatch_lineage_id: Identifier.ascending("artifact"), dispatch_id: "earlier", session_id: "earlier-worker", outcome: { kind: "terminal_success", session_id: "earlier-worker", final_message_id: "final" } }, "earlier-success") },
    { id: "late-failure", payload: parseDispatchSettlementPayload({ ...common, outcome: failure }, "late-failure") },
  ]
  expect(runtimeDispatchSettlementFailures(rows)).toEqual([{ settlementID: "late-failure", dispatchID: "dispatch", ...failure }])
})

test("scenario input records explicit public Task intent and a portable isolated fixture", () => {
  const scenario = RuntimeE2EScenarioSchema.parse({ caseID: "investigation", title: "Investigate", request: "Read local evidence", promptProfile: "base", requiredAdapters: ["explore"], files: { "src/pricing.ts": "export const price = 10" } })
  expect(scenario.requiredAdapters).toEqual(["explore"])
  expect(scenarioFixturePath(path.resolve("isolated"), "src/pricing.ts")).toBe(path.resolve("isolated/src/pricing.ts"))
})

test("ambiguous Windows names return the portable-path error before any write", () => {
  for (const name of ["AGENTS.md.", "AGENTS.md ", "src/file.txt:stream", "NUL.txt", "dir/../file", "C:/device/file", "\\\\?\\C:\\device\\file"]) {
    expect(() => scenarioFixturePath(path.resolve("isolated"), name)).toThrow("Scenario fixture requires a relative portable file path")
  }
  expect(() => scenarioFixturePath(path.resolve("isolated"), "agents.MD")).toThrow("Scenario fixture must preserve runtime and acceptance ownership")
})

test("adapter execution coverage inventories the whole current registry and preserves partial outcomes", () => {
  const partial = runtimeAdapterCoverage([{ adapterID: "build", outcomeKind: "domain_incomplete" }, { adapterID: "explore", outcomeKind: "terminal_success" }])
  expect(partial).toEqual(DispatchAdapterContractRegistry.ids.map((adapterID) => ({ adapterID,
    status: adapterID === "build" ? "observed_without_success" : adapterID === "explore" ? "terminal_success" : "not_observed" })))
  const complete = runtimeAdapterCoverage(DispatchAdapterContractRegistry.ids.map((adapterID) => ({ adapterID, outcomeKind: "terminal_success" })))
  expect(complete).toEqual(DispatchAdapterContractRegistry.ids.map((adapterID) => ({ adapterID, status: "terminal_success" })))
})

test("unknown adapter evidence returns an explicit coverage contract error", () => {
  expect(() => runtimeAdapterCoverage([{ adapterID: "unknown_adapter" }])).toThrow("Unknown dispatch adapter unknown_adapter")
})
