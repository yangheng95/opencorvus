import { expect, test } from "bun:test"
import { reusableProfileRuns } from "../../script/benchmark/external-agent/contract"

const identity = {
  commit: "current-runtime",
  benchmark_bundle_sha256: "current-harness",
  case_set_manifest_sha256: "fixed-tasks",
}
function record(runID: string, source = identity, manifest = identity.case_set_manifest_sha256) {
  return {
    run_id: runID,
    opencorvus: { profile: "base", model: "luna", launch_mode: "mission", source },
    benchmark: { case_index: 1, repetition: 1, case_set_manifest_sha256: manifest },
  }
}

test("continuation selects the exact current runtime, harness and fixed task set", () => {
  const current = record("current")
  const catalog = {
    leaderboard: [
      record("old-runtime", { ...identity, commit: "old" }),
      record("old-harness", { ...identity, benchmark_bundle_sha256: "old" }),
      record("old-cases", identity, "other"),
    ],
    candidates: [current],
  }
  expect([...reusableProfileRuns(catalog, "base", "luna", "mission", identity).values()]).toEqual([current])
})

test("two candidates for the same exact execution identity return an explicit conflict", () => {
  expect(() =>
    reusableProfileRuns({ leaderboard: [record("a")], candidates: [record("b")] }, "base", "luna", "mission", identity),
  ).toThrow("Multiple reusable base runs exist for case 1: a, b")
})
