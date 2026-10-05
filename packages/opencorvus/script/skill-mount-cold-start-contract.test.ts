import { test } from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import { backendReceipt, benchmarkInput, clientFailure, observedRequestID, ordinaryConfigurationInput, ordinaryProjectBoundary, OrdinaryProjectBoundaryError, ordinarySkillSource, OrdinarySkillSourceError, safeMatrixCounts } from "./skill-mount-cold-start-check.ts"

test("ordinary and fixture are explicit distinct inputs", () => {
  assert.deepEqual(benchmarkInput(["--profile", "ordinary", "--output", "evidence", "--run-root", "owned", "--port", "17955"]), {
    profile: "ordinary", output: path.resolve("evidence"), runRoot: path.resolve("owned"), port: 17955,
  })
  assert.deepEqual(benchmarkInput(["--profile", "fixture", "--output", "evidence"]), {
    profile: "fixture", output: path.resolve("evidence"), port: 17947,
  })
})
test("ordinary unconnected input supplies the empty configuration object", () => {
  assert.equal(ordinaryConfigurationInput(), "{}")
  assert.deepEqual(JSON.parse(ordinaryConfigurationInput()), {})
})
test("invalid input reports the precise admission contract", () => {
  assert.throws(() => benchmarkInput(["--profile", "ordinary", "--output", "evidence"]), /ordinary requires --run-root/)
  assert.throws(() => benchmarkInput(["--profile", "fixture", "--output", "evidence", "--profile", "ordinary"]), /Duplicate benchmark argument/)
})
test("timeout, caller cancellation and original typed errors remain distinct", () => {
  assert.equal(clientFailure(new DOMException("deadline", "TimeoutError")), "client-timeout")
  assert.equal(clientFailure(new DOMException("cancel", "AbortError")), "caller-aborted")
  const original = new TypeError("schema contract")
  assert.throws(() => clientFailure(original), (actual) => actual === original)
})
test("exact response identity and sole serial admission correlate observations", () => {
  const rows = ["first", "second"].map((requestID) => ({ service: "server", path: "/skill/mounts", status: "started", requestID }))
  assert.equal(observedRequestID(rows, "first"), "first")
  assert.equal(observedRequestID(rows.slice(1)), "second")
  assert.throws(() => observedRequestID(rows), /Uncorrelated concurrent request starts/)
})
test("safe complete-source counts preserve all supplied categories and role grants", () => {
  const skill = (source_type: string, level: string) => ({ source_type, risk: { level } })
  const input = {
    scope: "project", active_profile: "base", skills: [skill("builtin", "low"), skill("builtin", "low"), skill("config_path", "high")],
    agents: [{ agent_id: "root", base_role: "orchestrator" }], matrix: [{ agent_id: "root", grants: [{}, {}] }], unmounted_count: 1,
  } as unknown as Parameters<typeof safeMatrixCounts>[0]
  assert.deepEqual(safeMatrixCounts(input), { scope: "project", activeProfile: "base", totalSkills: 3,
    sources: { builtin: 2, config_path: 1 }, risks: { low: 2, high: 1 }, agents: [{ id: "root", role: "orchestrator" }],
    grants: [{ agent: "root", grants: 2 }], unmounted: 1 })
})
test("late HTTP200 remains an exact backend receipt beside a client timeout", () => {
  const client = clientFailure(new DOMException("15s expired", "TimeoutError"))
  const rows = [{ service: "server", requestID: "owned-original", status: "completed", statusCode: 200, duration: 19456 }]
  assert.deepEqual({ client, backend: backendReceipt(rows, "owned-original") }, {
    client: "client-timeout", backend: { outcome: "settled", status: 200, duration: 19456 },
  })
})
test("public fresh nonGit Project establishes its exact configuration boundary", () => {
  const directory = path.resolve("owned/project-a")
  assert.equal(ordinaryProjectBoundary({ id: "owned-project", worktree: directory }, directory), directory)
  const actual = path.resolve("outside-worktree")
  assert.throws(() => ordinaryProjectBoundary({ worktree: actual }, directory), (error) => {
    assert(error instanceof OrdinaryProjectBoundaryError)
    assert.equal(error.name, "OrdinaryProjectBoundaryError")
    assert.equal(error.expected, directory)
    assert.equal(error.actual, actual)
    return true
  })
})
test("source admission classifies builtin, owned filesystem and exact package resource", () => {
  const root = path.resolve("owned")
  assert.equal(ordinarySkillSource({ builtin: true, location: "builtin:method", projection_source: "default" }, root), "builtin")
  assert.equal(ordinarySkillSource({ builtin: false, location: path.join(root, "project-a", "SKILL.md"), projection_source: "default" }, root), "owned-filesystem")
  const location = `opencorvus-expert-squad-skill://opencorvus/skill/method?sha256=${"a".repeat(64)}`
  assert.equal(ordinarySkillSource({ builtin: false, location, projection_source: "package" }, root), "package-resource")
  for (const source of [
    { location, projection_source: "default" as const },
    { location: "https://example.invalid/skill", projection_source: "package" as const },
    { location: path.resolve("outside/SKILL.md"), projection_source: "default" as const },
    { location: "opencorvus-expert-squad-skill://opencorvus/skill/method?sha256=invalid", projection_source: "package" as const },
  ]) assert.throws(() => ordinarySkillSource({ builtin: false, ...source }, root), OrdinarySkillSourceError)
})
