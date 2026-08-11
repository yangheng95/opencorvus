import { describe, expect, test } from "bun:test"
import {
  eligibleRandomEvolutionTargets,
  observeActivityDeadline,
  selectRandomEvolutionTarget,
  summarizeEvolutionEvidence,
  type EvolutionArtifactFact,
  type MarketEntry,
} from "../../script/expert-squad-evolution-e2e-support"

function marketEntry(id: string, installationScopes: string[] = []): MarketEntry {
  return {
    namespace: "builtin",
    id,
    name: id,
    label: id,
    description: `${id} description`,
    version: "1.0.0",
    installation_scopes: installationScopes,
  }
}

describe("random Expert Squad evolution controller contracts", () => {
  test("builds the eligible Market pool and selects a reproducible unbiased index", () => {
    const market = [
      marketEntry("squad-sdk"),
      marketEntry("zeta-domain"),
      marketEntry("alpha-domain"),
      marketEntry("installed-domain", ["project"]),
      marketEntry("evolution-lab"),
    ]
    expect(eligibleRandomEvolutionTargets(market).map((entry) => entry.id)).toEqual(["alpha-domain", "zeta-domain"])
    expect(selectRandomEvolutionTarget(market, "01".repeat(32))).toEqual({
      algorithm: "sha256-rejection-v1",
      seedHex: "01".repeat(32),
      poolSHA256: "208896ef175a336c561ca844d01f950f0e17764c85bec93c31349d8685a9a92f",
      poolCount: 2,
      counter: 0,
      index: 0,
      selected: marketEntry("alpha-domain"),
    })
  })

  test("advances the inactivity deadline only when the durable activity scope changes", () => {
    const first = observeActivityDeadline({
      activitySHA256: "a".repeat(64),
      observedAtMs: 1_000,
      inactivityWindowMs: 600_000,
    })
    expect(first).toEqual({ activitySHA256: "a".repeat(64), deadlineMs: 601_000 })
    expect(
      observeActivityDeadline({
        previous: first,
        activitySHA256: "a".repeat(64),
        observedAtMs: 2_000,
        inactivityWindowMs: 600_000,
      }),
    ).toEqual(first)
    expect(
      observeActivityDeadline({
        previous: first,
        activitySHA256: "b".repeat(64),
        observedAtMs: 3_000,
        inactivityWindowMs: 600_000,
      }),
    ).toEqual({ activitySHA256: "b".repeat(64), deadlineMs: 603_000 })
  })

  test("summarizes a complete incumbent-challenger Artifact graph", () => {
    const locator = { source: "engine_artifact", artifact_id: "art", catalog_revision: 1 }
    const facts: EvolutionArtifactFact[] = [
      "opportunity",
      "failure-attribution",
      "campaign-spec",
      "candidate-revision",
      "run-evidence-bundle",
      "run-evidence-bundle",
      "evaluation-result",
      "evaluation-result",
      "comparison-recommendation",
    ].map((suffix, index) => ({
      taskID: `task-${index}`,
      artifactType: `evolution-lab/${suffix}`,
      locator,
    }))
    expect(summarizeEvolutionEvidence(facts)).toEqual({
      counts: {
        "evolution-lab/opportunity": 1,
        "evolution-lab/failure-attribution": 1,
        "evolution-lab/campaign-spec": 1,
        "evolution-lab/candidate-revision": 1,
        "evolution-lab/run-evidence-bundle": 2,
        "evolution-lab/evaluation-result": 2,
        "evolution-lab/comparison-recommendation": 1,
      },
      recommendation: facts.at(-1),
    })
  })
})
